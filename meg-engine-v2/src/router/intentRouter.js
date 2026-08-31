const { detectSafety } = require('../safety/safetyRouter');

const WORDS = {
  doctor: /\b(doctor|appointment|clinic|gynaecologist|gynecologist|report|lab results|prescription|medication list|what should i ask)\b/i,
  cycle: /\b(period\w*|cycle\w*|ovulat\w*|spotting|bleeding|late|irregular|menstruat\w*|pcos cycle)\b/i,
  diet: /\b(crav\w*|sweet\w*|sugar\w*|food|eat|diet|meal\w*|hungry|insulin|carb\w*|weight)\b/i,
  activity: /\b(movement|exercise|workout|walk(?:ing)?|activity|active|yoga|stretch(?:ing)?)\b/i,
  symptom: /\b(symptom|pain|cramp|acne|hair growth|hair loss|bloat|fatigue|tired|mood|sleep|discharge|nausea)\b/i,
  health: /\b(pcos|polycystic|hormone|androgen|insulin resistance|testosterone|ovarian|fertility|health|diagnos|treatment)\b/i,
  emotional: /\b(i feel|feeling|sad|anxious|anxiety|overwhelmed|lonely|stressed|angry|upset|terrible|awful|scared|crying|need to vent|bad day|rough day|ugh|so done)\b/i,
  explanation: /\b(why|how|explain|what does|what is|could|does this mean)\b/i,
};

function classifyIntentDetailed({ message = '', safety } = {}) {
  const text = String(message).trim();
  const safetyResult = safety || detectSafety(text);
  if (safetyResult.triggered) return { intent: 'safety', complexity: 'high', confidence: 1, reasons: [`safety:${safetyResult.category}`] };
  if (WORDS.doctor.test(text)) return { intent: 'doctor_prep', complexity: 'medium', confidence: 0.96, reasons: ['doctor or appointment language'] };

  const datesOrNumbers = (text.match(/\b\d{1,3}\b/g) || []).length >= 2 || /\b(last|days?|weeks?|since|on)\b/i.test(text);
  const symptomCount = (text.match(/\b(cramp\w*|pain|acne|fatigue|tired|bloat\w*|nausea|spotting|sleep|mood)\b/gi) || []).length;
  const signals = [WORDS.cycle, WORDS.diet, WORDS.symptom, WORDS.health].filter((rule) => rule.test(text)).length;
  if (/^what (is|are)\s+(pcos|polycystic ovary syndrome|insulin resistance)\b/i.test(text)) return { intent: 'simple_health', complexity: 'low', confidence: 0.94, reasons: ['basic definition request'] };
  if (/^(ugh|so done|i(?:'| a)?m having a rough day|i just need to vent)\b/i.test(text)) return { intent: 'emotional', complexity: 'low', confidence: 0.93, reasons: ['emotional support signal'] };
  if (/\bpr[i1]od\b/i.test(text) && /\blate\b/i.test(text)) return { intent: 'cycle_question', complexity: 'medium', confidence: 0.72, reasons: ['typo-tolerant period and late-cycle signal'] };
  if (WORDS.activity.test(text) && signals <= 2 && !WORDS.cycle.test(text) && !WORDS.symptom.test(text)) return { intent: 'activity_question', complexity: 'low', confidence: 0.82, reasons: ['movement or activity language'] };
  if (WORDS.diet.test(text) && !WORDS.cycle.test(text) && !WORDS.symptom.test(text) && !/\b(hormone\w*|insulin resistance|fertility|diagnos\w*|treatment)\b/i.test(text) && !(/\bweight\b/i.test(text) && WORDS.health.test(text))) return { intent: 'diet_question', complexity: 'low', confidence: 0.88, reasons: ['food or nutrition is the primary request'] };
  if (/\bfertility\b/i.test(text) && WORDS.explanation.test(text)) return { intent: 'complex_health', complexity: 'high', confidence: 0.9, reasons: ['fertility and multi-factor health reasoning'] };
  if ((symptomCount >= 2 && datesOrNumbers) || signals >= 3 || (WORDS.explanation.test(text) && WORDS.health.test(text))) {
    return { intent: WORDS.cycle.test(text) ? 'cycle_question' : 'complex_health', complexity: 'high', confidence: 0.91, reasons: ['multiple health signals', ...(datesOrNumbers ? ['temporal or numeric data'] : []), ...(symptomCount >= 2 ? ['multiple symptoms'] : []), ...(WORDS.explanation.test(text) ? ['explanation request'] : [])] };
  }
  if (WORDS.cycle.test(text)) return { intent: 'cycle_question', complexity: 'medium', confidence: 0.9, reasons: ['cycle or period language'] };
  if (WORDS.diet.test(text)) return { intent: 'diet_question', complexity: 'low', confidence: 0.89, reasons: ['food, craving, or weight language'] };
  if (WORDS.symptom.test(text)) return { intent: 'symptom_question', complexity: 'medium', confidence: 0.86, reasons: ['symptom language'] };
  if (WORDS.health.test(text)) return { intent: WORDS.explanation.test(text) ? 'complex_health' : 'simple_health', complexity: WORDS.explanation.test(text) ? 'medium' : 'low', confidence: 0.82, reasons: ['health language'] };
  if (WORDS.emotional.test(text)) return { intent: 'emotional', complexity: 'low', confidence: 0.88, reasons: ['emotion language'] };
  if (text.length <= 80 && /^(hi|hello|hey|thanks|thank you|okay|ok|good morning|good night)\b/i.test(text)) return { intent: 'casual', complexity: 'low', confidence: 0.98, reasons: ['short social message'] };
  if (WORDS.explanation.test(text)) return { intent: 'complex_health', complexity: 'medium', confidence: 0.58, reasons: ['explanation language without a domain signal'] };
  return { intent: 'casual', complexity: text.length > 400 ? 'medium' : 'low', confidence: 0.5, reasons: ['no strong deterministic signal'] };
}

function classifyIntent(input) { return classifyIntentDetailed(input).intent; }

module.exports = { classifyIntent, classifyIntentDetailed, WORDS };
