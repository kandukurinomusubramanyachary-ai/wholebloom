const MEG_MODES = Object.freeze({
  listen: 'listen',
  understand: 'understand',
  plan: 'plan',
  conversation: 'conversation',
  doctor: 'doctor',
});

const MODE_INSTRUCTIONS = Object.freeze({
  listen: 'She needs to be heard. Reflect one specific meaning without treating an inferred emotion as fact. Do not give advice or a plan unless she asks. A question is optional; if one helps, ask one gentle and precise question.',
  understand: 'Briefly acknowledge why the answer matters, then explain one idea at a time in plain language with no more than three important points. Keep logged observations separate from medical facts, never diagnose, and do not force a context connection.',
  plan: 'Offer exactly one realistic next step she could do today or tomorrow. Ask whether it feels possible only when useful. No checklists or full routines.',
  conversation: 'Maintain natural turn-taking and use one relevant earlier detail when it helps. Do not summarise the whole thread or ask another question when she is already answering the previous one. If useful, offer 1–2 calm phrasing options.',
  doctor: 'Organise symptoms, dates, cycle information, and questions for an appointment. Separate recorded facts from possible interpretations. Do not diagnose, prescribe, interpret tests, or make ordinary PCOS symptoms sound dangerous.',
});

function cleanMegMode(value) {
  return typeof value === 'string' && Object.hasOwn(MEG_MODES, value)
    ? value
    : null;
}

function buildModeInstruction(mode) {
  return cleanMegMode(mode) ? MODE_INSTRUCTIONS[mode] : '';
}

module.exports = {
  MEG_MODES,
  MODE_INSTRUCTIONS,
  cleanMegMode,
  buildModeInstruction,
};
