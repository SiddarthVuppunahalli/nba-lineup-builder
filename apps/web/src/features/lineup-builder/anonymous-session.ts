const STORAGE_KEY = 'lineup-engine-anonymous-session';

export function anonymousSessionKey(): string {
  const existing = window.localStorage.getItem(STORAGE_KEY);
  if (existing) return existing;
  const created = window.crypto.randomUUID();
  window.localStorage.setItem(STORAGE_KEY, created);
  return created;
}
