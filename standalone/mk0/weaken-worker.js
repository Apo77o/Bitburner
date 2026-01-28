
// module: /standalone/mk0/weaken-worker.js
// version: 1.0.0
// last-updated: 2026-01-27
// author: Apo77o + Copilot
// status: active
// changes:
// - 2026-01-27: Minimal, RAM-light
/** @param {NS} ns **/
export async function main(ns) {
    while (true) await ns.weaken(ns.args[0]);
}

