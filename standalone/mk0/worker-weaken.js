// /standalone/mk0/worker-weaken.js
// Version: v0.2
// Dependencies: None
// Merged Change: Removed checks; ES6+; Doc: Light dies post-weaken. Optimized: Base 1.75GB, caution bias.

/** @param {NS} ns */
export async function main(ns) {
  const [target] = ns.args;
  await ns.weaken(target);  // Die post
}