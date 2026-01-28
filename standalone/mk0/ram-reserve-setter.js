
// module: /standalone/mk0/ram-reserve-setter.js
// version: 1.0.0
// last-updated: 2026-01-27
// author: Apo77o + Copilot
// status: active
// changes:
// - 2026-01-27: Initial version, sets deployer RAM reserve based on arg, max, or scanner RAM
// depends-on: ram-usage-checker.js
// provides: ram-reserve-setter

/** @param {NS} ns **/
export async function main(ns) {
    const configPath = "/standalone/mk0/deployer-config.json";
    let reserve = 0;

    if (ns.args.length === 0) {
        // Default: use RAM usage of scan-analyze-world.js
        const ramFile = "/standalone/mk0/ram-usage.txt";
        if (!ns.fileExists(ramFile)) {
            ns.tprint("ram-reserve-setter: RAM usage file not found. Run ram-usage-checker.js first.");
            return;
        }
        reserve = Math.ceil(Number(ns.read(ramFile)));
        ns.tprint(`ram-reserve-setter: Setting RAM reserve to ${reserve} GB (scanner RAM).`);
    } else if (String(ns.args[0]).toLowerCase() === "max") {
        reserve = 0;
        ns.tprint("ram-reserve-setter: Setting RAM reserve to 0 (use all RAM).");
    } else if (!isNaN(Number(ns.args[0]))) {
        reserve = Math.ceil(Number(ns.args[0]));
        ns.tprint(`ram-reserve-setter: Setting RAM reserve to ${reserve} GB (manual).`);
    } else {
        ns.tprint("ram-reserve-setter: Invalid argument. Use no args, 'max', or a number.");
        return;
    }

    // Write to config
    await ns.write(configPath, JSON.stringify({ ramReserve: reserve }, null, 2), "w");
    ns.tprint(`ram-reserve-setter: Wrote reserve to ${configPath}`);
}
