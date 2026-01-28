// /corp/corp-startup.js
import { CORP_CONFIG } from "/corp/config.js";

/** @param {NS} ns **/
export async function main(ns) {
  ns.disableLog("sleep");
  const args = ns.flags([["investors", CORP_CONFIG.defaultUseInvestors ?? false], ["name", CORP_CONFIG.defaultName], ["ticker", CORP_CONFIG.defaultTicker], ["ultralite", false]]);
  const corpName = args.name || CORP_CONFIG.defaultName;
  const useInvestors = !!args.investors;
  if (!ns.corporation) { ns.tprint("ERROR: Corporation API not available."); return; }
  if (ns.corporation.hasCorporation()) { ns.tprint("Corporation already exists. Aborting startup."); return; }
  ns.tprint(`Creating corporation '${corpName}' (investors=${useInvestors})...`);
  ns.corporation.createCorporation(corpName, useInvestors);
  await ns.write("/data/corp-startup-config.json", JSON.stringify({ corpName, ticker: args.ticker, useInvestors, ultralite: !!args.ultralite }, null, 2), "w");
  for (const d of (CORP_STRATEGY?.initialDivisions ?? [{ industry: "Agriculture", name: "Agri" }])) {
    try { ns.corporation.expandIndustry(d.industry, d.name); ns.corporation.expandCity(d.name, "Sector-12"); ns.corporation.setSmartSupply(d.name, "Sector-12", true); } catch {}
  }
  await ns.write("/data/corp-mode.txt", "NORMAL", "w");
  ns.tprint("Startup complete.");
}
