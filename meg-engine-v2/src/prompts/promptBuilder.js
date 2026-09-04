const { CORE_PROMPT } = require('./core');
const { EMOTIONAL_PROMPT } = require('./emotional');
const { HEALTH_PROMPT } = require('./health');
const { DOCTOR_PROMPT } = require('./doctor');
const { SAFETY_PROMPT } = require('./safety');
const { STYLE_PROMPT } = require('./style');
const { MEMORY_PROMPT } = require('./memory-instructions');
const { CONTEXT_PROMPT } = require('./context-instructions');
const { supportModePrompt, cleanSupportMode } = require('./support-mode');
const { contextToText } = require('../context/contextBuilder');
const { estimateTokens, trimToTokens, fitSections, compactRecentMessages } = require('../utils/tokenBudget');

const HEALTH_INTENTS = new Set(['simple_health', 'complex_health', 'cycle_question', 'diet_question', 'symptom_question', 'activity_question']);

function modePrompt(intent) {
  if (intent === 'emotional') return EMOTIONAL_PROMPT;
  if (intent === 'doctor_prep') return DOCTOR_PROMPT;
  if (intent === 'safety') return SAFETY_PROMPT;
  if (HEALTH_INTENTS.has(intent)) return HEALTH_PROMPT;
  return '';
}

function uniqueMemories(memories = []) {
  const seen = new Set();
  return memories.filter((memory) => {
    const key = String(memory.content || '').toLowerCase().replace(/\W+/g, ' ').trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildMegPrompt({
  intent = 'casual',
  supportMode = null,
  context = {},
  memories = [],
  recentMessages = [],
  message,
  language = 'en',
  tokenBudget = 4200,
  promptVersion = 'meg-prompt-v2',
} = {}) {
  const safeMessage = trimToTokens(message, Math.min(900, Math.max(200, Math.floor(tokenBudget * 0.25))), { keepEnd: true });
  const userTokens = estimateTokens(safeMessage);
  const systemBudget = Math.max(1, tokenBudget - userTokens);
  const relevantMemory = uniqueMemories(memories).map((memory) => `- ${memory.content}`).join('\n') || 'No relevant long-term memory was found.';
  const recent = compactRecentMessages(recentMessages, { maxMessages: 8, olderBudget: 260 }) || 'No earlier turns are available.';
  const cleanedSupportMode = cleanSupportMode(supportMode);
  const sections = fitSections([
    { name: 'core', text: CORE_PROMPT, maxTokens: 1250 },
    { name: 'mode', text: modePrompt(intent), maxTokens: 650 },
    { name: 'supportMode', text: supportModePrompt(cleanedSupportMode), maxTokens: 280 },
    { name: 'style', text: STYLE_PROMPT, maxTokens: 260 },
    { name: 'memoryInstructions', text: MEMORY_PROMPT, maxTokens: 220 },
    { name: 'contextInstructions', text: CONTEXT_PROMPT, maxTokens: 220 },
    {
      name: 'turnMetadata',
      text: `Current intent: ${intent}. Bloom support mode: ${cleanedSupportMode || 'auto'}. Language: ${language || 'en'}. Prompt version: ${promptVersion}.`,
      maxTokens: 120,
    },
    { name: 'context', text: `Relevant Bloom context:\n${contextToText(context)}`, maxTokens: 600 },
    { name: 'memory', text: `Relevant memory:\n${relevantMemory}`, maxTokens: 650 },
    { name: 'recent', text: `Recent conversation:\n${recent}`, maxTokens: 1050, keepEnd: true },
  ], systemBudget);
  const system = Object.values(sections.sections).filter(Boolean).join('\n\n');
  return [
    { role: 'system', content: system },
    { role: 'user', content: safeMessage },
  ];
}

module.exports = { buildMegPrompt, modePrompt, uniqueMemories };
