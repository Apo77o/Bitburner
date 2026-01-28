
// module: /standalone/mk0/batcher.js
// version: 1.8.0
// last-updated: 2026-01-27
// author: Apo77o + Copilot
// status: active
// changes:
// - 2026-01-27: No unnecessary output, only hackable/rooted targets, syntax clean, max 3 records, XP/$ logging

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog("ALL");

    const targetListPath = "/standalone/mk0/target-list.json";
    const contractPath = "/standalone/mk0/batcher-contracts.json";
    const feedbackPath = "/standalone/mk0/batcher-feedback.json";
    const xpLogPath = "/standalone/mk0/batcher-xp-log.json";
    const loop = !ns.args.includes("once");

    if (ns.fileExists(xpLogPath)) ns.rm(xpLogPath);

    function loadJson(path, def) {
        if (!ns.fileExists(path)) return def;
        try { return JSON.parse(ns.read(path)); } catch { return def; }
    }
    function saveHistory(obj, key, value, max = 3) {
        if (!obj[key]) obj[key] = [];
        obj[key].push(value);
        while (obj[key].length > max) obj[key].shift();
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

    function estimateThreads(ns, target, feedback, homeRam) {
        const hackRam = ns.getScriptRam("/standalone/mk0/hack-worker.js", "home");
        const growRam = ns.getScriptRam("/standalone/mk0/grow-worker.js", "home");
        const weakenRam = ns.getScriptRam("/standalone/mk0/weaken-worker.js", "home");
        let hackThreads = Math.max(1, Math.floor((homeRam / 12) / hackRam));
        let growThreads = Math.max(1, Math.floor((homeRam / 8) / growRam));
        let weakenThreads = Math.max(1, Math.floor((homeRam / 8) / weakenRam));
        const fb = feedback[target.name] || [];
        if (fb.length >= 2) {
            const last = fb[fb.length - 1];
            const prev = fb[fb.length - 2];
            if (last && prev) {
                if (last.sec >= prev.sec) weakenThreads = Math.ceil(weakenThreads * 1.2);
                if (last.money <= prev.money) growThreads = Math.ceil(growThreads * 1.2);
                if (last.money > 0.9 * last.maxMoney && last.sec <= last.minSec + 2) hackThreads = Math.ceil(hackThreads * 1.2);
            }
        }
        return { hackThreads, growThreads, weakenThreads };
    }

    function prepContract(ns, target, homeRam) {
        const growRam = ns.getScriptRam("/standalone/mk0/grow-worker.js", "home");
        const weakenRam = ns.getScriptRam("/standalone/mk0/weaken-worker.js", "home");
        let growThreads = 0, weakenThreads = 0;
        const sec = ns.getServerSecurityLevel(target.name);
        const minSec = ns.getServerMinSecurityLevel(target.name);
        const money = ns.getServerMoneyAvailable(target.name);
        const maxMoney = ns.getServerMaxMoney(target.name);
        if (sec > minSec + 5) weakenThreads = Math.floor((homeRam * 0.8) / weakenRam);
        if (money < maxMoney * 0.7) growThreads = Math.floor((homeRam * 0.8) / growRam);
        if (growThreads && weakenThreads) {
            growThreads = Math.floor((homeRam * 0.4) / growRam);
            weakenThreads = Math.floor((homeRam * 0.4) / weakenRam);
        }
        return { hackThreads: 0, growThreads, weakenThreads, prep: true };
    }

    let xpLog = {};

    do {
        const targets = loadJson(targetListPath, []);
        let contracts = loadJson(contractPath, {});
        let feedback = loadJson(feedbackPath, {});

        const player = ns.getPlayer();
        const homeRam = ns.getServerMaxRam("home");
        const portOpeners = getAvailablePortOpeners();

        for (const target of targets) {
            if (target.name === "n00dles") continue;
            if (target.hackReq > player.hacking || homeRam < 8) continue;
            if (!ns.hasRootAccess(target.name)) continue;
            if (ns.getServerNumPortsRequired(target.name) > portOpeners) continue;

            const sec = ns.getServerSecurityLevel(target.name);
            const minSec = ns.getServerMinSecurityLevel(target.name);
            const money = ns.getServerMoneyAvailable(target.name);
            const maxMoney = ns.getServerMaxMoney(target.name);

            const secOk = sec <= minSec + 5;
            const moneyOk = money >= maxMoney * 0.7;

            let contract;
            if (!secOk || !moneyOk) {
                contract = prepContract(ns, target, homeRam);
            } else {
                contract = estimateThreads(ns, target, feedback, homeRam);
            }
            contract.target = target.name;
            contract.timestamp = Date.now();

            // Save contract (max 3 per target)
            if (!contracts[target.name]) contracts[target.name] = [];
            contracts[target.name].push(contract);
            while (contracts[target.name].length > 3) contracts[target.name].shift();

            // Save feedback (max 3 per target)
            const result = {
                sec, minSec, money, maxMoney, contract, timestamp: Date.now()
            };
            saveHistory(feedback, target.name, result, 3);

            // XP/$ logging (simulate: log contract and server state for later analysis)
            if (!xpLog[target.name]) xpLog[target.name] = [];
            xpLog[target.name].push({
                sec, minSec, money, maxMoney,
                hackThreads: contract.hackThreads,
                growThreads: contract.growThreads,
                weakenThreads: contract.weakenThreads,
                timestamp: Date.now()
            });
            while (xpLog[target.name].length > 3) xpLog[target.name].shift();

            // Write contract for deployer (overwrites previous for this target)
            await ns.write("/standalone/mk0/batcher-plan.json", JSON.stringify(contract, null, 2), "w");
        }

        // Save contract, feedback, and xp logs
        await ns.write(contractPath, JSON.stringify(contracts, null, 2), "w");
        await ns.write(feedbackPath, JSON.stringify(feedback, null, 2), "w");
        await ns.write(xpLogPath, JSON.stringify(xpLog, null, 2), "w");

        if (loop) await ns.sleep(5000);
    } while (loop);
}
