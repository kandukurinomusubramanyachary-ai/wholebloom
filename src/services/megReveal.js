const FIRST_FRAME_WORDS = 3;
const MAX_REVEAL_DURATION_MS = 1500;

const REVEAL_PACING = Object.freeze({
  fast: { maximumWaitMs: 3500, wordsPerFrame: 3, baseDelayMs: 48 },
  medium: { maximumWaitMs: 6000, wordsPerFrame: 6, baseDelayMs: 32 },
  slow: { maximumWaitMs: Infinity, wordsPerFrame: 9, baseDelayMs: 24 },
});

function revealPacingForWait(providerWaitMs) {
  const wait = Number.isFinite(providerWaitMs) ? Math.max(0, providerWaitMs) : 0;
  if (wait < REVEAL_PACING.fast.maximumWaitMs) return REVEAL_PACING.fast;
  if (wait <= REVEAL_PACING.medium.maximumWaitMs) return REVEAL_PACING.medium;
  return REVEAL_PACING.slow;
}

function wordEndIndexes(text) {
  return [...String(text || '').matchAll(/\S+/gu)].map((match) => (
    match.index + match[0].length
  ));
}

function punctuationMultiplier(frameText) {
  const finalCharacter = String(frameText || '').trimEnd().slice(-1);
  if (/[.!?]/u.test(finalCharacter)) return 2.25;
  if (/,/u.test(finalCharacter)) return 1.65;
  return 1;
}

function createMegRevealPlan(reply, providerWaitMs = 0) {
  const text = String(reply ?? '');
  if (!text) return [];

  const ends = wordEndIndexes(text);
  if (ends.length <= FIRST_FRAME_WORDS) {
    return [{ text, delayMs: 0, wordCount: ends.length }];
  }

  const pacing = revealPacingForWait(providerWaitMs);
  const wordCounts = [FIRST_FRAME_WORDS];
  let count = FIRST_FRAME_WORDS;
  while (count < ends.length) {
    count = Math.min(ends.length, count + pacing.wordsPerFrame);
    wordCounts.push(count);
  }

  const frames = wordCounts.map((wordCount, index) => {
    const isFinal = index === wordCounts.length - 1;
    const frameText = isFinal ? text : text.slice(0, ends[wordCount - 1]);
    return {
      text: frameText,
      wordCount,
      delayMs: isFinal
        ? 0
        : Math.round(pacing.baseDelayMs * punctuationMultiplier(frameText)),
    };
  });

  const totalDelay = frames.reduce((total, frame) => total + frame.delayMs, 0);
  if (totalDelay > MAX_REVEAL_DURATION_MS) {
    const scale = MAX_REVEAL_DURATION_MS / totalDelay;
    frames.forEach((frame) => {
      frame.delayMs = frame.delayMs ? Math.max(12, Math.round(frame.delayMs * scale)) : 0;
    });
  }

  return frames;
}

module.exports = {
  FIRST_FRAME_WORDS,
  MAX_REVEAL_DURATION_MS,
  REVEAL_PACING,
  createMegRevealPlan,
  revealPacingForWait,
};
