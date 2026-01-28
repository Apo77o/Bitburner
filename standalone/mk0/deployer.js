/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog("ALL");

    const configPath = "/standalone/mk0/deployer-config.json";
    const planPath = "/standalone/mk0/batcher-contracts.json";
    const workerScripts = {
        hack: "/standalone/mk0/hack-worker.js",
        grow: "/standalone/mk0/grow-worker.js",
        weaken: "/standalone/mk0/weaken-worker.js"
    };
    const n00dles = "n00dles";
    const loop = !ns.args.includes("once");

    function loadJson(path, def) {
        if (!ns.fileExists(path)) return def;
        try { return JSON.parse(ns.read(path)); } catch { return def; }
    }
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
    function getAvailablePortOpeners() {
        let count = 0;
        if (ns.fileExists("BruteSSH.exe", "home")) count++;
        if (ns.fileExists("FTPCrack.exe", "home")) count++;
        if (ns.fileExists("relaySMTP.exe", "home")) count++;
        if (ns.fileExists("HTTPWorm.exe", "home")) count++;
        if (ns.fileExists("SQLInject.exe", "home")) count++;
        return count;
    }

    do {
        let ramReserve = 0;
        if (ns.fileExists(configPath)) {
            try {
                const cfg = JSON.parse(ns.read(configPath));
                ramReserve = Number(cfg.ramReserve) || 0;
            } catch { ramReserve = 0; }
        }

        // Scan servers and sort: network servers, p-servs, home last
        const servers = scanAll();
        const rooted = servers.filter(s => ns.hasRootAccess(s) && ns.getServerMaxRam(s) > 0);
        const pservs = rooted.filter(s => s.startsWith("pserv-")).sort((a, b) => {
            const na = parseInt(a.replace("pserv-", "")), nb = parseInt(b.replace("pserv-", ""));
            return nb - na;
        });
        const network = rooted.filter(s => !s.startsWith("pserv-") && s !== "home");
        const ordered = [...network, ...pservs, "home"];

        // Notify player if any hackable but unrooted servers with RAM > 0
        const player = ns.getPlayer();
        const portOpeners = getAvailablePortOpeners();
        const hackableUnrooted = servers.filter(s =>
            !ns.hasRootAccess(s) &&
            ns.getServerMaxRam(s) > 0 &&
            ns.getServerRequiredHackingLevel(s) <= player.hacking &&
            ns.getServerNumPortsRequired(s) <= portOpeners
        );
        if (hackableUnrooted.length > 0) {
            ns.tprint("Deployer: The following servers are hackable but not rooted (with RAM > 0):");
            hackableUnrooted.forEach(s => ns.tprint("  - " + s));
        }

        // Load contracts
        const contracts = loadJson(planPath, {});
        let availableContracts = [];
        for (const target in contracts) {
            if (!contracts[target] || !Array.isArray(contracts[target])) continue;
            const contract = contracts[target][contracts[target].length - 1];
            if (!contract) continue;
            availableContracts.push({
                target,
                hack: contract.hackThreads || 0,
                grow: contract.growThreads || 0,
                weaken: contract.weakenThreads || 0
            });
        }

        // Get worker RAM costs (check on home)
        const hackRam = ns.getScriptRam(workerScripts.hack, "home");
        const growRam = ns.getScriptRam(workerScripts.grow, "home");
        const weakenRam = ns.getScriptRam(workerScripts.weaken, "home");

        // Deploy contract-by-contract, server-by-server, maximizing RAM utilization (thread packing)
        let contractAlloc = {};
        for (const c of availableContracts) contractAlloc[c.target] = { hack: 0, grow: 0, weaken: 0 };

        for (const host of ordered) {
            if (!rooted.includes(host)) continue;
            const maxRam = ns.getServerMaxRam(host);
            const usedRam = ns.getServerUsedRam(host);
            let freeRam = Math.max(0, maxRam - usedRam - (host === "home" ? ramReserve : 0));

            // Copy scripts to remote server if not home
            for (const script of Object.values(workerScripts)) {
                if (host !== "home" && !ns.fileExists(script, host)) {
                    await ns.scp(script, "home", host);
                }
            }

            // For each contract, try to fill hack, grow, weaken in order, maximizing RAM usage
            for (const contract of availableContracts) {
                // Matrix solution: Try all combinations of (w, g, h) that fit in freeRam and fill contract
                let neededW = contract.weaken - contractAlloc[contract.target].weaken;
                let neededG = contract.grow - contractAlloc[contract.target].grow;
                let neededH = contract.hack - contractAlloc[contract.target].hack;
                if (neededW < 0) neededW = 0;
                if (neededG < 0) neededG = 0;
                if (neededH < 0) neededH = 0;

                // Try to fill as much as possible, prioritizing weaken > grow > hack
                let w = Math.min(neededW, Math.floor(freeRam / weakenRam));
                freeRam -= w * weakenRam;
                contractAlloc[contract.target].weaken += w;

                let g = Math.min(neededG, Math.floor(freeRam / growRam));
                freeRam -= g * growRam;
                contractAlloc[contract.target].grow += g;

                let h = Math.min(neededH, Math.floor(freeRam / hackRam));
                freeRam -= h * hackRam;
                contractAlloc[contract.target].hack += h;

                if (w > 0) ns.exec(workerScripts.weaken, host, w, contract.target);
                if (g > 0) ns.exec(workerScripts.grow, host, g, contract.target);
                if (h > 0) ns.exec(workerScripts.hack, host, h, contract.target);
            }

            // If no contracts or leftover RAM, fill with n00dles
            if (freeRam > 0) {
                if (weakenRam > 0 && ns.getServerSecurityLevel(n00dles) > ns.getServerMinSecurityLevel(n00dles)) {
                    let threads = Math.floor(freeRam / weakenRam);
                    if (threads > 0 && Number.isFinite(threads)) ns.exec(workerScripts.weaken, host, threads, n00dles);
                } else if (growRam > 0 && ns.getServerMoneyAvailable(n00dles) < ns.getServerMaxMoney(n00dles) * 0.9) {
                    let threads = Math.floor(freeRam / growRam);
                    if (threads > 0 && Number.isFinite(threads)) ns.exec(workerScripts.grow, host, threads, n00dles);
                } else if (hackRam > 0) {
                    let threads = Math.floor(freeRam / hackRam);
                    if (threads > 0 && Number.isFinite(threads)) ns.exec(workerScripts.hack, host, threads, n00dles);
                }
            }
        }

        if (loop) await ns.sleep(5000);
    } while (loop);
}