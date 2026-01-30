// /standalone/mk0/worker-grow.js
// Version: v0.2
// Dependencies: None
// Merged Change: Removed checks; ES6+; Doc: Light dies post-grow. Optimized: Base 1.75GB min.

/** @param {NS} ns */
export async function main(ns) {
  const [target] = ns.args;
  await ns.grow(target);  // Die post
}