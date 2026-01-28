// /corp/modules/index_init.js
import { atomicWrite } from "/corp/modules/ipc.js";
const DEFAULTS = { txnIndex: [], rotatedIndex: [], eventsProcessedIdx: 0 };
export async function ensureIndexes(ns, cfg) {
  const paths = (cfg && cfg.paths) ? cfg.paths : { txnIndex: "/data/txn-index.json", rotatedIndex: "/data/rotated-index.json", eventsProcessedIdx: "/data/events-processed.idx" };
  const txnIndexPath = paths.txnIndex || "/data/txn-index.json";
  const rotatedIndexPath = paths.rotatedIndex || "/data/rotated-index.json";
  const eventsProcessedIdxPath = paths.processedIndexPath || paths.eventsProcessedIdx || "/data/events-processed.idx";
  let txnIndex = DEFAULTS.txnIndex;
  if (!ns.fileExists(txnIndexPath)) { await atomicWrite(ns, txnIndexPath, JSON.stringify(txnIndex, null, 2)); ns.print(`index_init: created ${txnIndexPath}`); }
  else { try { const raw = ns.read(txnIndexPath); txnIndex = raw.trim() ? JSON.parse(raw) : []; if (!Array.isArray(txnIndex)) throw new Error("txn-index not array"); } catch (e) { const backup = txnIndexPath + ".corrupt." + Date.now(); try { await atomicWrite(ns, backup, ns.read(txnIndexPath)); } catch {} txnIndex = DEFAULTS.txnIndex; await atomicWrite(ns, txnIndexPath, JSON.stringify(txnIndex, null, 2)); ns.print(`index_init: repaired corrupt ${txnIndexPath}, backup -> ${backup}`); } }
  let rotatedIndex = DEFAULTS.rotatedIndex;
  if (!ns.fileExists(rotatedIndexPath)) { await atomicWrite(ns, rotatedIndexPath, JSON.stringify(rotatedIndex, null, 2)); ns.print(`index_init: created ${rotatedIndexPath}`); }
  else { try { const raw = ns.read(rotatedIndexPath); rotatedIndex = raw.trim() ? JSON.parse(raw) : []; if (!Array.isArray(rotatedIndex)) throw new Error("rotated-index not array"); } catch (e) { const backup = rotatedIndexPath + ".corrupt." + Date.now(); try { await atomicWrite(ns, backup, ns.read(rotatedIndexPath)); } catch {} rotatedIndex = DEFAULTS.rotatedIndex; await atomicWrite(ns, rotatedIndexPath, JSON.stringify(rotatedIndex, null, 2)); ns.print(`index_init: repaired corrupt ${rotatedIndexPath}, backup -> ${backup}`); } }
  let eventsIdx = DEFAULTS.eventsProcessedIdx;
  if (!ns.fileExists(eventsProcessedIdxPath)) { await atomicWrite(ns, eventsProcessedIdxPath, String(eventsIdx)); ns.print(`index_init: created ${eventsProcessedIdxPath}`); }
  else { try { const raw = ns.read(eventsProcessedIdxPath).trim(); eventsIdx = raw === "" ? 0 : Number(raw); if (!Number.isFinite(eventsIdx) || eventsIdx < 0) throw new Error("invalid events index"); } catch (e) { const backup = eventsProcessedIdxPath + ".corrupt." + Date.now(); try { await atomicWrite(ns, backup, ns.read(eventsProcessedIdxPath)); } catch {} eventsIdx = DEFAULTS.eventsProcessedIdx; await atomicWrite(ns, eventsProcessedIdxPath, String(eventsIdx)); ns.print(`index_init: repaired corrupt ${eventsProcessedIdxPath}, backup -> ${backup}`); } }
  return { txnIndexPath, rotatedIndexPath, eventsProcessedIdxPath, txnIndex, rotatedIndex, eventsIdx };
}
