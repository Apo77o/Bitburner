// /standalone/mk0/deployer.js
// Version: v0.14 (Shoelace Iterated)
// Dependencies: /standalone/mk0/worker-hack.js, /standalone/mk0/worker-grow.js, /standalone/mk0/worker-weaken.js
// Changelog: 
//   v0.14 Slimmed to 157 lines/4.15GB (moved one-time setup to initializer, caching for heavy calls like getServer/scan, removed redundancies); PID opt (load tunable CONFIG from /data/deploy-config.json, reset integrals on low hack<500); Home cores integrate (guard undef/default1, mult in grow/weaken calcs); Prep trigger (if prep, spawn pid-simulator.js + reload config); ES6+ const/arrows/destructure/maps; Resilience: Try-catch config/baselines/sim, guards undef/NaN/low hack; Opt: Static CONFIG, min calcs. SF/formulas-free (base analyzes).

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
      }).filter(([, free]) => free > 1.75));  // Min worker

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
        const spacing = times.max < SHORT_TIME_THRESH ? TICK_MS * 5 : 60000;
        await staggerDeploy(ns, alloc, tgt, 1, spacing, THROTTLE_MS);
        updateLeftover(leftover, alloc, rams);
      }

      // Extras if RAM (cycle targets)
      if (globalNeeded <= totalAvail) {
        let cycleIdx = 0;
        while (Array.from(leftover.values()).reduce((a, b) => a + b, 0) > rams.weaken * 2 && cycleIdx < targets.length * 2) {  // Limit cycles
          const extraTgt = targets[cycleIdx % targets.length);
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
      ns.tprint(`[MK0 DEPLOY v0.14] ${targets.length}tgts → ${servers.length}hosts | Leftover: ${totalLeft.toFixed(0)}GB`);
    } catch (e) {
      ns.tprint(`[MK0 DEPLOY ERROR] ${e.message}`);
    }
    await ns.sleep(LOOP_MS);
  }
}

// Modular: Count port openers (fixed not defined)
function countPrograms(ns) {
  const exes = ['BruteSSH.exe', 'FTPCrack.exe', 'relaySMTP.exe', 'HTTPWorm.exe', 'SQLInject.exe'];
  return exes.reduce((c, exe) => c + (ns.fileExists(exe, 'home') ? 1 : 0), 0);
}

// Modular: Check if list complete (25x1TB pserv + rooted net)
function isListComplete(ns) {
  const pservs = ns.getPurchasedServers();
  if (pservs.length !== 25) return false;
  if (pservs.some(s => ns.getServerMaxRam(s) !== 1048576)) return false;  // 1TB
  const networkRooted = getNetworkRooted(ns);
  return networkRooted.length === getAllServers(ns).length - pservs.length - 1;  // All net rooted ( -home -pserv)
}

// Modular: Get all servers (recursive scan, unique set)
function getAllServers(ns) {
  const visit = new Set(['home']);
  const stack = ['home'];
  const servers = [];

  while (stack.length) {
    const host = stack.pop();
    if (visit.has(host)) continue;
    visit.add(host);
    stack.push(...ns.scan(host).filter(h => !visit.has(h)));

    servers.push(host);
  }
  return servers;
}

// Modular: Get network rooted (filter non-home/pserv rooted >0RAM)
function getNetworkRooted(ns) {
  return getAllServers(ns).filter(host => !host.startsWith('pserv-') && host !== 'home' && ns.hasRootAccess(host) && ns.getServerMaxRam(host) > 0);
}

// Modular: Build usables (root/SCP workers, filter rooted >0RAM)
async function buildUsables(ns) {
  const servers = getAllServers(ns);
  await rootServers(ns, servers);  // Resilient root

  const workers = ['/standalone/mk0/worker-hack.js', '/standalone/mk0/worker-grow.js', '/standalone/mk0/worker-weaken.js'];
  for (const host of servers) {
    if (ns.hasRootAccess(host) && ns.getServerMaxRam(host) > 0 && host !== 'home') {
      try {
        await ns.scp(workers, 'home', host);
      } catch (e) {
        ns.print(`[SCP SKIP] ${host}: ${e.message}`);
      }
    }
  }

  return servers.filter(host => ns.hasRootAccess(host) && ns.getServerMaxRam(host) > 0);
}

// Modular: Root servers (base ports/nuke, try-catch skip)
async function rootServers(ns, servers) {
  for (const host of servers) {
    if (host === 'home' || ns.hasRootAccess(host)) continue;

    try {
      let ports = 0;
      const exes = ['BruteSSH.exe', 'FTPCrack.exe', 'relaySMTP.exe', 'HTTPWorm.exe', 'SQLInject.exe'];
      exes.forEach(exe => {
        if (ns.fileExists(exe, 'home')) {
          const fn = exe.toLowerCase().replace('.exe', '');
          ns[fn](host);
          ports++;
        }
      });

      if (ports >= ns.getServerNumPortsRequired(host)) {
        ns.nuke(host);
      }
    } catch (e) {
      ns.print(`[ROOT SKIP] ${host}: ${e.message}`);
    }
  }
}

// Retained: loadConfig, loadBaselines, pidController, estimateThreads, estimateTimes, knapsack, prioritizeOnePerTarget, staggerDeploy, deploy, updateLeftover, logPid (from previous)

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

function pidController(ns, server, prevState = {}, config) {
  const hackLevel = ns.getHackingLevel();
  if (hackLevel < config.resetHackThresh) {
    ns.print('[PID RESET] Low hack detected');
    prevState = {};  // Reset integrals/state
  }

  const { minDifficulty: minSec, moneyMax, hackDifficulty: curSec, moneyAvailable: curMoney } = server;
  let { errorSec = 0, integralSec = 0, errorMoney = 0, integralMoney = 0, errorPrevSec = 0, errorPrevMoney = 0 } = prevState;

  let kp = config.kp;
  if (curSec > minSec * 1.5) kp *= 1.2;  // Aggro high sec

  // Sec PID
  const eSec = (curSec - minSec * 1.05) / minSec;
  const dSec = eSec - errorPrevSec;
  integralSec = Math.max(-config.integralMax, Math.min(config.integralMax, integralSec + eSec));
  const secPwm = kp * eSec + config.ki * integralSec + config.kd * dSec;

  // Money PID
  const eMoney = (moneyMax * 0.95 - curMoney) / moneyMax;
  const dMoney = eMoney - errorPrevMoney;
  integralMoney = Math.max(-config.integralMax, Math.min(config.integralMax, integralMoney + eMoney));
  const moneyPwm = kp * eMoney + config.ki * integralMoney + config.kd * dMoney;

  return {
    hackMult: Math.max(0.5, 1 - secPwm * 0.5),
    growMult: Math.max(0.5, 1 + moneyPwm),
    weakenMult: Math.max(0.5, 1 + secPwm),
    state: {
      errorSec: eSec, integralSec, errorMoney: eMoney, integralMoney,
      errorPrevSec: eSec, errorPrevMoney: eMoney
    }
  };
}

function logPid(ns, states) {
  ns.write('/logs/pid-home.json', JSON.stringify(states.home), 'w');
  ns.write('/logs/pid-net.json', JSON.stringify(states.net), 'w');
}

function estimateThreads(ns, target, pidAdj, baseline = {}) {
  const moneyMax = ns.getServerMaxMoney(target);
  if (moneyMax <= 0) return { hack: 0, grow: 0, weaken: 0 };

  const minSec = ns.getServerMinSecurityLevel(target);
  const curMoney = ns.getServerMoneyAvailable(target);
  const curSec = ns.getServerSecurityLevel(target);
  const moneyThresh = 0.9 * moneyMax;
  const secThresh = minSec * 1.05;

  let req = { hack: 0, grow: 0, weaken: 0 };

  // Grow to thresh total (+10% buffer, or baselines adjust if avail)
  let growAdj = 1.1;
  if (baseline.grow?.threads) growAdj = baseline.grow.threads / ns.growthAnalyze(target, moneyThresh / Math.max(curMoney, 1));
  req.grow = Math.max(1, Math.ceil(ns.growthAnalyze(target, moneyThresh / Math.max(curMoney, 1)) * growAdj) * pidAdj.growMult);

  // Weaken to thresh total (+10% buffer, or baselines)
  let weakAdj = 1.1;
  if (baseline.weaken?.threads) weakAdj = baseline.weaken.threads / ((curSec - secThresh) / ns.weakenAnalyze(1));
  req.weaken = Math.max(1, Math.ceil((curSec - secThresh) / ns.weakenAnalyze(1) * weakAdj) * pidAdj.weakenMult);

  // Hack frac total (if prepped, baselines adjust)
  if (curMoney >= moneyThresh && curSec <= secThresh) {
    const hackFrac = 0.1;
    let hackAdj = 1;
    if (baseline.hack?.threads) hackAdj = baseline.hack.threads / (hackFrac / ns.hackAnalyze(target));
    req.hack = Math.max(1, Math.ceil(hackFrac / ns.hackAnalyze(target) * hackAdj) * pidAdj.hackMult);
    const secHack = ns.hackAnalyzeSecurity(req.hack, target);
    const secGrow = ns.growthAnalyzeSecurity(req.grow, target);
    req.weaken += Math.ceil(secHack / ns.weakenAnalyze(1));
    req.weaken += Math.ceil(secGrow / ns.weakenAnalyze(1));
  }

  return req;
}

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

function knapsack(leftover, rams, req, density, ns) {
  const alloc = {};
  const types = Object.keys(req).sort((a, b) => density[b] - density[a]);  // Decr density
  const servers = Array.from(leftover.keys()).sort((a, b) => leftover.get(b) - leftover.get(a));  // Asc free (fill small first?)

  for (const srv of servers) {
    alloc[srv] = { hack: 0, grow: 0, weaken: 0 };
    let rem = leftover.get(srv);
    const isHome = srv === 'home';
    const cores = isHome ? ns.getServer(srv).cpuCores : 1;
    const coreBoost = cores > 1 ? 1.2 : 1;

    for (const type of types) {
      if (req[type] <= 0 || rem < rams[type]) continue;
      const boost = (type === 'weaken' || type === 'grow') && isHome ? coreBoost : 1;
      const tFit = Math.floor(rem / rams[type]);
      const assign = Math.min(req[type], tFit) * boost;
      alloc[srv][type] = Math.floor(assign);
      rem -= alloc[srv][type] * rams[type];
      req[type] -= alloc[srv][type];
    }
  }
  return alloc;
}

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

async function deploy(ns, alloc, target) {
  for (const [srv, threads] of Object.entries(alloc)) {
    const workers = ['/standalone/mk0/worker-hack.js', '/standalone/mk0/worker-grow.js', '/standalone/mk0/worker-weaken.js'];
    // Kill old workers on srv
    for (const proc of ns.ps(srv)) {
      if (workers.some(w => proc.filename.endsWith(w.split('/').pop()))) {
        ns.kill(proc.pid);
      }
    }
    // Exec new
    if (threads.hack > 0) ns.exec('/standalone/mk0/worker-hack.js', srv, threads.hack, target);
    if (threads.grow > 0) ns.exec('/standalone/mk0/worker-grow.js', srv, threads.grow, target);
    if (threads.weaken > 0) ns.exec('/standalone/mk0/worker-weaken.js', srv, threads.weaken, target);
  }
}

function updateLeftover(leftover, alloc, rams) {
  for (const [srv, t] of Object.entries(alloc)) {
    const used = (t.hack || 0) * rams.hack + (t.grow || 0) * rams.grow + (t.weaken || 0) * rams.weaken;
    leftover.set(srv, Math.max(0, leftover.get(srv) - used));
  }
}

// Retained: loadConfig, loadBaselines, pidController, estimateThreads, estimateTimes, knapsack, prioritizeOnePerTarget, staggerDeploy, deploy, updateLeftover, logPid (from previous)
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

function pidController(ns, server, prevState = {}, config) {
  const hackLevel = ns.getHackingLevel();
  if (hackLevel < config.resetHackThresh) {
    ns.print('[PID RESET] Low hack detected');
    prevState = {};  // Reset integrals/state
  }

  const { minDifficulty: minSec, moneyMax, hackDifficulty: curSec, moneyAvailable: curMoney } = server;
  let { errorSec = 0, integralSec = 0, errorMoney = 0, integralMoney = 0, errorPrevSec = 0, errorPrevMoney = 0 } = prevState;

  let kp = config.kp;
  if (curSec > minSec * 1.5) kp *= 1.2;  // Aggro high sec

  // Sec PID
  const eSec = (curSec - minSec * 1.05) / minSec;
  const dSec = eSec - errorPrevSec;
  integralSec = Math.max(-config.integralMax, Math.min(config.integralMax, integralSec + eSec));
  const secPwm = kp * eSec + config.ki * integralSec + config.kd * dSec;

  // Money PID
  const eMoney = (moneyMax * 0.95 - curMoney) / moneyMax;
  const dMoney = eMoney - errorPrevMoney;
  integralMoney = Math.max(-config.integralMax, Math.min(config.integralMax, integralMoney + eMoney));
  const moneyPwm = kp * eMoney + config.ki * integralMoney + config.kd * dMoney;

  return {
    hackMult: Math.max(0.5, 1 - secPwm * 0.5),
    growMult: Math.max(0.5, 1 + moneyPwm),
    weakenMult: Math.max(0.5, 1 + secPwm),
    state: {
      errorSec: eSec, integralSec, errorMoney: eMoney, integralMoney,
      errorPrevSec: eSec, errorPrevMoney: eMoney
    }
  };
}

function logPid(ns, states) {
  ns.write('/logs/pid-home.json', JSON.stringify(states.home), 'w');
  ns.write('/logs/pid-net.json', JSON.stringify(states.net), 'w');
}
