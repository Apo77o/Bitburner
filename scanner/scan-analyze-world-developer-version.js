/**
 * scan-analyze-world.js — Developer Edition
 *
 * Fully commented, fully modular, fully robust network scanner and
 * best-target analyzer for Bitburner.
 *
 * This script includes:
 *   - Full network scan + parent mapping
 *   - Auto-rooting
 *   - Auto-backdoor (SF4-aware)
 *   - Best-target heuristic with:
 *       * formulas.exe support
 *       * auto-purchase formulas.exe
 *       * fallback heuristics
 *       * hack-stat rescaling
 *       * money-per-hour scoring
 *       * guaranteed fallback target
 *   - Table view with:
 *       * Rounded values (3 decimals max)
 *       * Asterisk marking rounded values
 *       * MONEY/HOUR column (after MONEY MAX)
 *   - Tree view
 *   - Auto-stop modes
 *   - Debug scoring breakdown
 *   - Debug exclusion reasons
 *
 * ARGUMENT ORDER:
 *   0: sortMode       → "difficulty" | "money" | "growth" | "ram"
 *   1: backdoorMode   → "faction" | "worlddemon"
 *   2: loopMode       → "loop" | "autostop" | "autostop-hacktarget"
 *   3: tableMode      → "table" | "notable"
 *   4: treeMode       → "tree" | "notree"
 *   5: formulasMode   → "auto" | "force-formulas" | "no-formulas"
 *   6: scoreMode      → "none" | "score"
 */

const FACTION_SERVERS = ["CSEC", "avmnite-02h", "I.I.I.I", "run4theh111z"];
const WORLDDEMON_SERVER = "w0r1d_d43m0n";

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog("ALL");
    ns.ui.openTail();

    // Refresh interval for the main loop
    const REFRESH = 3000;

    // Parse arguments with defaults
    const sortMode     = String(ns.args[0] || "difficulty");
    const backdoorMode = String(ns.args[1] || "faction");
    const loopMode     = String(ns.args[2] || "loop");
    const tableMode    = String(ns.args[3] || "table");
    const treeMode     = String(ns.args[4] || "tree");
    const formulasMode = String(ns.args[5] || "auto");
    const scoreMode    = String(ns.args[6] || "none");

    // Detect SF4 (required for auto-backdoor + formulas.exe usage)
    const hasSF4 = !!(ns.singularity && ns.singularity.connect);

    // Track auto-stop conditions
    let hackTargetExported = false;
    let treeRenderedAtLeastOnce = (treeMode === "notree");

    // Main loop begins after Part 2
    while (true) {
        // Track visited servers and parent relationships
        const visited = new Set();
        const servers = [];
        const parent = {};

        /**
         * Recursively scan the network starting from a host.
         * Builds:
         *   - visited set
         *   - parent map
         *   - servers[] with server metadata
         */
        function scanServer(host) {
            visited.add(host);

            for (const neighbor of ns.scan(host)) {
                if (!visited.has(neighbor)) {
                    parent[neighbor] = host;
                    scanServer(neighbor);
                }
            }

            // Skip home, purchased servers, and hacknet nodes
            if (host === "home" || host.startsWith("pserv-") || host.startsWith("hacknet-")) return;

            const s = ns.getServer(host);

            // Attempt auto-root if not already rooted
            if (!s.hasAdminRights) tryAutoRoot(ns, s);

            // Push server metadata
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
                canHack: ns.getHackingLevel() >= s.requiredHackingSkill
            });
        }

        // Begin scanning from home
        scanServer("home");

        /**
         * If The-Cave is reachable, export the path to worlddemonpath.txt
         */
        if (visited.has("The-Cave")) {
            const path = buildPath(parent, "The-Cave");
            await ns.write("worlddemonpath.txt", path.join(" -> ") + "\n", "w");
        }

        /**
         * Sort servers according to user-selected mode
         */
        sortServers(servers, sortMode);

        // Part 3 begins in the next message
        // --- BEST HACK TARGET SELECTION (with full fallback chain) ---
        const { best, debugInfo } = findBestHackTarget(
            ns,
            servers,
            formulasMode,
            scoreMode === "score"
        );

        // Export best target if found
        if (best) {
            await ns.write("hacktarget.txt", best.host + "\n", "w");
            hackTargetExported = true;
        }
/**
 * Best hack target heuristic with:
 *  - SF4 detection
 *  - formulas.exe detection + auto-purchase (in auto mode)
 *  - formulas/no-formulas/force-formulas modes
 *  - fallback when formulas unavailable
 *  - hack-stat proximity weighting
 *  - fallback to highest money-per-hour among hackable servers
 *  - final guaranteed target (n00dles)
 *  - debug output explaining exclusions and top candidates
 *
 * Returns:
 *   { best: serverObjectOrNull, debugInfo: string[] | null }
 */
function findBestHackTarget(ns, servers, formulasMode, debug) {
    const player = ns.getPlayer();
    const debugLines = [];

    // --- SF4 CHECK (required for ns.formulas + singularity) ---
    const hasSF4 = !!(ns.singularity && ns.singularity.connect);
    if (!hasSF4) {
        debugLines.push("SF4 unavailable → formulas.exe and singularity features limited.");
    }

    // --- FORMULAS.EXE AVAILABILITY ---
    let hasFormulas = ns.fileExists("Formulas.exe", "home") && !!ns.formulas && hasSF4;

    // --- FORMULAS MODE OVERRIDES ---
    if (formulasMode === "no-formulas") {
        hasFormulas = false;
        debugLines.push("Formulas mode: NO-FORMULAS (forced off).");
    } else if (formulasMode === "force-formulas") {
        if (!hasFormulas) {
            debugLines.push("Formulas mode: FORCE-FORMULAS but formulas unavailable → will fall back.");
        } else {
            debugLines.push("Formulas mode: FORCE-FORMULAS (using formulas).");
        }
    } else if (formulasMode === "auto") {
        debugLines.push("Formulas mode: AUTO.");
    }

    // --- AUTO-PURCHASE FORMULAS.EXE (AUTO MODE ONLY, SF4 REQUIRED) ---
    if (formulasMode === "auto" && !hasFormulas && hasSF4) {
        try {
            if (player.money >= 5e9) {
                ns.singularity.purchaseProgram("Formulas.exe");
                debugLines.push("Attempted to purchase Formulas.exe automatically.");
            }
        } catch {
            debugLines.push("Error while attempting to purchase Formulas.exe (ignored).");
        }
        hasFormulas = ns.fileExists("Formulas.exe", "home") && !!ns.formulas && hasSF4;
    }

    // --- FILTER SERVERS + TRACK EXCLUSION REASONS ---
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
        debugLines.push("Excluded servers (initial filters):");
        if (excluded.length === 0) {
            debugLines.push("  <none>");
        } else {
            for (const e of excluded) debugLines.push("  " + e);
        }
    }

    // --- IF NO SERVERS PASSED FILTERS, TRY SIMPLE HACK-STAT-BASED FALLBACK ---
    if (filtered.length === 0) {
        debugLines.push("No servers passed initial filters → fallback to lowest required hack among hackable servers.");
        const hackable = servers.filter(s => s.canHack);
        if (hackable.length > 0) {
            hackable.sort((a, b) => a.reqHack - b.reqHack);
            const best = hackable[0];
            if (debug) {
                debugLines.push(`Chosen by hack-stat fallback: ${best.host} (reqHack=${best.reqHack})`);
            }
            return { best, debugInfo: debug ? debugLines : null };
        }
    }

    // --- MAIN SCORING ---
    let best = null;
    let bestScore = 0;
    const candidates = [];

    // Helper to record candidate info
    function recordCandidate(s, score, moneyPerHour, hackChance, levelBonus) {
        candidates.push({
            host: s.host,
            score,
            moneyPerHour,
            hackChance,
            levelBonus,
            reqHack: s.reqHack
        });
        // Also store moneyPerHour on the server object for table display later
        s.moneyPerHour = moneyPerHour;
    }

    // --- FORMULAS-BASED SCORING (IF AVAILABLE) ---
    if (hasFormulas) {
        debugLines.push("Using formulas-based heuristic.");

        for (const s of filtered) {
            const serverObj = ns.getServer(s.host);

            const hackChance  = ns.formulas.hacking.hackChance(serverObj, player);
            const weakenTime  = ns.formulas.hacking.weakenTime(serverObj, player);
            const hackPercent = ns.formulas.hacking.hackPercent(serverObj, player);

            const moneyPerHack = serverObj.moneyMax * hackPercent * hackChance;
            const cycleTime    = weakenTime; // W-G-H cycle dominated by weaken
            const moneyPerHour = (moneyPerHack / cycleTime) * 3600 * 1000;

            // Weighting toward ~50% of player's hacking level
            const ideal     = player.hacking * 0.5;
            const distance  = Math.abs(serverObj.requiredHackingSkill - ideal);
            const levelBonus = 1 / (1 + distance);

            const finalScore = moneyPerHour * levelBonus;

            recordCandidate(s, finalScore, moneyPerHour, hackChance, levelBonus);

            if (finalScore > bestScore) {
                bestScore = finalScore;
                best = s;
            }
        }
    } else {
        debugLines.push("Formulas unavailable → using fallback heuristic.");

        for (const s of filtered) {
            const hackChance   = player.hacking / (player.hacking + s.reqHack);
            const hackFraction = 0.002; // rough guess
            const cycleTime    = s.reqHack || 1;
            const growthFactor = s.growth / Math.max(1, s.minSec);

            const moneyPerHour =
                (s.money * hackFraction * hackChance * growthFactor) /
                Math.max(1, cycleTime);

            const ideal     = player.hacking * 0.5;
            const distance  = Math.abs(s.reqHack - ideal);
            const levelBonus = 1 / (1 + distance);

            const finalScore = moneyPerHour * levelBonus;

            recordCandidate(s, finalScore, moneyPerHour, hackChance, levelBonus);

            if (finalScore > bestScore) {
                bestScore = finalScore;
                best = s;
            }
        }
    }

    // --- FALLBACK: HIGHEST MONEY-PER-HOUR AMONG HACKABLE SERVERS ---
    if (!best) {
        debugLines.push("No best target from scoring → fallback to highest money-per-hour among hackable servers.");
        const hackable = servers.filter(s => s.canHack && s.money > 0);
        if (hackable.length > 0) {
            // If we already computed moneyPerHour for some, use it; otherwise approximate
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

    // --- FINAL GUARANTEED TARGET: n00dles ---
    if (!best) {
        debugLines.push("All scoring and fallbacks failed → final guaranteed target = n00dles.");
        best = servers.find(s => s.host === "n00dles") || null;
    }

    // --- DEBUG OUTPUT: TOP CANDIDATES + FINAL CHOICE ---
    if (debug) {
        debugLines.push("Top candidates by score:");
        candidates.sort((a, b) => b.score - a.score);
        for (const c of candidates.slice(0, 5)) {
            debugLines.push(
                `${c.host} | score=${c.score.toFixed(2)} | mph=${c.moneyPerHour.toExponential(2)} | ` +
                `reqHack=${c.reqHack} | hackChance=${c.hackChance.toFixed(2)} | lvlBonus=${c.levelBonus.toFixed(3)}`
            );
        }
        if (best) {
            debugLines.push(`Chosen target: ${best.host}`);
        } else {
            debugLines.push("Chosen target: <none>");
        }
    }

    return { best, debugInfo: debug ? debugLines : null };
}
/**
 * ---------------------------------------------------------------------------
 * PART 4 — BACKDOOR LOGIC + HELPERS
 * ---------------------------------------------------------------------------
 *
 * This section handles:
 *   - Backdoor target selection
 *   - Backdoor priority ordering
 *   - Auto-backdoor installation (SF4 required)
 *   - Checking whether all required backdoors are installed
 *
 * The backdoor system supports two modes:
 *
 *   backdoorMode = "faction"
 *       → Backdoors required for faction invites:
 *           CSEC → avmnite-02h → I.I.I.I → run4theh111z
 *
 *   backdoorMode = "worlddemon"
 *       → Only backdoor w0r1d_d43m0n
 *
 * The main loop calls:
 *   const { whitelist, priority } = getBackdoorConfig(backdoorMode);
 *   const nextBackdoorTarget = getNextBackdoorTarget(servers, whitelist, priority);
 *   await autoBackdoor(ns, servers, parent, nextBackdoorTarget);
 *
 * ---------------------------------------------------------------------------
 */


/**
 * Returns the whitelist + priority order for backdoor installation.
 *
 * backdoorMode = "faction"
 *     whitelist = [CSEC, avmnite-02h, I.I.I.I, run4theh111z]
 *     priority  = same order
 *
 * backdoorMode = "worlddemon"
 *     whitelist = ["w0r1d_d43m0n"]
 *     priority  = ["w0r1d_d43m0n"]
 */
function getBackdoorConfig(mode) {
    if (mode === "worlddemon") {
        return {
            whitelist: [WORLDDEMON_SERVER],
            priority:  [WORLDDEMON_SERVER]
        };
    }

    // Default: faction servers
    return {
        whitelist: [...FACTION_SERVERS],
        priority:  ["run4theh111z", "I.I.I.I", "avmnite-02h", "CSEC"] // highest → lowest priority
    };
}



/**
 * Determine the next server that should receive a backdoor.
 *
 * Requirements:
 *   - Must be in whitelist
 *   - Must be rooted
 *   - Must be hackable
 *   - Must NOT already have a backdoor installed
 *
 * The priority array determines which server is chosen first.
 */
function getNextBackdoorTarget(servers, whitelist, priority) {
    const eligible = servers.filter(s =>
        whitelist.includes(s.host) &&
        s.hasRoot &&
        s.canHack &&
        !s.backdoor
    );

    if (eligible.length === 0) return null;

    // Sort by priority index
    eligible.sort((a, b) =>
        priority.indexOf(a.host) - priority.indexOf(b.host)
    );

    return eligible[0].host;
}



/**
 * Auto-backdoor installer.
 *
 * Requirements:
 *   - SF4 must be available (ns.singularity.connect)
 *   - targetHost must be non-null
 *   - server must be rooted and hackable
 *
 * Behavior:
 *   - Connects from home → target via parent map
 *   - Installs backdoor
 *   - Returns to home
 */
async function autoBackdoor(ns, servers, parent, targetHost) {
    if (!targetHost) return;
    if (!ns.singularity || !ns.singularity.connect) return; // SF4 missing

    const target = servers.find(s => s.host === targetHost);
    if (!target) return;

    // Build path from home → target
    const path = buildPath(parent, target.host);

    // Connect step-by-step
    await ns.singularity.connect("home");
    for (let i = 1; i < path.length; i++) {
        await ns.singularity.connect(path[i]);
    }

    // Install backdoor
    await ns.singularity.installBackdoor();

    // Return home
    await ns.singularity.connect("home");
}



/**
 * Check whether all required backdoors are installed.
 *
 * Used by autostop mode:
 *   - If all backdoors done AND hacktarget exported AND tree rendered → stop
 */
function allBackdoorsInstalled(servers, whitelist) {
    return whitelist.every(name => {
        const s = servers.find(x => x.host === name);
        return !s || s.backdoor;
    });
}
/**
 * ---------------------------------------------------------------------------
 * PART 5 — TABLE RENDERING + TREE VIEW + FORMATTING HELPERS
 * ---------------------------------------------------------------------------
 *
 * This section handles:
 *   - Table header + row formatting
 *   - MONEY/HOUR column (after MONEY MAX)
 *   - Rounding logic:
 *        * Values with >3 decimals are rounded to 3 decimals
 *        * Rounded values are marked with an asterisk "*"
 *        * Internal logic NEVER uses rounded values
 *   - Tree view rendering
 *   - Utility functions for formatting and rounding
 *
 * The main loop calls:
 *   output += headerBlock(...)
 *   output += formatServerRow(ns, s)
 *   output += tree view (if enabled)
 *
 * ---------------------------------------------------------------------------
 */


/**
 * Format a number for table display:
 *   - If it has >3 decimals → round to 3 decimals and append "*"
 *   - Otherwise show as-is
 *   - Does NOT affect internal values
 */
function fmtRounded(value) {
    if (typeof value !== "number" || isNaN(value)) return "-";

    const str = value.toString();

    // If no decimal or <=3 decimals → return as-is
    if (!str.includes(".")) return str;
    const decimals = str.split(".")[1].length;
    if (decimals <= 3) return str;

    // Round to 3 decimals for display only
    return value.toFixed(3) + "*";
}


/**
 * Format money-per-hour for table display.
 * Uses fmtRounded() but also applies ns.formatNumber for readability.
 */
function fmtMoneyPerHour(ns, mph) {
    if (mph == null || isNaN(mph)) return "-";

    // Use full precision for formatting, then apply rounding rule
    const formatted = ns.formatNumber(mph);
    const numeric = Number(mph);

    // If numeric has >3 decimals, mark with "*"
    const decimals = numeric.toString().split(".")[1];
    if (decimals && decimals.length > 3) {
        return formatted + "*";
    }
    return formatted;
}


/**
 * Build the table header.
 * MONEY/HOUR column is placed immediately after MONEY MAX.
 */
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
        `FLAG | HOSTNAME           | RAM (Used/Max)     | MONEY MAX     | MONEY/HOUR     | SEC (Cur/Min) | REQ HACK | PORTS | GROWTH\n` +
        `-----------------------------------------------------------------------------------------------------------------------------\n`
    );
}


/**
 * Format a single server row for the table.
 * Includes MONEY/HOUR column (after MONEY MAX).
 * Uses fmtRounded() and fmtMoneyPerHour() for display-only rounding.
 */
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

    // Difficulty color coding
    const diffColor =
        s.reqHack <= lvl ? colors.green :
        s.reqHack <= lvl * 1.5 ? colors.yellow :
        colors.red;

    // Flags: hackable ✔, rooted R, backdoor B
    const flags =
        (s.canHack ? colors.cyan + "✔" + colors.reset : " ") +
        (s.hasRoot ? colors.green + "R" + colors.reset : " ") +
        (s.backdoor ? colors.magenta + "B" + colors.reset : " ");

    // MONEY/HOUR (display only)
    const mphDisplay = fmtMoneyPerHour(ns, s.moneyPerHour);

    return (
        `${flags.padEnd(3)} | ` +
        `${diffColor}${s.host.padEnd(18)}${colors.reset} | ` +
        `${String(s.ramUsed).padEnd(7)}/${String(s.ramMax).padEnd(7)} | ` +
        `${(s.money > 0 ? ns.formatNumber(s.money) : "-").padEnd(13)} | ` +
        `${mphDisplay.padEnd(14)} | ` +
        `${String(s.curSec).padEnd(3)}/${String(s.minSec).padEnd(3)}     | ` +
        `${String(s.reqHack).padEnd(8)} | ` +
        `${String(s.portsOpen)}/${String(s.portsReq).padEnd(3)} | ` +
        `${s.growth}\n`
    );
}


/**
 * Build a tree view of the network.
 * Highlights:
 *   [B]  → backdoor path
 *   [H]  → hack target path
 *   [BH] → both
 */
function buildTreeView(root, parent, visited, backdoorTarget, hackTarget) {
    const children = {};

    // Initialize children lists
    for (const node of visited) children[node] = [];
    for (const [child, par] of Object.entries(parent)) {
        if (!children[par]) children[par] = [];
        children[par].push(child);
    }

    // Sort children alphabetically
    for (const key of Object.keys(children)) {
        children[key].sort();
    }

    // Compute paths for highlighting
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


/**
 * Build a path from root → target using parent map.
 * Returns [] if no valid path.
 */
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
/**
 * ---------------------------------------------------------------------------
 * PART 6 — MAIN LOOP COMPLETION + OUTPUT + AUTOSTOP LOGIC
 * ---------------------------------------------------------------------------
 *
 * This section finishes the main loop:
 *   - Integrates best-target results
 *   - Integrates backdoor logic
 *   - Builds table output
 *   - Builds tree output
 *   - Adds scoring breakdown (if enabled)
 *   - Handles autostop modes
 *
 * This closes the main() function.
 * ---------------------------------------------------------------------------
 */

        // --- BACKDOOR CONFIG ---
        const { whitelist, priority } = getBackdoorConfig(backdoorMode);
        const nextBackdoorTarget = getNextBackdoorTarget(servers, whitelist, priority);

        // --- AUTO-BACKDOOR (SF4 ONLY) ---
        if (hasSF4) {
            await autoBackdoor(ns, servers, parent, nextBackdoorTarget);
        }

        // --- BUILD OUTPUT STRING ---
        let output = "";

        // TABLE VIEW ----------------------------------------------------------
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

        // TREE VIEW -----------------------------------------------------------
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

        // SCORING BREAKDOWN ---------------------------------------------------
        if (scoreMode === "score" && debugInfo) {
            output += "\nSCORING BREAKDOWN (top candidates):\n";
            for (const line of debugInfo) {
                output += line + "\n";
            }
        }

        // PRINT OUTPUT --------------------------------------------------------
        ns.clearLog();
        ns.print(output);

        // AUTOSTOP: hacktarget only ------------------------------------------
        if (loopMode === "autostop-hacktarget" && hackTargetExported) {
            ns.tprint("Auto-stop-hacktarget: stopping after hacktarget export.");
            return;
        }

        // AUTOSTOP: full completion ------------------------------------------
        if (loopMode === "autostop") {
            const allBackdoorsDone = hasSF4
                ? allBackdoorsInstalled(servers, whitelist)
                : true; // If no SF4, ignore backdoors

            if (allBackdoorsDone && hackTargetExported && treeRenderedAtLeastOnce) {
                ns.tprint("Auto-stop: all tasks complete.");
                return;
            }
        }

        // LOOP DELAY ----------------------------------------------------------
        await ns.sleep(REFRESH);
    } // end while(true)
} // end main()
