// /main/manager.js
/** Dynamic module loader with missing-module logging */

import { DEBUG } from "/utils/config.js";
import { openLog } from "/utils/ui.js";

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog("ALL");
    if (DEBUG) openLog(ns);

    const hasSF = (n) => ns.getOwnedSourceFiles().some(sf => sf.n === n);

    const MODULES = [
        { name: "scanner",            path: "/core/scanner.js",            interval: 5000,  requiresSF: null },
        { name: "batcher",            path: "/core/batcher.js",            interval: 2000,  requiresSF: null },
        { name: "deployer",           path: "/core/deployer.js",           interval: 8000,  requiresSF: null },
        { name: "hacknet",            path: "/core/hacknet.js",            interval: 6000,  requiresSF: null },
        { name: "program-purchaser",  path: "/core/program-purchaser.js",  interval: 15000, requiresSF: null },
        { name: "pserv-manager",      path: "/core/pserv-manager.js",      interval: 10000, requiresSF: null },
        { name: "home-upgrader",      path: "/core/home-upgrader.js",      interval: 20000, requiresSF: null },
        { name: "xp-planner",         path: "/core/xp-planner.js",         interval: 12000, requiresSF: null },
        { name: "rep-planner",        path: "/core/rep-planner.js",        interval: 15000, requiresSF: null },
        { name: "money-planner",      path: "/core/money-planner.js",      interval: 7000,  requiresSF: null },

        { name: "stock-basic",        path: "/stock/stock-basic.js",       interval: 8000,  requiresSF: null },
        { name: "stock-tix",          path: "/stock/stock-tix.js",         interval: 5000,  requiresSF: 8 },
        { name: "stock-portfolio",    path: "/stock/stock-portfolio.js",   interval: 10000, requiresSF: 8 },

        { name: "backdoor-manager",   path: "/singularity/backdoor-manager.js",   interval: 10000, requiresSF: 2 },
        { name: "faction-manager",    path: "/singularity/faction-manager.js",    interval: 8000,  requiresSF: 2 },
        { name: "work-manager",       path: "/singularity/work-manager.js",       interval: 8000,  requiresSF: 2 },
        { name: "aug-purchaser",      path: "/singularity/aug-purchaser.js",      interval: 15000, requiresSF: 2 },
        { name: "reset-manager",      path: "/singularity/reset-manager.js",      interval: 20000, requiresSF: 2 },

        { name: "corp-basic",         path: "/corp/corp-basic.js",         interval: 8000,  requiresSF: 3 },
        { name: "corp-advanced",      path: "/corp/corp-advanced.js",      interval: 12000, requiresSF: 3 },
        { name: "corp-strategy",      path: "/corp/corp-strategy.js",      interval: 20000, requiresSF: 3 },

        { name: "formulas-batcher",   path: "/formulas/formulas-batcher.js",   interval: 3000, requiresSF: 4 },
        { name: "formulas-targeting", path: "/formulas/formulas-targeting.js", interval: 5000, requiresSF: 4 },

        { name: "bb-manager",         path: "/bladeburner/bb-manager.js",   interval: 5000, requiresSF: 6 },
        { name: "bb-contracts",       path: "/bladeburner/bb-contracts.js", interval: 6000, requiresSF: 6 },
        { name: "bb-operations",      path: "/bladeburner/bb-operations.js",interval: 6000, requiresSF: 6 },
        { name: "bb-skills",          path: "/bladeburner/bb-skills.js",    interval: 15000,requiresSF: 6 },

        { name: "crime-basic",        path: "/crime/crime-basic.js",        interval: 8000, requiresSF: 7 },
        { name: "crime-advanced",     path: "/crime/crime-advanced.js",     interval: 8000, requiresSF: 7 },

        { name: "sleeve-manager",     path: "/sleeves/sleeve-manager.js",   interval: 5000, requiresSF: 10 },
        { name: "sleeve-crime",       path: "/sleeves/sleeve-crime.js",     interval: 6000, requiresSF: 10 },
        { name: "sleeve-work",        path: "/sleeves/sleeve-work.js",      interval: 6000, requiresSF: 10 },
        { name: "sleeve-augments",    path: "/sleeves/sleeve-augments.js",  interval: 15000,requiresSF: 10 },

        { name: "stanek-layout",      path: "/stanek/stanek-layout.js",     interval: 15000,requiresSF: 13 },
        { name: "stanek-charger",     path: "/stanek/stanek-charger.js",    interval: 5000, requiresSF: 13 },
        { name: "stanek-optimizer",   path: "/stanek/stanek-optimizer.js",  interval: 20000,requiresSF: 13 },
    ];

    for (const mod of MODULES) {
        if (mod.requiresSF && !hasSF(mod.requiresSF)) continue;

        if (!ns.fileExists(mod.path)) {
            await recordMissingModule(ns, mod);
            continue;
        }

        ns.scriptKill(mod.path, "home");
        runModuleLoop(ns, mod);
    }

    ns.tprint("Manager: All eligible modules launched.");
}

async function recordMissingModule(ns, mod) {
    const msg = `${new Date().toISOString()} - Missing module: ${mod.name} (${mod.path})\n`;
    await ns.write("/data/missing-modules.txt", msg, "a");
}

async function runModuleLoop(ns, mod) {
    ns.tprint(`Manager: Starting module ${mod.name}`);
    while (true) {
        try {
            ns.run(mod.path, 1);
        } catch (err) {
            ns.print(`Error in module ${mod.name}: ${err}`);
        }
        await ns.sleep(mod.interval);
    }
}
