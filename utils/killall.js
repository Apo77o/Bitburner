// /utils/killall.js
// Version: v0.1
// Dependencies: None
// Merged Change: ES6+ sets/arrays; Doc: Modular killall—non-home first, home last. Resilient: Root check/skip. Optimized: Single scan.
export async function killAllServers(ns) {
const visited = new Set(['home']);  // ES6+ Set for uniqueness
const stack = ns.scan('home');
const nonHome = [];
let homeProcs = [];
// Collect non-home
while (stack.length) {
const srv = stack.pop();
if (visited.has(srv)) continue;
visited.add(srv);
stack.push(...ns.scan(srv));
if (srv === 'home') {
homeProcs = ns.ps('home').filter(p => p.filename !== ns.getScriptName());  // Skip self
continue;
}
if (ns.hasRootAccess(srv) && ns.getServerMaxRam(srv) > 0) nonHome.push(srv);
}
// Kill non-home
for (const srv of nonHome) {
ns.killall(srv);  // Optimized: Built-in all-kill
}
// Kill home last (resilient: Filter running)
for (const proc of homeProcs) {
ns.kill(proc.pid);
}
ns.print('[KILLALL] Complete—non-home first, home last');
}