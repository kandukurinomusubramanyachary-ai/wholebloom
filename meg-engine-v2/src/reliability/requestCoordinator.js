class RequestCoordinator {
  constructor() {
    this.active = new Map();
  }

  begin(key) {
    if (!key) return { owner: true, promise: null, resolve: null, reject: null };
    const current = this.active.get(key);
    if (current) return { owner: false, promise: current.promise };
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    promise.catch(() => {});
    this.active.set(key, { promise, resolve, reject, startedAt: Date.now() });
    return { owner: true, promise, resolve: (value) => this.finish(key, value), reject: (error) => this.fail(key, error) };
  }

  finish(key, result) {
    if (!key) return;
    const current = this.active.get(key);
    if (!current) return;
    current.resolve(result);
    this.active.delete(key);
  }

  fail(key, error) {
    if (!key) return;
    const current = this.active.get(key);
    if (!current) return;
    current.reject(error);
    this.active.delete(key);
  }

  get(key) { return this.active.get(key); }
  size() { return this.active.size; }
}

module.exports = { RequestCoordinator };
