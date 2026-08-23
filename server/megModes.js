const MEG_MODES = Object.freeze({
  listen: 'listen',
  understand: 'understand',
  plan: 'plan',
  conversation: 'conversation',
  doctor: 'doctor',
});

const MODE_INSTRUCTIONS = Object.freeze({
  listen: 'She needs to be heard. Do not give advice or a plan unless she asks. Reflect one specific thing she said and ask one open question.',
  understand: 'Gently connect what she says to one relevant logged detail from her context. Use observations, never diagnoses. Do not force a connection if nothing fits.',
  plan: 'Offer exactly one small, realistic next step she could do today. One follow-up question max. No checklists.',
  conversation: 'Help her find calm words for a real-life conversation. If useful, offer 1–2 phrasing options. Stay on her side.',
  doctor: 'Help her organize what to mention or ask at an appointment. Do not diagnose, recommend treatment, or interpret tests.',
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
