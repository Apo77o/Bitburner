// /corp/modules/ipc.js
export function nowIso() { return new Date().toISOString(); }
export async function atomicWrite(ns, path, content) {
  const tmp = path + ".tmp";
  await ns.write(tmp, content, "w");
  await ns.write(path, content, "w");
  try { await ns.rm(tmp); } catch {}
}
export async function acquireLock(ns, locksDir, name, lockTimeoutMs = 30000) {
  const lockPath = `${locksDir}/${name}.lock`;
  const payload = JSON.stringify({ pid: Math.floor(Math.random()*1e9), ts: nowIso() });
  if (ns.fileExists(lockPath)) {
    try { const raw = ns.read(lockPath); const obj = JSON.parse(raw); const age = Date.now() - new Date(obj.ts).getTime(); if (age > lockTimeoutMs) try { await ns.rm(lockPath); } catch {} else return false; } catch { try { await ns.rm(lockPath); } catch {} }
  }
  await atomicWrite(ns, lockPath, payload);
  return true;
}
export async function releaseLock(ns, locksDir, name) { try { await ns.rm(`${locksDir}/${name}.lock`); } catch {} }
export async function pushEvent(ns, eventsPath, eventObj) { const ev = Object.assign({ id: Math.floor(Math.random()*1e9), ts: nowIso() }, eventObj); await ns.write(eventsPath, JSON.stringify(ev) + "\n", "a"); }
export function readEvents(ns, eventsPath, processedIdxPath, maxLines = 200) {
  if (!ns.fileExists(eventsPath)) return { events: [], nextIndex: 0 };
  const raw = ns.read(eventsPath);
  const lines = raw.trim() ? raw.split("\n") : [];
  let start = 0;
  if (ns.fileExists(processedIdxPath)) { const idxRaw = ns.read(processedIdxPath).trim(); start = Number(idxRaw) || 0; }
  const slice = lines.slice(start, start + maxLines);
  const events = slice.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  return { events, nextIndex: start + slice.length };
}
export async function markProcessed(ns, processedIdxPath, newIndex) { await atomicWrite(ns, processedIdxPath, String(newIndex)); }
