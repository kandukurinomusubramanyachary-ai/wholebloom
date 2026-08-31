class RateLimiter {
  constructor({ limit = 0, windowMs = 60000, now = () => Date.now() } = {}) { this.limit = Math.max(0, Number(limit) || 0); this.windowMs = windowMs; this.now = now; this.buckets = new Map(); }
  allow(key = 'unknown') {
    if (!this.limit) return true;
    const now = this.now();
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.expiresAt <= now) { this.buckets.set(key, { count: 1, expiresAt: now + this.windowMs }); return true; }
    if (bucket.count >= this.limit) return false;
    bucket.count += 1;
    return true;
  }
  size() { return this.buckets.size; }
}
module.exports = { RateLimiter };
