
// module: /standalone/mk0/hacknet-manager.js
// version: 1.0.0
// last-updated: 2026-01-27
// author: Apo77o + Copilot
// status: active
// changes:
// - 2026-01-27: Initial version, buys/upgrades hacknet nodes for best $/sec per $ spent
// depends-on: none
// provides: hacknet-manager

/** @param {NS} ns **/
export async function main(ns) {
    let spent = 0;
    const minNodes = 10;
    const maxSpent = 1e9;

    // Helper to get best upgrade/new node option
    function getBestUpgrade() {
        let best = { type: "none", index: -1, cost: Infinity, gain: 0, ratio: 0 };
        // New node
        if (ns.hacknet.numNodes() < ns.hacknet.maxNumNodes()) {
            const cost = ns.hacknet.getPurchaseNodeCost();
            const gain = ns.hacknet.numNodes() < minNodes ? 1 : 0; // Encourage buying up to minNodes
            if (cost < best.cost) best = { type: "new", index: -1, cost, gain, ratio: gain / cost };
        }
        // Upgrades
        for (let i = 0; i < ns.hacknet.numNodes(); i++) {
            const prod = ns.hacknet.getNodeStats(i).production;
            // Level
            const lvlCost = ns.hacknet.getLevelUpgradeCost(i, 1);
            const lvlGain = prod * 0.01; // Approximate
            if (lvlCost < best.cost && lvlGain / lvlCost > best.ratio) best = { type: "level", index: i, cost: lvlCost, gain: lvlGain, ratio: lvlGain / lvlCost };
            // RAM
            const ramCost = ns.hacknet.getRamUpgradeCost(i, 1);
            const ramGain = prod * 0.5; // Approximate
            if (ramCost < best.cost && ramGain / ramCost > best.ratio) best = { type: "ram", index: i, cost: ramCost, gain: ramGain, ratio: ramGain / ramCost };
            // Cores
            const coreCost = ns.hacknet.getCoreUpgradeCost(i, 1);
            const coreGain = prod * 0.2; // Approximate
            if (coreCost < best.cost && coreGain / coreCost > best.ratio) best = { type: "core", index: i, cost: coreCost, gain: coreGain, ratio: coreGain / coreCost };
        }
        return best;
    }

    while (true) {
        // Stop buying new nodes if spent >= $1B and have at least 10 nodes
        if (spent >= maxSpent && ns.hacknet.numNodes() >= minNodes) {
            // Only upgrade existing nodes
            let allMaxed = true;
            for (let i = 0; i < ns.hacknet.numNodes(); i++) {
                const stats = ns.hacknet.getNodeStats(i);
                if (stats.level < 200 || stats.ram < 64 || stats.cores < 16) {
                    allMaxed = false;
                    break;
                }
            }
            if (allMaxed) {
                ns.tprint("hacknet-manager: All nodes maxed and $1B+ spent. Done.");
                return;
            }
        }

        const best = getBestUpgrade();
        if (best.cost === Infinity || ns.getServerMoneyAvailable("home") < best.cost) {
            await ns.sleep(5000);
            continue;
        }

        if (best.type === "new" && (spent < maxSpent || ns.hacknet.numNodes() < minNodes)) {
            ns.hacknet.purchaseNode();
            spent += best.cost;
        } else if (best.type === "level") {
            ns.hacknet.upgradeLevel(best.index, 1);
            spent += best.cost;
        } else if (best.type === "ram") {
            ns.hacknet.upgradeRam(best.index, 1);
            spent += best.cost;
        } else if (best.type === "core") {
            ns.hacknet.upgradeCore(best.index, 1);
            spent += best.cost;
        }
        await ns.sleep(1000);
    }
}
