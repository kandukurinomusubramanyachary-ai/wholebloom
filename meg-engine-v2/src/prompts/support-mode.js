const SUPPORT_MODES = new Set(['listen', 'understand', 'plan', 'conversation', 'doctor']);

const SUPPORT_MODE_PROMPTS = Object.freeze({
  listen: `The user explicitly chose “Just listen”. Lead with presence and emotional understanding. Do not rush into explanations, plans, checklists, or PCOS education unless immediate safety requires it. Keep the reply human and compact, and ask at most one gentle question only if it helps them continue.`,
  understand: `The user explicitly chose “Help me understand”. Explain the most relevant pattern or mechanism in plain language. Separate what is known from what is only possible, use Bloom context carefully, and avoid overloading the user with possibilities.`,
  plan: `The user explicitly chose “One small next step”. Give one or two realistic actions for the next manageable moment. Prefer small, concrete steps over a long plan, and account for low energy, pain, sleep, mood, and other context when available.`,
  conversation: `The user explicitly chose help preparing for a conversation. Help them find calm, natural words they could actually say. Keep it specific to the situation and avoid turning the answer into a generic communication lecture.`,
  doctor: `The user explicitly chose doctor preparation. Organize the useful facts, timing, symptoms, and questions for a clinician without diagnosing or overstating certainty.`,
});

function cleanSupportMode(value) {
  const mode = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return SUPPORT_MODES.has(mode) ? mode : null;
}

function supportModePrompt(value) {
  const mode = cleanSupportMode(value);
  return mode ? SUPPORT_MODE_PROMPTS[mode] : '';
}

module.exports = { SUPPORT_MODES, SUPPORT_MODE_PROMPTS, cleanSupportMode, supportModePrompt };
