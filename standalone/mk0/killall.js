// /standalone/mk0/killall.js
// Version: v0.2
// Dependencies: None
// Merged Change: ES6+ sets/filter; Doc: Non-home first, home last, filter self/running/current (getScriptName/pid). Resilient: Skip non-root/low-RAM (RAM>0). Optimized: Single scan.

/** @param {NS} ns */
export async function main(ns) {
  const visited = new Set(['home']);
  const stack = ns.scan('home');
  const nonHome = [];
  let homeProcs = ns.ps('home').filter(p => p.filename !== ns.getScriptName() && p.pid !== ns.getRunningScript().pid);  // Filter self/running/current

  while (stack.length) {
    const srv = stack.pop();
    if (visited.has(srv)) continue;
    visited.add(srv);
    stack.push(...ns.scan(srv));

    if (srv === 'home') continue;
    if (ns.hasRootAccess(srv) && ns.getServerMaxRam(srv) > 0) nonHome.push(srv);
  }

  // Kill non-home
  for (const srv of nonHome) {
    ns.killall(srv);
  }

  // Kill home last
  for (const proc of homeProcs) {
    ns.kill(proc.pid);
  }

  ns.tprint('[MK0 KILLALL v0.2] Complete—non-home first, skipped non-root/low-RAM');
}