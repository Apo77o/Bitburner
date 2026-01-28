/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog("ALL");
    ns.ui.openTail();

    const REFRESH = 3000; // ms between updates

    while (true) {
        const visited = new Set();
        const servers = [];

        function scanServer(host) {
            visited.add(host);
            for (const n of ns.scan(host)) {
                if (!visited.has(n)) scanServer(n);
            }

            // Exclude home + player servers
            if (
                host === "home" ||
                host.startsWith("pserv-") ||
                host.startsWith("hacknet-")
            ) return;

            const s = ns.getServer(host);

            servers.push({
                host,
                ramUsed: s.ramUsed,
                ramMax: s.maxRam,
                money: s.moneyMax,
                minSec: s.minDifficulty,
                curSec: s.hackDifficulty,
                reqHack: s.requiredHackingSkill,
                ports: s.numOpenPortsRequired,
                growth: s.serverGrowth,
                canHack: ns.getHackingLevel() >= s.requiredHackingSkill
            });
        }

        scanServer("home");

        servers.sort((a, b) => a.reqHack - b.reqHack);

        // ANSI colors
        const colors = {
            reset: "\x1b[0m",
            green: "\x1b[32m",
            yellow: "\x1b[33m",
            red: "\x1b[31m",
            cyan: "\x1b[36m",
            bold: "\x1b[1m"
        };

        function difficultyColor(reqHack) {
            const lvl = ns.getHackingLevel();
            if (reqHack <= lvl) return colors.green;       // hackable
            if (reqHack <= lvl * 1.5) return colors.yellow; // medium
            return colors.red;                              // hard
        }

        let output = "";
        output +=
            `${colors.bold}HOSTNAME           | RAM (Used/Max)     | MONEY MAX     | SEC (Cur/Min) | REQ HACK | PORTS | GROWTH${colors.reset}\n` +
            `--------------------------------------------------------------------------------------------------------\n`;

        for (const s of servers) {
            const diffColor = difficultyColor(s.reqHack);
            const hackMark = s.canHack ? `${colors.cyan}✔${colors.reset}` : " ";

            output +=
                `${hackMark} ` +
                `${diffColor}${s.host.padEnd(18)}${colors.reset} | ` +
                `${String(s.ramUsed).padEnd(7)}/${String(s.ramMax).padEnd(7)} | ` +
                `${(s.money > 0 ? ns.formatNumber(s.money) : "-").padEnd(13)} | ` +
                `${String(s.curSec).padEnd(3)}/${String(s.minSec).padEnd(3)}     | ` +
                `${String(s.reqHack).padEnd(8)} | ` +
                `${String(s.ports).padEnd(5)} | ` +
                `${s.growth}\n`;
        }

        ns.clearLog();
        ns.print(output);

        await ns.sleep(REFRESH);
    }
}
