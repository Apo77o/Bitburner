// /corp/corp-investment-prep.js
/** @param {NS} ns **/
export async function main(ns) {
  ns.disableLog("sleep");
  if (!ns.corporation || !ns.corporation.hasCorporation()) { ns.tprint("No corporation found."); return; }
  const args = ns.flags([["ipo", false]]);
  const mode = args.ipo ? "IPO" : "INVESTORS";
  await ns.write("/data/corp-mode.txt", mode, "w");
  ns.tprint(`Corp investment mode set to ${mode}.`);
}
