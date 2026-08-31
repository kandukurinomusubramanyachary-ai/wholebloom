const DEFAULT_ORDERS = {
  FAST: ['gemini', 'groq', 'openrouter', 'ollama'],
  SMART: ['openrouter', 'gemini', 'groq', 'ollama'],
  SAFETY: ['openrouter', 'gemini', 'groq', 'ollama'],
  DOCTOR: ['openrouter', 'gemini', 'groq', 'ollama'],
  LOCAL: ['ollama'],
};

function unique(items) { return [...new Set((items || []).filter(Boolean).map((item) => String(item).toLowerCase()))]; }

function routeRequest({ message = '', mode = 'auto', safety = {}, intent, intentDetails, providerOrders = DEFAULT_ORDERS } = {}) {
  const details = typeof intent === 'object' ? intent : intentDetails;
  const resolvedIntent = typeof intent === 'object' ? intent.intent : (intent || details?.intent || 'casual');
  const lowerMode = String(mode || 'auto').toLowerCase();
  const reasons = [...(details?.reasons || [])];
  let route;
  if (safety.triggered || resolvedIntent === 'safety') {
    route = 'SAFETY';
    reasons.push('safety overrides all other routes');
  } else if (lowerMode === 'local') {
    route = 'LOCAL';
    reasons.push('local mode requested');
  } else if (lowerMode === 'doctor' || resolvedIntent === 'doctor_prep') {
    route = 'DOCTOR';
    reasons.push('doctor preparation route');
  } else if (lowerMode === 'smart' || ['complex_health', 'cycle_question'].includes(resolvedIntent)) {
    route = 'SMART';
    reasons.push('higher health reasoning complexity');
  } else if (lowerMode === 'fast' || ['emotional', 'casual', 'simple_health', 'diet_question', 'symptom_question', 'activity_question'].includes(resolvedIntent)) {
    route = 'FAST';
  } else {
    route = 'FAST';
    reasons.push('safe default route');
  }
  const order = providerOrders[route] || DEFAULT_ORDERS[route];
  return {
    intent: resolvedIntent,
    complexity: details?.complexity || (route === 'SMART' || route === 'SAFETY' ? 'high' : 'low'),
    confidence: details?.confidence ?? 0.5,
    reasons,
    route,
    preferredProviders: unique(order),
    messageLength: String(message).length,
  };
}

module.exports = { routeRequest, DEFAULT_ORDERS };
