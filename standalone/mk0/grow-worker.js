
// module: /standalone/mk0/grow-worker.js
// version: 1.0.0
// last-updated: 2026-01-27
// author: Apo77o + Copilot
// status: active
// changes:
// - 2026-01-27: Initial version
// depends-on: none
// provides: grow-worker
/** @param {NS} ns **/
export async function main(ns) {
    while (true) await ns.grow(ns.args[0]);
}

