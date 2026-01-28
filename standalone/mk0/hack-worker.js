
// module: /standalone/mk0/hack-worker.js
// version: 1.0.0
// last-updated: 2026-01-27
// author: Apo77o + Copilot
// status: active
// changes:
// - 2026-01-27: Initial version
// depends-on: none
// provides: hack-worker
/** @param {NS} ns **/
export async function main(ns) {
    while (true) await ns.hack(ns.args[0]);
}

