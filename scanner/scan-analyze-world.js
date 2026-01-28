/**
 * scan-analyze-world.js — production edition
 *
 * Args:
 *  0: sortMode       → "difficulty" | "money" | "growth" | "ram"
 *  1: backdoorMode   → "faction" | "worlddemon"
 *  2: loopMode       → "loop" | "autostop" | "autostop-hacktarget"
 *  3: tableMode      → "table" | "notable"
 *  4: treeMode       → "tree" | "notree"
 *  5: formulasMode   → "auto" | "force-formulas" | "no-formulas"
 *  6: scoreMode      → "none" | "score"
 */

const FACTION_SERVERS = ["CSEC", "avmnite-02h", "I.I.I.I", "run4theh111z"];
const WORLDDEMON_SERVER = "w0r1d_d43m0n";

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog("ALL");
    ns.ui.openTail();

    const REFRESH = 3000;

    const sortMode     = String(ns.args[0] || "difficulty");
    const backdoorMode = String(ns.args[1] || "faction");
    const loopMode     = String(ns.args[2] || "loop");
    const tableMode    = String(ns.args[3] || "table");
    const treeMode     = String(ns.args[4] || "tree");
    const formulasMode = String(ns.args[5] || "auto");
    const scoreMode    = String(ns.args[6] || "none");

    const hasSF4 = !!(ns.singularity && ns.singularity.connect);

    let hackTargetExported = false;
    let treeRenderedAtLeastOnce = (treeMode === "notree");

    while (true) {
        const visited = new Set();
        const servers = [];
        const parent = {};

        function scanServer(host) {
            visited.add(host);
            for (const n of ns.scan(host)) {
                if (!visited.has(n)) {
                    parent[n] = host;
                    scanServer(n);
                }
            }
            if (host === "home" || host.startsWith("pserv-") || host.startsWith("hacknet-")) return;

            const s = ns.getServer(host);
            if (!s.hasAdminRights) tryAutoRoot(ns, s);

            servers.push({
                host,
                ramUsed: s.ramUsed,
                ramMax: s.maxRam,
                money: s.moneyMax,
                minSec: s.minDifficulty,
                curSec: s.hackDifficulty,
                reqHack: s.requiredHackingSkill,
                portsReq: s.numOpenPortsRequired,
                portsOpen: s.openPortCount,
                growth: s.serverGrowth,
                hasRoot: s.hasAdminRights,
                backdoor: s.backdoorInstalled,
                canHack: ns.getHackingLevel() >= s.requiredHackingSkill,
                moneyPerHour: null
            });
        }

        scanServer("home");

        if (visited.has("The-Cave")) {
            const path = buildPath(parent, "The-Cave");
            await ns.write("worlddemonpath.txt", path.join(" -> ") + "\n", "w");
        }

        sortServers(servers, sortMode);

        const { best, debugInfo } = findBestHackTarget(
            ns,
            servers,
            formulasMode,
            scoreMode === "score"
        );

        if (best) {
            await ns.write("hacktarget.txt", best.host + "\n", "w");
            hackTargetExported = true;
        }

        const { whitelist, priority } = getBackdoorConfig(backdoorMode);
        const nextBackdoorTarget = getNextBackdoorTarget(servers, whitelist, priority);

        if (hasSF4) {
            await autoBackdoor(ns, servers, parent, nextBackdoorTarget);
        }

        let output = "";

        if (tableMode === "table") {
            output += headerBlock(
                sortMode,
                backdoorMode,
                loopMode,
                tableMode,
                treeMode,
                formulasMode,
                scoreMode,
                nextBackdoorTarget,
                best
            );

            for (const s of servers) {
                output += formatServerRow(ns, s);
            }
        }

        if (treeMode === "tree") {
            output += "\nNETWORK TREE VIEW\n";
            const treeLines = buildTreeView(
                "home",
                parent,
                visited,
                nextBackdoorTarget,
                best?.host
            );
            for (const line of treeLines) {
                output += line + "\n";
            }
            treeRenderedAtLeastOnce = true;
        }

        if (scoreMode === "score" && debugInfo) {
            output += "\nSCORING BREAKDOWN (top candidates):\n";
            for (const line of debugInfo) {
                output += line + "\n";
            }
        }

        ns.clearLog();
        ns.print(output);

        if (loopMode === "autostop-hacktarget" && hackTargetExported) {
            ns.tprint("Auto-stop-hacktarget: stopping after hacktarget export.");
            return;
        }

        if (loopMode === "autostop") {
            const allBackdoorsDone = hasSF4
                ? allBackdoorsInstalled(servers, whitelist)
                : true;

            if (allBackdoorsDone && hackTargetExported && treeRenderedAtLeastOnce) {
                ns.tprint("Auto-stop: all tasks complete.");
                return;
            }
        }

        await ns.sleep(REFRESH);
    }
}

/* ---------- core helpers ---------- */

function tryAutoRoot(ns, s) {
    const host = s.hostname;
    const tools = [
        ["BruteSSH.exe", ns.brutessh],
        ["FTPCrack.exe", ns.ftpcrack],
        ["relaySMTP.exe", ns.relaysmtp],
        ["HTTPWorm.exe", ns.httpworm],
        ["SQLInject.exe", ns.sqlinject]
    ];
    for (const [file, fn] of tools) {
        try { if (ns.fileExists(file, "home")) fn(host); } catch {}
    }
    try { ns.nuke(host); } catch {}
}

function buildPath(parent, target) {
    const path = [];
    let cur = target;
    while (cur !== undefined) {
        path.push(cur);
        cur = parent[cur];
    }
    return path.reverse();
}

function sortServers(servers, mode) {
    const sorters = {
        money: (a, b) => (b.money || 0) - (a.money || 0),
        growth: (a, b) => b.growth - a.growth,
        ram: (a, b) => b.ramMax - a.ramMax,
        difficulty: (a, b) => a.reqHack - b.reqHack
    };
    servers.sort(sorters[mode] || sorters.difficulty);
}

/* ---------- best-target heuristic ---------- */

function findBestHackTarget(ns, servers, formulasMode, debug) {
    const player = ns.getPlayer();
    const debugLines = [];

    const hasSF4 = !!(ns.singularity && ns.singularity.connect);
    if (!hasSF4) debugLines.push("SF4 unavailable → formulas/singularity limited.");

    let hasFormulas = ns.fileExists("Formulas.exe", "home") && !!ns.formulas && hasSF4;

    if (formulasMode === "no-formulas") {
        hasFormulas = false;
        debugLines.push("Formulas mode: NO-FORMULAS.");
    } else if (formulasMode === "force-formulas") {
        if (!hasFormulas) debugLines.push("FORCE-FORMULAS but formulas unavailable → fallback.");
        else debugLines.push("Formulas mode: FORCE-FORMULAS.");
    } else if (formulasMode === "auto") {
        debugLines.push("Formulas mode: AUTO.");
    }

    if (formulasMode === "auto" && !hasFormulas && hasSF4) {
        try {
            if (player.money >= 5e9) {
                ns.singularity.purchaseProgram("Formulas.exe");
                debugLines.push("Tried to auto-buy Formulas.exe.");
            }
        } catch {
            debugLines.push("Error auto-buying Formulas.exe (ignored).");
        }
        hasFormulas = ns.fileExists("Formulas.exe", "home") && !!ns.formulas && hasSF4;
    }

    const filtered = [];
    const excluded = [];

    for (const s of servers) {
        if (!s.canHack) {
            excluded.push(`${s.host}: cannot hack (req ${s.reqHack}, have ${player.hacking})`);
            continue;
        }
        if (s.money <= 0) {
            excluded.push(`${s.host}: moneyMax = 0`);
            continue;
        }
        filtered.push(s);
    }

    if (debug) {
        debugLines.push("Excluded servers:");
        if (excluded.length === 0) debugLines.push("  <none>");
        else for (const e of excluded) debugLines.push("  " + e);
    }

    if (filtered.length === 0) {
        debugLines.push("No servers passed filters → fallback to lowest reqHack among hackable.");
        const hackable = servers.filter(s => s.canHack);
        if (hackable.length > 0) {
            hackable.sort((a, b) => a.reqHack - b.reqHack);
            const best = hackable[0];
            if (debug) debugLines.push(`Chosen by hack-stat fallback: ${best.host} (reqHack=${best.reqHack})`);
            return { best, debugInfo: debug ? debugLines : null };
        }
    }

    let best = null;
    let bestScore = 0;
    const candidates = [];

    function recordCandidate(s, score, moneyPerHour, hackChance, levelBonus) {
        candidates.push({
            host: s.host,
            score,
            moneyPerHour,
            hackChance,
            levelBonus,
            reqHack: s.reqHack
        });
        s.moneyPerHour = moneyPerHour;
    }

    if (hasFormulas) {
        debugLines.push("Using formulas-based heuristic.");
        for (const s of filtered) {
            const serverObj = ns.getServer(s.host);

            const hackChance  = ns.formulas.hacking.hackChance(serverObj, player);
            const weakenTime  = ns.formulas.hacking.weakenTime(serverObj, player);
            const hackPercent = ns.formulas.hacking.hackPercent(serverObj, player);

            const moneyPerHack = serverObj.moneyMax * hackPercent * hackChance;
            const cycleTime    = weakenTime;
            const moneyPerHour = (moneyPerHack / cycleTime) * 3600 * 1000;

            const ideal      = player.hacking * 0.5;
            const distance   = Math.abs(serverObj.requiredHackingSkill - ideal);
            const levelBonus = 1 / (1 + distance);

            const finalScore = moneyPerHour * levelBonus;

            recordCandidate(s, finalScore, moneyPerHour, hackChance, levelBonus);

            if (finalScore > bestScore) {
                bestScore = finalScore;
                best = s;
            }
        }
    } else {
        debugLines.push("Formulas unavailable → fallback heuristic.");
        for (const s of filtered) {
            const hackChance   = player.hacking / (player.hacking + s.reqHack);
            const hackFraction = 0.002;
            const cycleTime    = s.reqHack || 1;
            const growthFactor = s.growth / Math.max(1, s.minSec);

            const moneyPerHour =
                (s.money * hackFraction * hackChance * growthFactor) /
                Math.max(1, cycleTime);

            const ideal      = player.hacking * 0.5;
            const distance   = Math.abs(s.reqHack - ideal);
            const levelBonus = 1 / (1 + distance);

            const finalScore = moneyPerHour * levelBonus;

            recordCandidate(s, finalScore, moneyPerHour, hackChance, levelBonus);

            if (finalScore > bestScore) {
                bestScore = finalScore;
                best = s;
            }
        }
    }

    if (!best) {
        debugLines.push("No best from scoring → fallback to highest money-per-hour among hackable.");
        const hackable = servers.filter(s => s.canHack && s.money > 0);
        if (hackable.length > 0) {
            hackable.forEach(s => {
                if (s.moneyPerHour == null) {
                    const hackChance   = player.hacking / (player.hacking + s.reqHack);
                    const hackFraction = 0.002;
                    const cycleTime    = s.reqHack || 1;
                    const growthFactor = s.growth / Math.max(1, s.minSec);
                    s.moneyPerHour =
                        (s.money * hackFraction * hackChance * growthFactor) /
                        Math.max(1, cycleTime);
                }
            });
            hackable.sort((a, b) => (b.moneyPerHour || 0) - (a.moneyPerHour || 0));
            best = hackable[0];
        }
    }

    if (!best) {
        debugLines.push("All fallbacks failed → final target = n00dles.");
        best = servers.find(s => s.host === "n00dles") || null;
    }

    if (debug) {
        debugLines.push("Top candidates by score:");
        candidates.sort((a, b) => b.score - a.score);
        for (const c of candidates.slice(0, 5)) {
            debugLines.push(
                `${c.host} | score=${c.score.toFixed(2)} | mph=${c.moneyPerHour.toExponential(2)} | ` +
                `reqHack=${c.reqHack} | hackChance=${c.hackChance.toFixed(2)} | lvlBonus=${c.levelBonus.toFixed(3)}`
            );
        }
        if (best) debugLines.push(`Chosen target: ${best.host}`);
        else debugLines.push("Chosen target: <none>");
    }

    return { best, debugInfo: debug ? debugLines : null };
}
/* ---------- backdoor configuration ---------- */

function getBackdoorConfig(mode) {
    if (mode === "worlddemon") {
        return { whitelist: [WORLDDEMON_SERVER], priority: [WORLDDEMON_SERVER] };
    }
    return {
        whitelist: [...FACTION_SERVERS],
        priority: ["run4theh111z", "I.I.I.I", "avmnite-02h", "CSEC"]
    };
}

function getNextBackdoorTarget(servers, whitelist, priority) {
    const eligible = servers.filter(s =>
        whitelist.includes(s.host) &&
        s.hasRoot &&
        s.canHack &&
        !s.backdoor
    );
    if (eligible.length === 0) return null;
    eligible.sort((a, b) => priority.indexOf(a.host) - priority.indexOf(b.host));
    return eligible[0].host;
}

async function autoBackdoor(ns, servers, parent, targetHost) {
    if (!targetHost) return;
    if (!ns.singularity || !ns.singularity.connect) return;

    const target = servers.find(s => s.host === targetHost);
    if (!target) return;

    const path = buildPath(parent, target.host);

    await ns.singularity.connect("home");
    for (let i = 1; i < path.length; i++) {
        await ns.singularity.connect(path[i]);
    }

    await ns.singularity.installBackdoor();
    await ns.singularity.connect("home");
}

function allBackdoorsInstalled(servers, whitelist) {
    return whitelist.every(name => {
        const s = servers.find(x => x.host === name);
        return !s || s.backdoor;
    });
}

/* ---------- formatting helpers ---------- */

function fmtRounded(value) {
    if (typeof value !== "number" || isNaN(value)) return "-";
    const str = value.toString();
    if (!str.includes(".")) return str;
    const decimals = str.split(".")[1].length;
    if (decimals <= 3) return str;
    return value.toFixed(3) + "*";
}

function fmtSec(value) {
    if (typeof value !== "number" || isNaN(value)) return "-";
    const str = value.toString();
    if (!str.includes(".")) return str;
    const decimals = str.split(".")[1].length;
    if (decimals <= 3) return str;
    return value.toFixed(3) + "*";
}

function fmtMoneyPerHour(ns, mph) {
    if (mph == null || isNaN(mph)) return "-";
    const formatted = ns.formatNumber(mph);
    const numeric = Number(mph);
    const decimals = numeric.toString().split(".")[1];
    if (decimals && decimals.length > 3) return formatted + "*";
    return formatted;
}

/* ---------- table + tree rendering ---------- */

function headerBlock(
    sortMode,
    backdoorMode,
    loopMode,
    tableMode,
    treeMode,
    formulasMode,
    scoreMode,
    nextBackdoorTarget,
    best
) {
    return (
        `[*] Sort: ${sortMode.toUpperCase()} | Backdoor: ${backdoorMode.toUpperCase()} | Loop: ${loopMode.toUpperCase()} | ` +
        `Table: ${tableMode.toUpperCase()} | Tree: ${treeMode.toUpperCase()} | Formulas: ${formulasMode.toUpperCase()} | ` +
        `ScoreMode: ${scoreMode.toUpperCase()}\n` +
        `[*] Next Backdoor Target: ${nextBackdoorTarget || "<none>"} | Best Hack Target: ${best?.host || "<none>"}\n` +
        `FLAG | HOSTNAME           | RAM (Used/Max)     | MONEY MAX     | MONEY/HOUR     | SEC (Cur/Min)       | REQ HACK | PORTS | GROWTH\n` +
        `---------------------------------------------------------------------------------------------------------------------------------\n`
    );
}

function formatServerRow(ns, s) {
    const colors = {
        reset:   "\x1b[0m",
        green:   "\x1b[32m",
        yellow:  "\x1b[33m",
        red:     "\x1b[31m",
        cyan:    "\x1b[36m",
        magenta: "\x1b[35m"
    };

    const lvl = ns.getHackingLevel();
    const diffColor =
        s.reqHack <= lvl ? colors.green :
        s.reqHack <= lvl * 1.5 ? colors.yellow :
        colors.red;

    const flags =
        (s.canHack ? colors.cyan + "✔" + colors.reset : " ") +
        (s.hasRoot ? colors.green + "R" + colors.reset : " ") +
        (s.backdoor ? colors.magenta + "B" + colors.reset : " ");

    const secDisplay =
        `${fmtSec(s.curSec).padEnd(7)}/${fmtSec(s.minSec).padEnd(7)}`;

    return (
        `${flags.padEnd(3)} | ` +
        `${diffColor}${s.host.padEnd(18)}${colors.reset} | ` +
        `${String(s.ramUsed).padEnd(7)}/${String(s.ramMax).padEnd(7)} | ` +
        `${(s.money > 0 ? ns.formatNumber(s.money) : "-").padEnd(13)} | ` +
        `${fmtMoneyPerHour(ns, s.moneyPerHour).padEnd(14)} | ` +
        `${secDisplay} | ` +
        `${String(s.reqHack).padEnd(8)} | ` +
        `${String(s.portsOpen)}/${String(s.portsReq).padEnd(3)} | ` +
        `${s.growth}\n`
    );
}

function buildTreeView(root, parent, visited, backdoorTarget, hackTarget) {
    const children = {};
    for (const node of visited) children[node] = [];
    for (const [child, par] of Object.entries(parent)) {
        if (!children[par]) children[par] = [];
        children[par].push(child);
    }
    for (const key of Object.keys(children)) children[key].sort();

    const backdoorPath = backdoorTarget ? pathTo(parent, root, backdoorTarget) : [];
    const hackPath     = hackTarget     ? pathTo(parent, root, hackTarget)     : [];

    const lines = [];

    function dfs(node, prefix) {
        let marker = "";
        const inBackdoor = backdoorPath.includes(node);
        const inHack     = hackPath.includes(node);

        if (inBackdoor && inHack) marker = "[BH] ";
        else if (inBackdoor)      marker = "[B] ";
        else if (inHack)          marker = "[H] ";

        lines.push(prefix + marker + node);

        const kids = children[node] || [];
        for (let i = 0; i < kids.length; i++) {
            const isLast = i === kids.length - 1;
            const branch = isLast ? "└─ " : "├─ ";
            const nextPrefix = prefix + (isLast ? "   " : "│  ");
            dfs(kids[i], nextPrefix + branch);
        }
    }

    dfs(root, "");
    return lines;
}

function pathTo(parent, root, target) {
    const path = [];
    let cur = target;
    const seen = new Set();

    while (cur !== undefined && !seen.has(cur)) {
        path.push(cur);
        if (cur === root) break;
        seen.add(cur);
        cur = parent[cur];
    }

    if (path[path.length - 1] !== root) return [];
    return path.reverse();
}

/* ---------- end of script ---------- */
