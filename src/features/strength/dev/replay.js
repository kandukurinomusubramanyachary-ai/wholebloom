function replayTimeline(engine, timeline) {
  if (!engine || typeof engine.process !== 'function') throw new Error('A Strength engine is required.');
  return (Array.isArray(timeline) ? timeline : []).map((entry) => engine.process(entry));
}

module.exports = { replayTimeline };
