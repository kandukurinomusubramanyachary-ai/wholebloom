export function createVoiceCoach() {
  return { available: false, cancel() {}, setMuted() {}, speak() { return false; } };
}
