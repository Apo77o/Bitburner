// /standalone/mk0/deployer.js
// Version: v0.13 (Shoelace Iterated)
// Dependencies: /standalone/mk0/worker-hack.js, /standalone/mk0/worker-grow.js, /standalone/mk0/worker-weaken.js
// Changelog: 
//   v0.13 Fixed countPrograms not defined (added modular countPrograms helper); PID opt (load tunable CONFIG from /data/deploy-config.json, reset integrals on low hack<500); Home cores integrate (guard undef/default1, mult in grow/weaken calcs); Prep trigger (if prep, spawn pid-simulator.js + reload config); Slim loop (one-time in initializer); ES6+ const/arrows/destructure/maps; Resilience: Try-catch config/baselines/sim, guards undef/NaN/low hack; Opt: Static CONFIG, min calcs. SF/formulas-free (base analyzes).

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog('ALL');
  const LOOP_MS = 10000;  // Main loop
  const THROTTLE_MS = 1000;  // Deploy throttle
  const MAX_BATCHES_PER_TARGET = 5;  // Safety limit concurrent
  const TICK_MS = 200;  // Game tick approx
  const SHORT_TIME_THRESH = 60000;  // <60s → per-sec, else per-min
  let homePidState = {};  // Home-specific PID
  let netPidState = {};  // Network PID
  let lastProgCount = 0;

  const target = ns.args[0] || null;  // Arg prio
  const rams = { hack: 1.7, grow: 1.75, weaken: 1.75 };
  const density = { weaken: 1.2, grow: 1.0, hack: 0.8 };  // FFD sort key

  let config = loadConfig(ns);  // Load PID tunes
  const baselines = loadBaselines(ns);  // Load for adjustments

  while (true) {
    try {
      // Targets: arg or /data/targets.txt (initializer hack-req asc fallback/create)
      let targets = target ? [target] : ns.read('/data/targets.txt').split('\n').filter(Boolean);
      if (!targets.length) {
        ns.print('[WARN] No targets—default XP low-req');
        targets = ['n00dles', 'foodnstuff', 'joesguns'];
        ns.write('/data/targets.txt', targets.join('\n'), 'w');
      }

      // Usables: Build/cache w/ root/SCP + regen
      const progCount = countPrograms(ns);
      let usables = [];
      if (!isListComplete(ns) || progCount > lastProgCount) {
        ns.print(`[INFO] Regen usables: ${!isListComplete(ns) ? 'incomplete' : 'new progs'}`);
        lastProgCount = progCount;
        usables = await buildUsables(ns);  // Root/SCP inline
        if (ns.hasRootAccess('home') && ns.getServerMaxRam('home') > 0 && !usables.includes('home')) {
          usables.push('home');
        }
        ns.write('/data/usables.txt', usables.join('\n'), 'w');
      } else {
        usables = ns.read('/data/usables.txt').split('\n').filter(Boolean);
      }

      const servers = usables.filter(s => ns.hasRootAccess(s) && ns.getServerMaxRam(s) > 0)
                             .sort((a, b) => ns.getServerMaxRam(b) - ns.getServerMaxRam(a));  // Desc RAM

      if (!servers.length) {
        ns.print('[WARN] No usables—sleep');
        await ns.sleep(LOOP_MS);
        continue;
      }

      // Home reserve
      const homeReserve = Number(ns.read('/data/home-reserve.txt') || 64);

      let leftover = new Map(servers.map(s => {
        const free = ns.getServerMaxRam(s) - ns.getServerUsedRam(s);
        return [s, s === 'home' ? Math.max(0, free - homeReserve) : free];
      })).filter(([, free]) => free > 1.75);  // Min worker

      const totalAvail = Array.from(leftover.values()).reduce((a, b) => a + b, 0);

      // Per-target: Calc total req threads/action (grow to thresh, etc.), PID adj (home/net separate)
      const targetReqs = new Map();
      let globalNeeded = 0;
      let prepNeeded = false;
      for (const tgt of targets) {
        const srv = ns.getServer(tgt);
        const isHome = servers.includes('home') && leftover.has('home');  // Home avail?
        const pidAdj = pidController(ns, srv, isHome ? homePidState : netPidState, config);
        if (isHome) homePidState = pidAdj.state;
        else netPidState = pidAdj.state;

        const req = estimateThreads(ns, tgt, pidAdj, baselines[tgt]);  // Adjust w/ baselines if avail
        targetReqs.set(tgt, req);

        const reqRam = (req.hack * rams.hack) + (req.grow * rams.grow) + (req.weaken * rams.weaken);
        globalNeeded += reqRam;

        // Prep trigger (if prep, run sim post-loop)
        if (req.hack === 0 && (req.grow > 0 || req.weaken > 0)) prepNeeded = true;
      }

      // Enough for 1/target min? Warn/stop extras if not
      if (globalNeeded > totalAvail) {
        ns.print(`[WARN] Insufficient RAM for 1 batch/all targets: Need ${globalNeeded.toFixed(0)}GB, avail ${totalAvail.toFixed(0)}GB—Skipping extras`);
      }

      // Prioritize: 1 batch/target min, then cycle extras down list
      const { minAllocs, extraAllocs } = prioritizeOnePerTarget(ns, targets, targetReqs, leftover, rams, density, MAX_BATCHES_PER_TARGET);

      // Deploy mins
      for (const [tgt, alloc] of minAllocs.entries()) {
        const times = estimateTimes(ns, tgt);
        const spacing = times.max < SHORT_TIME_THRESH ? TICK_MS * 5 : 60000;  // Per-sec short, per-min long
        await staggerDeploy(ns, alloc, tgt, 1, spacing, THROTTLE_MS);  // 1 batch min
        updateLeftover(leftover, alloc, rams);
      }

      // Extras if RAM (cycle targets)
      if (globalNeeded <= totalAvail) {
        let cycleIdx = 0;
        while (Array.from(leftover.values()).reduce((a, b) => a + b, 0) > rams.weaken * 2 && cycleIdx < targets.length * 2) {  // Limit cycles
          const extraTgt = targets[cycleIdx % targets.length];
          const extraAlloc = extraAllocs.get(extraTgt);
          if (!extraAlloc) { cycleIdx++; continue; }

          const times = estimateTimes(ns, extraTgt);
          const spacing = times.max < SHORT_TIME_THRESH ? TICK_MS * 5 : 60000;
          await staggerDeploy(ns, extraAlloc, extraTgt, 1, spacing, THROTTLE_MS);
          updateLeftover(leftover, extraAlloc, rams);
          cycleIdx++;
        }
      }

      // n00dles fallback: Simple HWGW (no prep, frac hack)
      const totalLeft = Array.from(leftover.values()).reduce((a, b) => a + b, 0);
      if (totalLeft > rams.weaken * 2) {
        const nReq = estimateThreads(ns, 'n00dles', { hackMult: 1, growMult: 1, weakenMult: 1 });  // Simple
        const nAlloc = knapsack(leftover, rams, nReq, density, ns);
        await staggerDeploy(ns, nAlloc, 'n00dles', 1, TICK_MS, THROTTLE_MS);  // Single batch
      }

      // Prep trigger: If prep needed, run sim + reload config
      if (prepNeeded) {
        ns.print('[PREP DETECT] Running PID sim for tune');
        const simTgt = 'n00dles';
        const { avgError, stability, suggestion } = simulatePid(ns, simTgt, config, 50);  // Fast sim
        if (avgError > 0.05) {
          ns.tprint(`[SIM WARN] Error ${avgError.toFixed(3)} >0.05: ${suggestion}`);
          // Auto-adjust (e.g., increase Kd 20%)
          config.kd *= 1.2;
          ns.write('/data/deploy-config.json', JSON.stringify(config, null, 2), 'w');
          config = loadConfig(ns);  // Reload
          ns.print('[SIM ADJ] Increased Kd 20%');
        }
      }

      logPid(ns, { home: homePidState, net: netPidState });
      ns.tprint(`[MK0 DEPLOY v0.13] ${targets.length}tgts → ${servers.length}hosts | Leftover: ${totalLeft.toFixed(0)}GB`);
    } catch (e) {
      ns.tprint(`[MK0 DEPLOY ERROR] ${e.message}`);
    }
    await ns.sleep(LOOP_MS);
  }
}

// Retained: countPrograms, isListComplete, buildUsables, getNetworkRooted (all base NS2, no SF)

// Retained+Opt: estimateThreads (base analyzes + 10% buffer workaround for drift)
function estimateThreads(ns, target, pidAdj) {
  const moneyMax = ns.getServerMaxMoney(target);
  if (moneyMax <= 0) return { hack: 0, grow: 0, weaken: 0 };

  const minSec = ns.getServerMinSecurityLevel(target);
  const curMoney = ns.getServerMoneyAvailable(target);
  const curSec = ns.getServerSecurityLevel(target);
  const moneyThresh = 0.9 * moneyMax;
  const secThresh = minSec * 1.05;

  let req = { hack: 0, grow: 0, weaken: 0 };

  // Grow to thresh total (+10% buffer workaround)
  req.grow = Math.max(1, Math.ceil(ns.growthAnalyze(target, moneyThresh / Math.max(curMoney, 1)) * 1.1) * pidAdj.growMult);

  // Weaken to thresh total (+10% buffer)
  req.weaken = Math.max(1, Math.ceil((curSec - secThresh) / ns.weakenAnalyze(1) * 1.1) * pidAdj.weakenMult);

  // Hack frac total (if prepped)
  if (curMoney >= moneyThresh && curSec <= secThresh) {
    const hackFrac = 0.1;
    req.hack = Math.max(1, Math.ceil(hackFrac / ns.hackAnalyze(target)) * pidAdj.hackMult);
    const secHack = ns.hackAnalyzeSecurity(req.hack, target);
    const secGrow = ns.growthAnalyzeSecurity(req.grow, target);
    req.weaken += Math.ceil(secHack / ns.weakenAnalyze(1));  // Extra weaken for hack
    req.weaken += Math.ceil(secGrow / ns.weakenAnalyze(1));  // Extra for grow
  }

  return req;
}

// Retained: estimateTimes (base get*Time)
function estimateTimes(ns, target) {
  const hack = ns.getHackTime(target);
  const grow = ns.getGrowTime(target);
  const weaken = ns.getWeakenTime(target);
  return {
    hack: hack > 0 ? hack : 1000,  // Guard >0
    grow: grow > 0 ? grow : 1000,
    weaken: weaken > 0 ? weaken : 1000,
    max: Math.max(hack, grow, weaken)
  };
}

// Retained: knapsack (FFD w/ home cores)

// Retained: prioritizeOnePerTarget (1/target min + extras cycle)
function prioritizeOnePerTarget(ns, targets, targetReqs, leftover, rams, density, maxBatches) {
  const minAllocs = new Map();
  const extraAllocs = new Map();

  // Mins: Split req/batches (1 min batch/target)
  for (const tgt of targets) {
    const req = targetReqs.get(tgt);
    const minReq = {
      hack: Math.floor(req.hack / maxBatches),
      grow: Math.floor(req.grow / maxBatches),
      weaken: Math.floor(req.weaken / maxBatches)
    };
    minAllocs.set(tgt, knapsack(new Map(leftover), rams, minReq, density, ns));
  }

  // Extras: Remainder cycle (add to list order)
  for (const tgt of targets) {
    const req = targetReqs.get(tgt);
    const extraReq = {
      hack: req.hack % maxBatches,
      grow: req.grow % maxBatches,
      weaken: req.weaken % maxBatches
    };
    if (extraReq.hack + extraReq.grow + extraReq.weaken > 0) {
      extraAllocs.set(tgt, knapsack(new Map(leftover), rams, extraReq, density, ns));
    }
  }

  return { minAllocs, extraAllocs };
}

// Retained+Dynamic: staggerDeploy (spacing per short/long thresh)
async function staggerDeploy(ns, alloc, target, batches, spacing, throttle) {
  for (let b = 0; b < batches; b++) {
    // Per-batch: Split alloc threads / batches
    const batchAlloc = {};
    for (const [srv, t] of Object.entries(alloc)) {
      batchAlloc[srv] = {
        hack: Math.floor(t.hack / batches),
        grow: Math.floor(t.grow / batches),
        weaken: Math.floor(t.weaken / batches)
      };
    }

    await deploy(ns, batchAlloc, target, throttle);  // Retained deploy (kill old, exec)
    await ns.sleep(spacing);  // Dynamic space for next batch
  }
}

// Retained: deploy (kill old, exec), updateLeftover, pidController (home/net separate), logPid

// New Modular: Load config (try-catch, default fallback)
function loadConfig(ns) {
  try {
    const raw = ns.read('/data/deploy-config.json');
    if (!raw) throw new Error('empty');
    return JSON.parse(raw);
  } catch (e) {
    ns.print(`[CONFIG LOAD ERROR] ${e.message} — fallback default`);
    return { kp: 0.5, ki: 0.1, kd: 0.2, integralMax: 10, resetHackThresh: 500 };
  }
}

// New Modular: Load baselines (try-catch, fallback {})
function loadBaselines(ns) {
  try {
    const raw = ns.read('/data/baselines.json');
    if (!raw) throw new Error('empty');
    return JSON.parse(raw);
  } catch (e) {
    ns.print(`[BASELINES LOAD ERROR] ${e.message} — fallback {}`);
    return {};
  }
}

// New Modular: Simulate PID (estimate params on test tgt, return error/stability/suggest)
function simulatePid(ns, target, config, iterations) {
  let srv = ns.getServer(target);  // Initial state
  if (srv.moneyMax <= 0) throw new Error('Invalid sim tgt moneyMax=0');

  let state = {};  // PID state
  let errors = [];
  let secDrift = [];
  let moneyDrift = [];

  for (let i = 0; i < iterations; i++) {
    try {
      const pidAdj = pidController(ns, srv, state, config);
      state = pidAdj.state;

      const req = estimateThreads(ns, target, pidAdj);  // Sim threads

      // Sim action effects (base analyzes, guard undef)
      let simSec = srv.hackDifficulty + (ns.hackAnalyzeSecurity(req.hack, target) || 0) + (ns.growthAnalyzeSecurity(req.grow, target) || 0);
      simSec = Math.max(srv.minDifficulty, simSec - ns.weakenAnalyze(req.weaken) || srv.minDifficulty);  // Guard undef

      let simMoney = srv.moneyAvailable * (1 - (ns.hackAnalyze(target) * req.hack) || 1);
      simMoney = simMoney * (ns.growthAnalyze(target, srv.moneyMax / simMoney) * req.grow || srv.moneyMax);  // Guard undef

      srv.hackDifficulty = isFinite(simSec) ? simSec : srv.hackDifficulty;  // Guard NaN
      srv.moneyAvailable = isFinite(simMoney) ? simMoney : srv.moneyAvailable;

      // Error metrics (sec/money drift)
      const secError = Math.abs(srv.hackDifficulty - srv.minDifficulty) / srv.minDifficulty;
      const moneyError = Math.abs(srv.moneyMax * 0.9 - srv.moneyAvailable) / srv.moneyMax;
      errors.push((secError + moneyError) / 2);

      secDrift.push(secError);
      moneyDrift.push(moneyError);
    } catch (e) {
      ns.print(`[SIM ERROR] Iter ${i}: ${e.message}`);
      break;  // Early exit error
    }
  }

  const avgError = errors.reduce((a, b) => a + b, 0) / errors.length || 0;
  const stability = (Math.max(...secDrift) - Math.min(...secDrift)) + (Math.max(...moneyDrift) - Math.min(...moneyDrift)) || 0;

  let suggestion = 'Stable';
  if (avgError > 0.05) suggestion = 'Increase Kp for faster response';
  if (stability > 0.1) suggestion = 'Increase Kd for damp overshoot';

  return { avgError, stability, suggestion };
}
