const VOICE_PREFERENCES = ['en-IN', 'en-GB', 'en-US', 'en'];

function chooseVoice(voices) {
  for (const language of VOICE_PREFERENCES) {
    const exact = voices.find((voice) => voice.lang?.toLowerCase() === language.toLowerCase());
    if (exact) return exact;
    const prefix = voices.find((voice) => voice.lang?.toLowerCase().startsWith(language.toLowerCase()));
    if (prefix) return prefix;
  }
  return voices.find((voice) => voice.default) || voices[0] || null;
}

export function createVoiceCoach(options = {}) {
  const synthesizer = typeof window !== 'undefined' ? window.speechSynthesis : null;
  let muted = Boolean(options.muted);

  function speak(text, interrupt = true) {
    if (muted || !synthesizer || typeof SpeechSynthesisUtterance === 'undefined') return false;
    if (interrupt) synthesizer.cancel();
    const utterance = new SpeechSynthesisUtterance(String(text));
    utterance.lang = 'en-IN';
    utterance.rate = options.rate || 0.95;
    utterance.pitch = options.pitch || 1;
    const voice = chooseVoice(synthesizer.getVoices());
    if (voice) utterance.voice = voice;
    synthesizer.speak(utterance);
    return true;
  }

  return {
    available: Boolean(synthesizer && typeof SpeechSynthesisUtterance !== 'undefined'),
    cancel() { synthesizer?.cancel(); },
    setMuted(value) { muted = Boolean(value); if (muted) synthesizer?.cancel(); },
    speak,
  };
}
