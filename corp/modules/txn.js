// /corp/modules/txn.js
import { atomicWrite } from "/corp/modules/ipc.js";
export function newTxnId() { return Math.floor(Math.random()*1e9).toString(); }
export async function createTxn(ns, id, steps) {
  const path = `/data/txn-${id}.json`;
  const payload = { id, ts: new Date().toISOString(), steps: steps.map(s => ({ name: s, status: "pending" })), status: "pending" };
  await atomicWrite(ns, path, JSON.stringify(payload, null, 2));
  // maintain txn-index
  const idxPath = "/data/txn-index.json";
  let idx = [];
  try { if (ns.fileExists(idxPath)) idx = JSON.parse(ns.read(idxPath)); } catch {}
  idx.push(id);
  await atomicWrite(ns, idxPath, JSON.stringify(idx, null, 2));
  return path;
}
export async function updateStep(ns, id, stepName, status, meta = {}) {
  const path = `/data/txn-${id}.json`;
  if (!ns.fileExists(path)) return;
  const raw = ns.read(path); let obj;
  try { obj = JSON.parse(raw); } catch { return; }
  const step = obj.steps.find(s => s.name === stepName);
  if (step) { step.status = status; step.meta = Object.assign(step.meta || {}, meta); }
  if (obj.steps.every(s => s.status === "done")) obj.status = "done";
  if (obj.steps.some(s => s.status === "failed")) obj.status = "failed";
  await atomicWrite(ns, path, JSON.stringify(obj, null, 2));
}
export function listIncompleteTxns(ns) {
  const idxPath = "/data/txn-index.json";
  if (!ns.fileExists(idxPath)) return [];
  try {
    const idx = JSON.parse(ns.read(idxPath));
    return idx.filter(id => { const p = `/data/txn-${id}.json`; if (!ns.fileExists(p)) return false; const obj = JSON.parse(ns.read(p)); return obj.status === "pending"; });
  } catch { return []; }
}
