const REPEATED_DISCLAIMER = /\b(as an ai|as a language model|i am just an ai|i cannot provide medical advice)\b/gi;
const LEAK_PATTERNS = [
  /\b(ignore (all|any|the) previous instructions|system message|developer message|hidden instruction)\b/i,
  /\b(api[- ]?key|authorization:|bearer\s+[a-z0-9._-]+)\b/i,
  /```(?:json|javascript|text)?\s*\{\s*"(?:role|messages|prompt)"/i,
  /\bevent:\s*(?:token|done)\b|\[(?:DONE|ERROR)\]|^\s*data:/i,
  /\b(?:gemini|openrouter|groq|ollama)\s+(?:provider|api|model)\b/i,
];
const DIAGNOSIS_PATTERNS = [
  /\b(?:you definitely have|you clearly have|this confirms you have)\s+(?:pcos|pregnancy|endometriosis|infertility)\b/i,
  /\bthis (?:means|proves) you are pregnant\b/i,
];
const MEDICATION_PATTERNS = [
  /\b(?:take|start|stop|skip|double|increase|decrease)\s+\d+(?:\.\d+)?\s*(?:mg|mcg|milligrams?|tablets?)\b/i,
  /\b(?:stop|start|change|double|skip)\s+(?:your\s+)?(?:prescription|prescribed medication|medication dosage|dose)\b/i,
];

function sentenceTrim(text, maxChars) {
  if (text.length <= maxChars) return text.trim();
  const clipped = text.slice(0, maxChars);
  const boundary = Math.max(clipped.lastIndexOf('. '), clipped.lastIndexOf('! '), clipped.lastIndexOf('? '));
  return `${(boundary > maxChars * 0.55 ? clipped.slice(0, boundary + 1) : clipped).trim()}…`;
}

function removeDuplicateSentences(text, issues) {
  const seen = new Set();
  return text.split(/(?<=[.!?])\s+/).filter((sentence) => {
    const key = sentence.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
    if (key.length < 20 || !seen.has(key)) { if (key.length >= 20) seen.add(key); return true; }
    issues.push('repeated_sentence');
    return false;
  }).join(' ');
}

function removeDuplicateParagraphs(text, issues) {
  const seen = new Set();
  return text.split(/\n\s*\n/).filter((paragraph) => {
    const key = paragraph.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!key || seen.has(key)) { if (key) issues.push('repeated_paragraph'); return false; }
    seen.add(key);
    return true;
  }).join('\n\n');
}

function guardResponse(response, { maxChars = 6000, safety = false, safetyCategory } = {}) {
  let text = String(response || '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim();
  const issues = [];
  if (!text) return { ok: false, text: '', issues: ['empty'] };
  if (LEAK_PATTERNS.some((pattern) => pattern.test(text))) issues.push('prompt_or_provider_leak');
  if (DIAGNOSIS_PATTERNS.some((pattern) => pattern.test(text))) {
    issues.push('unsafe_diagnosis');
    text = text.replace(/\byou definitely have\b/gi, 'This alone cannot confirm that you have').replace(/\byou clearly have\b/gi, 'This alone cannot confirm that you have').replace(/\bthis confirms you have\b/gi, 'This alone cannot confirm that you have').replace(/\bthis (means|proves) you are pregnant\b/gi, 'This alone cannot confirm pregnancy');
  }
  if (MEDICATION_PATTERNS.some((pattern) => pattern.test(text))) issues.push('unsafe_medication_instruction');
  if (text.length > maxChars) { issues.push('excessive_length'); text = sentenceTrim(text, maxChars); }
  text = removeDuplicateParagraphs(text, issues);
  text = removeDuplicateSentences(text, issues);
  const questionCount = (text.match(/\?/g) || []).length;
  if (questionCount > 1) {
    issues.push('multiple_questions');
    let seen = 0;
    text = text.replace(/\?/g, () => { seen += 1; return seen === 1 ? '?' : '.'; });
  }
  if (REPEATED_DISCLAIMER.test(text)) {
    issues.push('generic_disclaimer');
    text = text.replace(REPEATED_DISCLAIMER, '').replace(/\s{2,}/g, ' ').replace(/^\s*[,.:;-]\s*/, '').trim();
    REPEATED_DISCLAIMER.lastIndex = 0;
  }
  const urgent = !['diagnosis_request', 'medication_request'].includes(safetyCategory);
  if (safety && urgent && !/(urgent|emergency|immediately|as soon as possible|help)/i.test(text)) issues.push('safety_action_missing');
  // Diagnosis certainty is locally downgraded above; medication dosage/action instructions remain fatal.
  const fatal = new Set(['empty', 'prompt_or_provider_leak', 'unsafe_medication_instruction', 'safety_action_missing']);
  return { ok: !issues.some((issue) => fatal.has(issue)), text: text.trim(), issues };
}

module.exports = { guardResponse, sentenceTrim, removeDuplicateSentences, removeDuplicateParagraphs, LEAK_PATTERNS };
