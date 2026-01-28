
// module: /standalone/mk0/batcher-deployer-initializer.js
// version: 1.1.0
// last-updated: 2026-01-27
// author: Apo77o + Copilot
// status: active
// changes:
// - 2026-01-27: Merged startup/initializer, kills workers on all rooted servers, roots hackable servers

/** @param {NS} ns **/
export async function main(ns) {
    ns.tprint("Killing all scripts on all rooted servers...");
    const workerScripts = [
        "/standalone/mk0/hack-worker.js",
        "/standalone/mk0/grow-worker.js",
        "/standalone/mk0/weaken-worker.js"
    ];
    function scanAll() {
        const visited = new Set();
        const stack = ["home"];
        const servers = [];
        while (stack.length > 0) {
            const host = stack.pop();
            if (!visited.has(host)) {
                visited.add(host);
                servers.push(host);
                for (const neighbor of ns.scan(host)) {
                    if (!visited.has(neighbor)) stack.push(neighbor);
                }
            }
        }
        return servers;
    }
    const servers = scanAll();
    for (const host of servers) {
        if (ns.hasRootAccess(host)) {
            for (const script of workerScripts) {
                if (ns.scriptRunning(script, host)) ns.scriptKill(script, host);
            }
        }
    }
    ns.killall("home");
    await ns.sleep(1000);

    ns.tprint("Running ram-usage-checker.js...");
    ns.run("/standalone/mk0/ram-usage-checker.js");
    await ns.sleep(1000);

    ns.tprint("Setting RAM reserve to 0...");
    ns.run("/standalone/mk0/ram-reserve-setter.js", 1, 0);
    await ns.sleep(1000);

    ns.tprint("Running initializer-target-list.js...");
    ns.run("/standalone/mk0/initializer-target-list.js");
    await ns.sleep(2000);

    // Root hackable servers with RAM > 0
    const player = ns.getPlayer();
    let portOpeners = 0;
    if (ns.fileExists("BruteSSH.exe", "home")) portOpeners++;
    if (ns.fileExists("FTPCrack.exe", "home")) portOpeners++;
    if (ns.fileExists("relaySMTP.exe", "home")) portOpeners++;
    if (ns.fileExists("HTTPWorm.exe", "home")) portOpeners++;
    if (ns.fileExists("SQLInject.exe", "home")) portOpeners++;
    for (const host of servers) {
        if (!ns.hasRootAccess(host) &&
            ns.getServerMaxRam(host) > 0 &&
            ns.getServerRequiredHackingLevel(host) <= player.hacking &&
            ns.getServerNumPortsRequired(host) <= portOpeners) {
            try {
                if (ns.fileExists("BruteSSH.exe", "home")) ns.brutessh(host);
                if (ns.fileExists("FTPCrack.exe", "home")) ns.ftpcrack(host);
                if (ns.fileExists("relaySMTP.exe", "home")) ns.relaysmtp(host);
                if (ns.fileExists("HTTPWorm.exe", "home")) ns.httpworm(host);
                if (ns.fileExists("SQLInject.exe", "home")) ns.sqlinject(host);
                ns.nuke(host);
                ns.tprint("Rooted server: " + host);
            } catch (e) {
                ns.tprint("Failed to root server: " + host + " (" + e + ")");
            }
        }
    }

    ns.tprint("Starting batcher...");
    ns.run("/standalone/mk0/batcher.js");
    await ns.sleep(1000);

    ns.tprint("Starting deployer...");
    ns.run("/standalone/mk0/deployer.js");
    ns.tprint("Startup complete.");
}
