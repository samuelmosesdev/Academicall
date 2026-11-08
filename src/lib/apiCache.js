const PREFIX = "ac:c1:";
const OWNER_KEY = `${PREFIX}owner`;
const MAX_ENTRIES = 40;
const MAX_ENTRY_BYTES = 400_000;
const memory = new Map();
const revisions = new Map();

function token() {
  try {
    return localStorage.getItem("academicall_token") || "";
  } catch {
    return "";
  }
}

function ownerFingerprint() {
  const value = token();
  if (!value) return "guest";
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) hash = ((hash << 5) + hash + value.charCodeAt(i)) | 0;
  return `u${(hash >>> 0).toString(36)}`;
}

function storageKeys() {
  const keys = [];
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key?.startsWith(PREFIX) && key !== OWNER_KEY) keys.push(key);
    }
  } catch {
    // The cache remains usable in memory when browser storage is unavailable.
  }
  return keys;
}

function ensureOwner() {
  const current = ownerFingerprint();
  try {
    if (localStorage.getItem(OWNER_KEY) !== current) {
      storageKeys().forEach((key) => localStorage.removeItem(key));
      memory.clear();
      localStorage.setItem(OWNER_KEY, current);
    }
  } catch {
    // Storage is optional; the in-memory cache is still scoped to the current page.
  }
  return current;
}

function rootOf(endpoint) {
  return `/${String(endpoint).split("?")[0].split("/").filter(Boolean)[0] || ""}`;
}

export function cacheOwner() {
  return ensureOwner();
}

export function cacheRevision(endpoint) {
  return revisions.get(rootOf(endpoint)) || 0;
}

export function readCache(endpoint, owner = ensureOwner()) {
  if (owner !== ensureOwner()) return null;
  const hit = memory.get(endpoint);
  if (hit) return hit;
  try {
    const raw = localStorage.getItem(PREFIX + endpoint);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (entry && typeof entry.at === "number") {
      memory.set(endpoint, entry);
      return entry;
    }
  } catch {
    // A corrupt or inaccessible entry is a cache miss.
  }
  return null;
}

export function writeCache(endpoint, data, { owner = ensureOwner(), revision = cacheRevision(endpoint) } = {}) {
  if (owner !== ensureOwner() || revision !== cacheRevision(endpoint)) return false;
  const entry = { at: Date.now(), data };
  memory.set(endpoint, entry);
  while (memory.size > MAX_ENTRIES) {
    const oldest = [...memory.entries()].reduce((a, b) => (a[1].at <= b[1].at ? a : b));
    memory.delete(oldest[0]);
  }
  try {
    const raw = JSON.stringify(entry);
    if (raw.length <= MAX_ENTRY_BYTES) {
      const keys = storageKeys();
      if (keys.length >= MAX_ENTRIES) {
        keys
          .map((key) => {
            try {
              return [key, JSON.parse(localStorage.getItem(key))?.at || 0];
            } catch {
              return [key, 0];
            }
          })
          .sort((a, b) => a[1] - b[1])
          .slice(0, keys.length - MAX_ENTRIES + 1)
          .forEach(([key]) => localStorage.removeItem(key));
      }
      localStorage.setItem(PREFIX + endpoint, raw);
    }
  } catch {
    // Quota and private-mode errors only disable persistence, not the memory cache.
  }
  return true;
}

export function invalidateFor(endpoint) {
  const root = rootOf(endpoint);
  if (root === "/") return;
  revisions.set(root, cacheRevision(root) + 1);
  for (const key of memory.keys()) {
    if (key === root || key.startsWith(`${root}/`) || key.startsWith(`${root}?`)) memory.delete(key);
  }
  storageKeys().forEach((key) => {
    const resource = key.slice(PREFIX.length);
    if (resource === root || resource.startsWith(`${root}/`) || resource.startsWith(`${root}?`)) {
      try {
        localStorage.removeItem(key);
      } catch {
        // Storage is optional; the revision still protects in-flight refreshes.
      }
    }
  });
}

export function clearApiCache() {
  memory.clear();
  try {
    storageKeys().forEach((key) => localStorage.removeItem(key));
    localStorage.removeItem(OWNER_KEY);
  } catch {
    // Storage is optional.
  }
}
