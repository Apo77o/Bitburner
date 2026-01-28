// /main/autopilot.js
import { loadState, saveState } from "/utils/files.js";
import { DEBUG } from "/utils/config.js";
import { openLog } from "/utils/ui.js";

import { runScanner } from "/core/scanner.js";
import { runBatcher } from "/core/batcher.js";
import { runDeployer } from "/core/deployer.js";
import { runHacknet } from "/core/hacknet.js";
import { runProgramPurchaser } from "/core/program-purchaser.js";
import { runPservManager } from "/core/pserv-manager.js";
import { runHomeUpgrader } from "/core/home-upgrader.js";
import { runXPPlanner } from "/core/xp-planner.js";
import { runRepPlanner } from "/core/rep-planner.js";
import { runMoneyPlanner } from "/core/money-planner.js";

import { runStockManager } from "/stock/stock-basic.js";
import { runStockTIX } from "/stock/stock-tix.js";
import { runStockPortfolio } from "/stock/stock-portfolio.js";

import { runBackdoorManager } from "/singularity/backdoor-manager.js";
import { runFactionManager } from "/singularity/faction-manager.js";
import { runWorkManager } from "/singularity/work-manager.js";
import { runAugPurchaser } from "/singularity/aug-purchaser.js";
import { runResetManager } from "/singularity/reset-manager.js";

import { runCorpBasic } from "/corp/corp-basic.js";
import { runCorpAdvanced } from "/corp/corp-advanced.js";
import { runCorpStrategy } from "/corp/corp-strategy.js";

import { runFormulasBatcher } from "/formulas/formulas-batcher.js";
import { runFormulasTargeting } from "/formulas/formulas-targeting.js";

import { runBladeburner } from "/bladeburner/bb-manager.js";
import { runBBContracts } from "/bladeburner/bb-contracts.js";
import { runBBOperations } from "/bladeburner/bb-operations.js";
import { runBBSkills } from "/bladeburner/bb-skills.js";

import { runCrimeBasic } from "/crime/crime-basic.js";
import { runCrimeManager } from "/crime/crime-advanced.js";

import { runSleeveManager } from "/sleeves/sleeve-manager.js";
import { runSleeveCrime } from "/sleeves/sleeve-crime.js";
import { runSleeveWork } from "/sleeves/sleeve-work.js";
import { runSleeveAugments } from "/sleeves/sleeve-augments.js";

import { runStanekLayout } from "/stanek/stanek-layout.js";
import { runStanekCharger } from "/stanek/stanek-charger.js";
import { runStanek } from "/stanek/stanek-optimizer.js";

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog("ALL");
    if (DEBUG) openLog(ns);

    const state = loadState(ns) || {
        cycle: 0,
        lastReset: Date.now(),
        lastAugPurchase: 0,
        lastCorpTick: 0,
        lastStockTick: 0,
        lastBatchUpdate: 0,
        lastDeploy: 0,
    };

    while (true) {
        state.cycle++;

        await runScanner(ns, state);
        await runProgramPurchaser(ns, state);
        await runHacknet(ns, state);
        await runPservManager(ns, state);
        await runHomeUpgrader(ns, state);
        await runXPPlanner(ns, state);
        await runRepPlanner(ns, state);
        await runMoneyPlanner(ns, state);

        await runBatcher(ns, state);
        await runDeployer(ns, state);

        if (ns.getPlayer().hasTixApiAccess) {
            await runStockTIX(ns, state);
            await runStockPortfolio(ns, state);
        } else {
            await runStockManager(ns, state);
        }

        if (ns.singularity) {
            await runBackdoorManager(ns, state);
            await runFactionManager(ns, state);
            await runWorkManager(ns, state);
            await runAugPurchaser(ns, state);
            await runResetManager(ns, state);
        }

        if (ns.corporation) {
            await runCorpBasic(ns, state);
            await runCorpAdvanced(ns, state);
            await runCorpStrategy(ns, state);
        }

        if (ns.formulas) {
            await runFormulasTargeting(ns, state);
            await runFormulasBatcher(ns, state);
        }

        if (ns.bladeburner) {
            await runBladeburner(ns, state);
            await runBBContracts(ns, state);
            await runBBOperations(ns, state);
            await runBBSkills(ns, state);
        }

        await runCrimeBasic(ns, state);
        await runCrimeManager(ns, state);

        if (ns.sleeve) {
            await runSleeveManager(ns, state);
            await runSleeveCrime(ns, state);
            await runSleeveWork(ns, state);
            await runSleeveAugments(ns, state);
        }

        if (ns.stanek) {
            await runStanekLayout(ns, state);
            await runStanekCharger(ns, state);
            await runStanek(ns, state);
        }

        saveState(ns, state);
        await ns.sleep(2000);
    }
}
