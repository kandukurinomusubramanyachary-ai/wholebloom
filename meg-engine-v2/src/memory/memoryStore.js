const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { SQLiteStore } = require('../persistence/sqlite');

class InMemoryBackend {
  constructor() {
    this.users = new Map();
    this.conversations = new Map();
    this.messages = [];
    this.memories = [];
    this.providerMetrics = [];
    this.requests = new Map();
  }

  ensureUser(userId) { if (!this.users.has(userId)) this.users.set(userId, { id: userId, createdAt: new Date().toISOString() }); }
  ensureConversation(userId, conversationId) {
    this.ensureUser(userId);
    const current = this.conversations.get(conversationId) || { id: conversationId, userId, createdAt: new Date().toISOString() };
    current.updatedAt = new Date().toISOString();
    this.conversations.set(conversationId, current);
  }

  beginRequest({ userId, conversationId, messageId, requestHash, staleAfterMs = 120000 }) {
    const key = `${userId}\0${conversationId}\0${messageId}`;
    const current = this.requests.get(key);
    if (!current) {
      const row = { userId, conversationId, messageId, requestHash, status: 'in_progress', responseText: null, responseMeta: null, updatedAt: new Date().toISOString() };
      this.requests.set(key, row);
      return { owner: true, conflict: false, row };
    }
    if (current.requestHash !== requestHash) return { owner: false, conflict: true, row: current };
    if (current.status === 'in_progress' && staleAfterMs > 0 && Date.parse(current.updatedAt || '') + staleAfterMs < Date.now()) {
      current.updatedAt = new Date().toISOString();
      return { owner: true, conflict: false, row: current };
    }
    return { owner: false, conflict: false, row: current };
  }

  completeRequest({ userId, conversationId, messageId, requestHash, responseText, responseMeta }) {
    const row = this.requests.get(`${userId}\0${conversationId}\0${messageId}`);
    if (row && row.requestHash === requestHash) Object.assign(row, { status: 'done', responseText: String(responseText), responseMeta: responseMeta || {} });
  }

  releaseRequest({ userId, conversationId, messageId, requestHash }) {
    const key = `${userId}\0${conversationId}\0${messageId}`;
    const row = this.requests.get(key);
    if (row?.requestHash === requestHash && row.status === 'in_progress') this.requests.delete(key);
  }

  appendMessage(item) {
    this.ensureConversation(item.userId, item.conversationId);
    const message = { ...item, id: randomUUID(), createdAt: new Date().toISOString(), content: String(item.content), clientMessageId: item.clientMessageId || null };
    this.messages.push(message);
    return message;
  }
  getRecentMessages({ userId, conversationId, limit = 8 }) {
    return this.messages.filter((item) => item.userId === userId && item.conversationId === conversationId).slice(-limit);
  }
  addMemory(item) {
    this.ensureUser(item.userId);
    const existing = this.memories.find((memory) => memory.userId === item.userId && memory.content === String(item.content));
    if (existing) return { id: existing.id, duplicate: true };
    const memory = { ...item, id: randomUUID(), createdAt: new Date().toISOString(), content: String(item.content), tags: item.tags || [], importance: item.importance ?? 0.5 };
    this.memories.push(memory);
    return memory;
  }
  listMemories({ userId, layers, limit = 50 }) {
    return this.memories.filter((item) => item.userId === userId && (!layers || layers.includes(item.layer)))
      .sort((a, b) => b.importance - a.importance || b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
  }
  markMemoryUsed(id) { const item = this.memories.find((memory) => memory.id === id); if (item) item.lastUsedAt = new Date().toISOString(); }
  saveProviderMetric(metric) { this.providerMetrics.push({ ...metric, createdAt: new Date().toISOString() }); }
  clearMemories({ userId, layer } = {}) {
    const before = this.memories.length;
    this.memories = this.memories.filter((memory) => !(memory.userId === userId && (!layer || memory.layer === layer)));
    return before - this.memories.length;
  }
  deleteConversation({ userId, conversationId }) {
    const messages = this.messages.filter((item) => item.userId === userId && item.conversationId === conversationId).length;
    const memories = this.memories.filter((item) => item.userId === userId && item.conversationId === conversationId).length;
    this.messages = this.messages.filter((item) => !(item.userId === userId && item.conversationId === conversationId));
    this.memories = this.memories.filter((item) => !(item.userId === userId && item.conversationId === conversationId));
    this.conversations.delete(conversationId);
    return { messages, memories };
  }
  exportUserData({ userId }) {
    return {
      messages: this.messages.filter((item) => item.userId === userId),
      memories: this.listMemories({ userId, limit: 10000 }),
    };
  }
  close() {}
}

class JsonBackend extends InMemoryBackend {
  constructor(filename) { super(); this.filename = filename; this.load(); }
  load() {
    try {
      const raw = JSON.parse(fs.readFileSync(this.filename, 'utf8'));
      this.users = new Map(raw.users || []);
      this.conversations = new Map(raw.conversations || []);
      this.messages = raw.messages || [];
      this.memories = raw.memories || [];
      this.providerMetrics = raw.providerMetrics || [];
      this.requests = new Map(raw.requests || []);
    } catch {}
  }
  persist() {
    fs.mkdirSync(path.dirname(this.filename), { recursive: true });
    fs.writeFileSync(this.filename, JSON.stringify({ users: [...this.users], conversations: [...this.conversations], messages: this.messages, memories: this.memories, providerMetrics: this.providerMetrics, requests: [...this.requests] }));
  }
  ensureUser(id) { super.ensureUser(id); this.persist(); }
  ensureConversation(userId, id) { super.ensureConversation(userId, id); this.persist(); }
  beginRequest(item) { const result = super.beginRequest(item); this.persist(); return result; }
  completeRequest(item) { super.completeRequest(item); this.persist(); }
  releaseRequest(item) { super.releaseRequest(item); this.persist(); }
  appendMessage(item) { const result = super.appendMessage(item); this.persist(); return result; }
  addMemory(item) { const result = super.addMemory(item); this.persist(); return result; }
  markMemoryUsed(id) { super.markMemoryUsed(id); this.persist(); }
  saveProviderMetric(metric) { super.saveProviderMetric(metric); this.persist(); }
  clearMemories(item) { const result = super.clearMemories(item); this.persist(); return result; }
  deleteConversation(item) { const result = super.deleteConversation(item); this.persist(); return result; }
}

class MemoryStore {
  constructor({ driver = 'sqlite', filename, jsonFilename } = {}) {
    this.driver = driver;
    if (driver === 'memory') this.backend = new InMemoryBackend();
    else {
      try {
        this.backend = new SQLiteStore({ filename });
        this.driver = 'sqlite';
      } catch (error) {
        this.backend = new JsonBackend(jsonFilename || path.join(path.dirname(filename || path.join(process.cwd(), 'data', 'meg.db')), 'meg.json'));
        this.driver = 'json-fallback';
        this.startupWarning = error.message;
      }
    }
  }
  ensureUser(...args) { return this.backend.ensureUser(...args); }
  ensureConversation(...args) { return this.backend.ensureConversation(...args); }
  beginRequest(...args) { return this.backend.beginRequest(...args); }
  completeRequest(...args) { return this.backend.completeRequest(...args); }
  releaseRequest(...args) { return this.backend.releaseRequest(...args); }
  appendMessage(...args) { return this.backend.appendMessage(...args); }
  getRecentMessages(...args) { return this.backend.getRecentMessages(...args); }
  addMemory(...args) { return this.backend.addMemory(...args); }
  listMemories(...args) { return this.backend.listMemories(...args); }
  markMemoryUsed(...args) { return this.backend.markMemoryUsed(...args); }
  saveProviderMetric(...args) { return this.backend.saveProviderMetric(...args); }
  clearMemories(...args) { return this.backend.clearMemories(...args); }
  deleteConversation(...args) { return this.backend.deleteConversation(...args); }
  exportUserData(...args) { return this.backend.exportUserData(...args); }
  close() { return this.backend.close(); }
}

module.exports = { MemoryStore, InMemoryBackend, JsonBackend };
