// /corp/modules/telemetry.js
import { atomicWrite, acquireLock, releaseLock } from "/corp/modules/ipc.js";
function nowIso() { return new Date().toISOString(); }
function tsForFilename() { return new Date().toISOString().replace(/[:.]/g, "-"); }
function countLines(ns, path) { if (!ns.fileExists(path)) return 0; const raw = ns.read(path); if (!raw) return 0; return raw.trim().split("\n").filter(Boolean).length; }
export async function rotateIfNeeded(ns, logPath, maxLines, cfg) {
  try {
    if (!ns.fileExists(logPath)) return;
    const lines = countLines(ns, logPath);
    if (lines < maxLines) return;
    const locksDir = cfg.paths.locksDir;
    const lockName = `rotate-${logPath.replace(/\//g, "_")}`;
    const locked = await acquireLock(ns, locksDir, lockName, cfg.locks.lockTimeoutMs);
    if (!locked) return;
    try {
      const ts = tsForFilename();
      const rotated = `${logPath}.${ts}`;
      const raw = ns.read(logPath);
      await atomicWrite(ns, rotated, raw);
      const indexPath = "/data/rotated-index.json";
      let index = [];
      if (ns.fileExists(indexPath)) { try { index = JSON.parse(ns.read(indexPath)); } catch { index = []; } }
      index.push({ file: rotated, ts: nowIso(), lines: raw.trim() ? raw.trim().split("\n").length : 0 });
      await atomicWrite(ns, indexPath, JSON.stringify(index, null, 2));
      await atomicWrite(ns, logPath, "");
      await pruneRotated(ns, indexPath, cfg.telemetry.rotateKeepFiles, cfg);
    } finally { await releaseLock(ns, locksDir, lockName); }
  } catch (e) { ns.print("telemetry.rotateIfNeeded error: " + e); }
}
export async function snapshotAggregates(ns, logPath, aggregatePath, windowsMs, sampleIntervalSec, cfg) {
  try {
    if (!ns.fileExists(logPath)) return;
    const raw = ns.read(logPath).trim();
    if (!raw) return;
    const lines = raw.split("\n").map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    const now = Date.now();
    const windows = {};
    for (const [name, ms] of Object.entries(windowsMs)) {
      if (!isFinite(ms)) windows[name] = computeAggregates(lines);
      else { const cutoff = now - ms; const subset = lines.filter(r => r.ts >= cutoff); windows[name] = computeAggregates(subset); }
    }
    const payload = { ts: nowIso(), windows };
    await atomicWrite(ns, aggregatePath, JSON.stringify(payload, null, 2));
  } catch (e) { ns.print("telemetry.snapshotAggregates error: " + e); }
}
export async function pruneRotated(ns, rotatedIndexPath, keepN, cfg) {
  try {
    if (!ns.fileExists(rotatedIndexPath)) return;
    let index = [];
    try { index = JSON.parse(ns.read(rotatedIndexPath)); } catch { index = []; }
    if (index.length <= keepN) return;
    index.sort((a,b) => new Date(a.ts) - new Date(b.ts));
    const toDelete = index.slice(0, Math.max(0, index.length - keepN));
    const remaining = index.slice(Math.max(0, index.length - keepN));
    for (const e of toDelete) { try { if (ns.fileExists(e.file)) await ns.rm(e.file); } catch {} }
    await atomicWrite(ns, rotatedIndexPath, JSON.stringify(remaining, null, 2));
  } catch (e) { ns.print("telemetry.pruneRotated error: " + e); }
}
function computeAggregates(records) {
  if (!records || records.length === 0) return {};
  const n = records.length;
  const profits = records.map(r => r.profit || 0);
  const revenues = records.map(r => r.revenue || 0);
  const sold = records.map(r => r.sold || 0);
  const sumProfit = profits.reduce((a,b)=>a+b,0);
  const sumRevenue = revenues.reduce((a,b)=>a+b,0);
  const sumSold = sold.reduce((a,b)=>a+b,0);
  const meanProfit = sumProfit / n;
  const stdProfit = Math.sqrt(profits.reduce((a,b)=>a + Math.pow(b - meanProfit,2),0) / n);
  return { count: n, sumProfit, sumRevenue, sumSold, meanProfit, stdProfit, medianProfit: median(profits) };
}
function median(arr) { if (!arr || arr.length === 0) return 0; const s = arr.slice().sort((a,b)=>a-b); const m = Math.floor(s.length/2); return s.length % 2 ? s[m] : (s[m-1] + s[m]) / 2; }
