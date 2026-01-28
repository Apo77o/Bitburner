
// module: /standalone/mk0/initializer-target-list.js
// version: 1.1.0
// last-updated: 2026-01-27
// author: Apo77o + Copilot
// status: active
// changes:
// - 2026-01-27: Exclude home, p-servers, and servers with max money <= 0
// depends-on: none
// provides: target-list

/** @param {NS} ns **/
export async function main(ns) {
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

    const servers = scanAll().filter(s =>
        !s.startsWith("pserv-") &&
        s !== "home" &&
        !s.startsWith("hacknet-")
    );

    let info = servers.map(s => ({
        name: s,
        ram: ns.getServerMaxRam(s),
        minSec: ns.getServerMinSecurityLevel(s),
        maxMoney: ns.getServerMaxMoney(s),
        hackReq: ns.getServerRequiredHackingLevel(s)
    })).filter(s => s.maxMoney > 0);

    // Sort by hackReq
    info.sort((a, b) => a.hackReq - b.hackReq);

    // Move joesguns to top, n00dles to bottom
    const joesguns = info.findIndex(x => x.name === "joesguns");
    if (joesguns > 0) info.unshift(info.splice(joesguns, 1)[0]);
    const n00dles = info.findIndex(x => x.name === "n00dles");
    if (n00dles > -1 && n00dles !== info.length - 1) info.push(info.splice(n00dles, 1)[0]);

    await ns.write("/standalone/mk0/target-list.json", JSON.stringify(info, null, 2), "w");
    ns.tprint("initializer-target-list: Target list written to /standalone/mk0/target-list.json");
}
