const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const METRIC_COLUMNS = {
  context_ms: 'INTEGER',
  input_token_estimate: 'INTEGER',
  output_token_estimate: 'INTEGER',
  memory_retrieval_ms: 'INTEGER',
  provider_connect_ms: 'INTEGER',
  generation_ms: 'INTEGER',
  persistence_ms: 'INTEGER',
  retry_count: 'INTEGER NOT NULL DEFAULT 0',
  cache_hit: 'INTEGER NOT NULL DEFAULT 0',
  safety_trigger: 'INTEGER NOT NULL DEFAULT 0',
  revision_trigger: 'INTEGER NOT NULL DEFAULT 0',
  engine_version: 'TEXT',
  prompt_version: 'TEXT',
  router_version: 'TEXT',
};

class SQLiteStore {
  constructor({ filename } = {}) {
    let Database;
    try { Database = require('better-sqlite3'); } catch (error) {
      throw new Error(`better-sqlite3 is unavailable: ${error.message}`);
    }
    const resolved = path.resolve(filename || path.join(process.cwd(), 'data', 'meg.db'));
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    this.db = new Database(resolved);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('busy_timeout = 2500');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, user_id TEXT NOT NULL,
        role TEXT NOT NULL, content TEXT NOT NULL, client_message_id TEXT, created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS messages_conversation_idx ON messages(conversation_id, created_at);
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL, conversation_id TEXT, layer TEXT NOT NULL,
        content TEXT NOT NULL, tags TEXT NOT NULL DEFAULT '[]', importance REAL NOT NULL DEFAULT 0.5,
        created_at TEXT NOT NULL, last_used_at TEXT
      );
      CREATE INDEX IF NOT EXISTS memories_user_idx ON memories(user_id, layer, created_at);
      CREATE TABLE IF NOT EXISTS provider_metrics (
        id TEXT PRIMARY KEY, trace_id TEXT NOT NULL, provider TEXT, route TEXT, intent TEXT,
        provider_latency_ms INTEGER, ttft_ms INTEGER, total_ms INTEGER, fallbacks INTEGER NOT NULL DEFAULT 0,
        token_estimate INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS request_dedup (
        user_id TEXT NOT NULL, conversation_id TEXT NOT NULL, message_id TEXT NOT NULL,
        request_hash TEXT NOT NULL, status TEXT NOT NULL, response_text TEXT,
        response_meta TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        PRIMARY KEY (user_id, conversation_id, message_id)
      );
    `);
    this.migrate();
  }

  migrate() {
    const columns = new Set(this.db.prepare('PRAGMA table_info(messages)').all().map((row) => row.name));
    if (!columns.has('client_message_id')) this.db.exec('ALTER TABLE messages ADD COLUMN client_message_id TEXT');
    this.db.exec('CREATE INDEX IF NOT EXISTS messages_client_id_idx ON messages(user_id, conversation_id, client_message_id)');
    const metricColumns = new Set(this.db.prepare('PRAGMA table_info(provider_metrics)').all().map((row) => row.name));
    for (const [name, type] of Object.entries(METRIC_COLUMNS)) {
      if (!metricColumns.has(name)) this.db.exec(`ALTER TABLE provider_metrics ADD COLUMN ${name} ${type}`);
    }
  }

  ensureUser(userId) {
    const now = new Date().toISOString();
    this.db.prepare('INSERT OR IGNORE INTO users (id, created_at) VALUES (?, ?)').run(userId, now);
  }

  ensureConversation(userId, conversationId) {
    this.ensureUser(userId);
    const now = new Date().toISOString();
    this.db.prepare(`INSERT INTO conversations (id, user_id, created_at, updated_at) VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET updated_at = excluded.updated_at`).run(conversationId, userId, now, now);
  }

  beginRequest({ userId, conversationId, messageId, requestHash, staleAfterMs = 120000 }) {
    const now = new Date().toISOString();
    const insert = this.db.prepare(`INSERT OR IGNORE INTO request_dedup
      (user_id, conversation_id, message_id, request_hash, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'in_progress', ?, ?)`);
    const result = insert.run(userId, conversationId, messageId, requestHash, now, now);
    const row = this.db.prepare(`SELECT user_id AS userId, conversation_id AS conversationId, message_id AS messageId,
      request_hash AS requestHash, status, response_text AS responseText, response_meta AS responseMeta,
      updated_at AS updatedAt FROM request_dedup WHERE user_id = ? AND conversation_id = ? AND message_id = ?`)
      .get(userId, conversationId, messageId);
    if (row.requestHash !== requestHash) return { owner: false, conflict: true, row };
    if (row.status === 'in_progress' && staleAfterMs > 0 && Date.parse(row.updatedAt || '') + staleAfterMs < Date.now()) {
      const takeover = this.db.prepare(`UPDATE request_dedup SET updated_at = ? WHERE user_id = ? AND conversation_id = ? AND message_id = ? AND request_hash = ? AND status = 'in_progress' AND updated_at = ?`)
        .run(now, userId, conversationId, messageId, requestHash, row.updatedAt);
      return { owner: takeover.changes === 1, conflict: false, row: { ...row, updatedAt: now } };
    }
    return { owner: result.changes === 1, conflict: false, row };
  }

  completeRequest({ userId, conversationId, messageId, requestHash, responseText, responseMeta }) {
    this.db.prepare(`UPDATE request_dedup SET status = 'done', response_text = ?, response_meta = ?, updated_at = ?
      WHERE user_id = ? AND conversation_id = ? AND message_id = ? AND request_hash = ?`)
      .run(String(responseText), JSON.stringify(responseMeta || {}), new Date().toISOString(), userId, conversationId, messageId, requestHash);
  }

  releaseRequest({ userId, conversationId, messageId, requestHash }) {
    this.db.prepare(`DELETE FROM request_dedup WHERE user_id = ? AND conversation_id = ? AND message_id = ?
      AND request_hash = ? AND status = 'in_progress'`).run(userId, conversationId, messageId, requestHash);
  }

  appendMessage({ userId, conversationId, role, content, clientMessageId }) {
    this.ensureConversation(userId, conversationId);
    const item = { id: randomUUID(), createdAt: new Date().toISOString() };
    this.db.prepare(`INSERT INTO messages
      (id, conversation_id, user_id, role, content, client_message_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(item.id, conversationId, userId, role, String(content), clientMessageId || null, item.createdAt);
    return { ...item, userId, conversationId, role, content: String(content), clientMessageId: clientMessageId || null };
  }

  getRecentMessages({ userId, conversationId, limit = 8 }) {
    return this.db.prepare(`SELECT id, user_id AS userId, conversation_id AS conversationId, role, content,
      client_message_id AS clientMessageId, created_at AS createdAt FROM messages
      WHERE user_id = ? AND conversation_id = ? ORDER BY created_at DESC LIMIT ?`)
      .all(userId, conversationId, limit).reverse();
  }

  addMemory({ userId, conversationId, layer, content, tags = [], importance = 0.5 }) {
    this.ensureUser(userId);
    const existing = this.db.prepare('SELECT id FROM memories WHERE user_id = ? AND content = ? LIMIT 1').get(userId, String(content));
    if (existing) return { id: existing.id, duplicate: true };
    const item = { id: randomUUID(), createdAt: new Date().toISOString() };
    this.db.prepare(`INSERT INTO memories (id, user_id, conversation_id, layer, content, tags, importance, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(item.id, userId, conversationId || null, layer, String(content), JSON.stringify(tags), importance, item.createdAt);
    return { ...item, userId, conversationId, layer, content: String(content), tags, importance };
  }

  listMemories({ userId, layers, limit = 50 }) {
    const rows = this.db.prepare(`SELECT id, user_id AS userId, conversation_id AS conversationId, layer, content, tags,
      importance, created_at AS createdAt, last_used_at AS lastUsedAt FROM memories
      WHERE user_id = ? ORDER BY importance DESC, created_at DESC LIMIT ?`).all(userId, limit * 3);
    return rows.filter((row) => !layers || layers.includes(row.layer)).slice(0, limit).map((row) => ({ ...row, tags: JSON.parse(row.tags || '[]') }));
  }

  markMemoryUsed(id) { this.db.prepare('UPDATE memories SET last_used_at = ? WHERE id = ?').run(new Date().toISOString(), id); }

  saveProviderMetric(metric) {
    this.db.prepare(`INSERT INTO provider_metrics (
      id, trace_id, provider, route, intent, provider_latency_ms, ttft_ms, total_ms, fallbacks,
      token_estimate, input_token_estimate, output_token_estimate, context_ms, memory_retrieval_ms, provider_connect_ms, generation_ms, persistence_ms,
      retry_count, cache_hit, safety_trigger, revision_trigger, engine_version, prompt_version, router_version, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      randomUUID(), metric.traceId, metric.provider || null, metric.route || null, metric.intent || null,
      metric.providerLatencyMs || null, metric.ttftMs || null, metric.totalMs || null, metric.fallbacks || 0,
      metric.tokenEstimate || metric.outputTokenEstimate || 0, metric.inputTokenEstimate || null, metric.outputTokenEstimate || metric.tokenEstimate || 0,
      metric.contextMs || null, metric.memoryRetrievalMs || null, metric.providerConnectMs || null,
      metric.generationMs || null, metric.persistenceMs || null, metric.retries || 0, metric.cacheHit ? 1 : 0,
      metric.safetyTriggered ? 1 : 0, metric.revisionTriggered ? 1 : 0, metric.engineVersion || null,
      metric.promptVersion || null, metric.routerVersion || null, new Date().toISOString(),
    );
  }

  clearMemories({ userId, layer } = {}) {
    if (layer) return this.db.prepare('DELETE FROM memories WHERE user_id = ? AND layer = ?').run(userId, layer).changes;
    return this.db.prepare('DELETE FROM memories WHERE user_id = ?').run(userId).changes;
  }

  deleteConversation({ userId, conversationId }) {
    const transaction = this.db.transaction(() => {
      const messages = this.db.prepare('DELETE FROM messages WHERE user_id = ? AND conversation_id = ?').run(userId, conversationId).changes;
      const memories = this.db.prepare('DELETE FROM memories WHERE user_id = ? AND conversation_id = ?').run(userId, conversationId).changes;
      this.db.prepare('DELETE FROM conversations WHERE user_id = ? AND id = ?').run(userId, conversationId);
      return { messages, memories };
    });
    return transaction();
  }

  exportUserData({ userId }) {
    return {
      messages: this.db.prepare('SELECT * FROM messages WHERE user_id = ? ORDER BY created_at').all(userId),
      memories: this.listMemories({ userId, limit: 10000 }),
    };
  }

  close() { this.db.close(); }
}

module.exports = { SQLiteStore };
