
// module: /standalone/mk0/ram-usage-checker.js
// version: 1.0.0
// last-updated: 2026-01-27
// author: Apo77o + Copilot
// status: active
// changes:
// - 2026-01-27: Initial version
// depends-on: none
// provides: ram-usage-checker

/** @param {NS} ns **/
export async function main(ns) {
    const script = "/standalone/mk0/scan-analyze-world.js";
    const ram = ns.getScriptRam(script, "home");
    ns.tprint(`RAM usage of ${script}: ${ram} GB`);
    // Optionally write to a file for deployer/ram-reserve-setter to read
    await ns.write("/standalone/mk0/ram-usage.txt", ram.toString(), "w");
}
