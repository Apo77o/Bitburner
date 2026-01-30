// /standalone/mk0/worker-hack.js
// Version: v0.2
// Dependencies: None
// Merged Change: Removed root check for 0.05GB save; ES6+ async; Doc: Ultra-light—dies post-hack. Optimized: No logs/extras (1.7GB base).

/** @param {NS} ns */
export async function main(ns) {
  const [target] = ns.args;
  await ns.hack(target);  // Die post
}