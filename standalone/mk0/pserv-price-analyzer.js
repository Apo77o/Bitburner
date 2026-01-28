
// module: /standalone/mk0/pserv-price-analyzer.js
// version: 1.1.0
// last-updated: 2026-01-27
// author: Apo77o + Copilot
// status: active
// changes:
// - 2026-01-27: Use ns.formatNumber, add max tier to cumulative cost, improved table alignment
// depends-on: none
// provides: pserv-price-analysis

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog("ALL");
    if (ns.ui?.openTail) ns.ui.openTail();

    const maxServers = ns.getPurchasedServerLimit();
    const maxRam = ns.getPurchasedServerMaxRam();
    let ram = 2;
    let tier = 0;
    let totalCost = 0;
    let log = [];
    let table = [];
    let maxTier = 0;

    log.push("Tier |   RAM (GB)   |   Cost (1)   |   Cost (25)   |  Total RAM (25)  |  Cumulative Cost");
    log.push("-----|-------------|-------------|--------------|------------------|------------------");

    // Calculate all tiers up to maxRam
    while (ram <= maxRam) {
        const cost1 = ns.getPurchasedServerCost(ram);
        const cost25 = cost1 * maxServers;
        const totalRam = ram * maxServers;
        // For cumulative cost, include max tier in this version
        totalCost += cost25;
        table.push({ tier, ram, cost1, cost25, totalRam, totalCost });
        log.push(
            `${tier.toString().padEnd(4)}|` +
            `${ram.toString().padStart(11)}   |` +
            `${ns.formatNumber(cost1).padStart(11)}   |` +
            `${ns.formatNumber(cost25).padStart(12)}   |` +
            `${totalRam.toString().padStart(14)}    |` +
            `${ns.formatNumber(totalCost).padStart(14)}`
        );
        if (ram === maxRam) maxTier = tier;
        ram *= 2;
        tier++;
    }

    // Max RAM info
    const maxCost1 = ns.getPurchasedServerCost(maxRam);
    const maxCost25 = maxCost1 * maxServers;
    log.push("");
    log.push(`Max RAM per p-serv: ${maxRam} GB`);
    log.push(`Cost for 1 max RAM p-serv: ${ns.formatNumber(maxCost1)}`);
    log.push(`Cost for 25 max RAM p-servs: ${ns.formatNumber(maxCost25)}`);
    log.push(`Number of 2x upgrades to reach max: ${maxTier}`);
    log.push(`Cumulative cost for all upgrades (including max tier): ${ns.formatNumber(totalCost)}`);

    // Write to file
    await ns.write("/standalone/mk0/pserv-price-analysis.txt", log.join("\n"), "w");

    // Display table in tail window
    ns.print(log.join("\n"));
}
``
