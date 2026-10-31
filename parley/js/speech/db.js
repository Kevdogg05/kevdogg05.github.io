// Recordings live in IndexedDB on this device (never uploaded).
const NAME = 'parley', STORE = 'audio', KEEP = 15;

function open() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) { reject(new Error('no indexedDB')); return; }
    const req = indexedDB.open(NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const out = fn(t.objectStore(STORE));
    t.oncomplete = () => { db.close(); resolve(out?.result ?? out); };
    t.onerror = () => { db.close(); reject(t.error); };
  });
}

export async function putAudio(id, blob) {
  try {
    await tx('readwrite', (s) => s.put({ id, blob, at: Date.now() }));
    const all = await tx('readonly', (s) => s.getAllKeys());
    const keys = [...all].sort();            // ids start with a timestamp
    for (const k of keys.slice(0, Math.max(0, keys.length - KEEP))) await tx('readwrite', (s) => s.delete(k));
  } catch { /* storage unavailable: results still save, just without replay */ }
}

export async function getAudio(id) {
  try { return (await tx('readonly', (s) => s.get(id)))?.blob || null; } catch { return null; }
}

export async function deleteAudio(id) {
  try { await tx('readwrite', (s) => s.delete(id)); } catch { /* ignore */ }
}

export async function clearAudio() {
  try { await tx('readwrite', (s) => s.clear()); } catch { /* ignore */ }
}
