
// module: /standalone/mk0/pserv-manager.js
// version: 1.0.0
// last-updated: 2026-01-27
// author: Apo77o + Copilot
// status: active
// changes:
// - 2026-01-27: Initial version, buys/upgrades p-servs to 1024GB
// depends-on: none
// provides: pserv-manager

/** @param {NS} ns **/
export async function main(ns) {
    const maxServers = ns.getPurchasedServerLimit();
    const maxRam = 1024;
    let ram = 2;

    // Step 1: Buy 25 2GB servers
    while (ns.getPurchasedServers().length < maxServers) {
        for (let i = 0; i < maxServers; i++) {
            const name = "pserv-" + i;
            if (!ns.serverExists(name)) {
                if (ns.getServerMoneyAvailable("home") >= ns.getPurchasedServerCost(ram)) {
                    ns.purchaseServer(name, ram);
                }
            }
        }
        await ns.sleep(5000);
    }

    // Step 2: Upgrade all to 1024GB
    while (ram < maxRam) {
        ram *= 2;
        for (const name of ns.getPurchasedServers()) {
            if (ns.getServerMaxRam(name) < ram) {
                // Gracefully kill scripts before deleting
                ns.killall(name);
                ns.deleteServer(name);
                while (ns.getServerMoneyAvailable("home") < ns.getPurchasedServerCost(ram)) {
                    await ns.sleep(5000);
                }
                ns.purchaseServer(name, ram);
            }
        }
        await ns.sleep(5000);
    }
    ns.tprint("pserv-manager: All purchased servers upgraded to 1024GB. Done.");
}
