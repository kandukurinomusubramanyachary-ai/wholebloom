const SAFETY_RULES = [
  {
    category: 'self_harm', priority: 100,
    triggerPatterns: [/\bkill myself\b/i, /\bend my life\b/i, /\bsuicid(?:e|al)\b/i, /\bself[- ]?harm(?:ing)?\b/i, /\bhurt myself\b/i, /\bdon'?t want to live\b/i],
    behavior: 'prioritize immediate human support and emergency help; ask only about immediate danger',
  },
  {
    category: 'pregnancy_emergency', priority: 95,
    triggerPatterns: [
      /\b(pregnan\w*|positive pregnancy test)\b.{0,100}\b(heavy bleeding|severe pain|fainted|chest pain|can'?t breathe|shoulder pain)\b/i,
      /\b(heavy bleeding|severe pain|fainted|chest pain|can'?t breathe|shoulder pain)\b.{0,100}\b(pregnan\w*|positive pregnancy test)\b/i,
    ],
    behavior: 'recommend immediate local emergency assessment; do not reassure or diagnose',
  },
  {
    category: 'severe_bleeding', priority: 90,
    triggerPatterns: [
      /\b(severe|heavy|uncontrollable|soaking) bleeding\b/i,
      /\bbleeding\b.{0,50}\b(soak(?:ing)?|changing).{0,30}\b(pad|tampon).{0,30}\b(hour|an hour)\b/i,
    ],
    behavior: 'recommend urgent medical care now',
  },
  {
    category: 'fainting', priority: 90,
    triggerPatterns: [/\b(fainted|fainting|feel faint|feeling faint|passed out|unconscious)\b/i],
    behavior: 'recommend urgent medical care now and advise not driving if unwell',
  },
  {
    category: 'chest_pain', priority: 90,
    triggerPatterns: [/\b(chest pain|pressure in (my )?chest|tightness in (my )?chest)\b/i],
    behavior: 'recommend immediate local emergency assessment',
  },
  {
    category: 'severe_pelvic_pain', priority: 90,
    triggerPatterns: [
      /\b(severe|unbearable|excruciating) (pelvic|abdominal|stomach) pain\b/i,
      /\b(pelvic|abdominal) pain\b.{0,40}\b(severe|unbearable|excruciating)\b/i,
    ],
    behavior: 'recommend urgent medical care now',
  },
  {
    category: 'urgent_medical', priority: 85,
    triggerPatterns: [/\b(can'?t breathe|difficulty breathing|shortness of breath)\b/i, /\bconfused|confusion\b.{0,30}\b(pain|bleed|pregnan)\b/i],
    behavior: 'recommend immediate local emergency assessment',
  },
  {
    category: 'medication_request', priority: 50,
    triggerPatterns: [
      /\b(should|can) i (stop|start|skip|double|increase|decrease|change)\b.{0,60}\b(medication|medicine|dose|tablet|metformin|pill)\b/i,
      /\bwhat dose\b|\bhow much (metformin|medication|medicine)\b/i,
    ],
    behavior: 'do not prescribe or alter treatment; direct the user to a pharmacist or clinician',
  },
  {
    category: 'diagnosis_request', priority: 40,
    triggerPatterns: [
      /\b(can you|could you|please) diagnose\b/i,
      /\bdo i have (pcos|polycystic ovary syndrome|endometriosis|pregnancy)\b/i,
      /\b(am i|could i be) pregnant\b/i,
    ],
    behavior: 'distinguish logged facts from possibilities and recommend appropriate clinical testing',
  },
];

function detectSafety(message = '') {
  const text = String(message).trim();
  const matches = SAFETY_RULES.filter((rule) => rule.triggerPatterns.some((pattern) => pattern.test(text))).sort((a, b) => b.priority - a.priority);
  const rule = matches[0];
  if (!rule) return { triggered: false, category: null, reason: null, priority: 0, matches: [] };
  if (matches.length > 1 && !matches.some((item) => ['self_harm', 'pregnancy_emergency'].includes(item.category))) return { triggered: true, category: 'urgent_medical', reason: 'red_flag_symptom' };
  return { triggered: true, category: rule.category, reason: rule.category === 'self_harm' ? 'self_harm_language' : 'deterministic_rule', priority: rule.priority, matches: matches.map((item) => item.category), behavior: rule.behavior };
}

function isUrgentCategory(category) {
  return ['self_harm', 'pregnancy_emergency', 'severe_bleeding', 'fainting', 'chest_pain', 'severe_pelvic_pain', 'urgent_medical'].includes(category);
}

function safetyFallback(category) {
  if (category === 'self_harm') return "I'm really sorry you're carrying this right now. You deserve immediate, human support. If you might act on these thoughts, call your local emergency number now or go to the nearest emergency department. Move away from anything you could use to hurt yourself and contact someone you trust to stay with you. Are you in immediate danger right now?";
  if (category === 'medication_request') return "I can share general information, but I can't choose a dose or tell you to start, stop, or change a prescribed medicine. Please check with your prescriber or pharmacist, who can account for your full history and other medicines.";
  if (category === 'diagnosis_request') return "I can help you organize what you have noticed, but I can't diagnose PCOS, pregnancy, or another condition from chat. A clinician can combine your symptoms, history, examination, and appropriate tests to work out what is going on.";
  return "Those symptoms could need urgent medical attention. Please contact local emergency services or go to the nearest emergency department now, especially if symptoms are severe, worsening, or you feel faint. Do not drive yourself if you feel unsafe. Can someone stay with you while you get help?";
}

module.exports = { SAFETY_RULES, detectSafety, safetyFallback, isUrgentCategory };
