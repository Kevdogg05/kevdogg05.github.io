// Tiny state containers. A store holds one value, notifies subscribers on
// every change and (when given a key) keeps the value in localStorage so the
// cart, RSVPs and saved videos survive a reload.

const PREFIX = 'rqf:';

function read(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw == null ? undefined : JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Private mode or storage full: state still works for this visit.
  }
}

export function createStore(initial, key) {
  let value = key ? read(key) ?? initial : initial;
  const subscribers = new Set();
  return {
    get: () => value,
    set(next) {
      value = typeof next === 'function' ? next(value) : next;
      if (key) write(key, value);
      subscribers.forEach((fn) => fn(value));
    },
    subscribe(fn) {
      subscribers.add(fn);
      fn(value);
      return () => subscribers.delete(fn);
    },
  };
}
