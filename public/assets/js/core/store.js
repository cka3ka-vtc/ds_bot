class Store {
  constructor() {
    this.state = {
      user: null,
      bots: [],
      activeBotId: null,
      guilds: [],
      activeGuildId: null,
    };
    this.listeners = new Set();
  }

  get(key) { return this.state[key]; }

  set(key, value) {
    if (this.state[key] === value) return;
    this.state[key] = value;
    this._emit(key, value);
  }

  patch(obj) {
    Object.assign(this.state, obj);
    this._emit('*', this.state);
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  _emit(key, value) {
    this.listeners.forEach(fn => {
      try { fn(key, value); } catch (err) { console.error(err); }
    });
  }
}

export const store = new Store();