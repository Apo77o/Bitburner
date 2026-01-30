// /standalone/mk0/deployer.js
// Version: v0.7
// Dependencies: None (inline PID/knapsack)
// Merged Change: Expanded getServers recursive full (fix home only); Targets check/create if missing; PID call before batcher req; Logging (Conv2 append/rotate); ES6+ guards/arrows; Doc: Multi-target loop. Optimized: Density sort, home boost. Resilient: Skip 0/neg, try-catch. Func: Re-deploys on free.

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog('ALL');
  const sleepTime = 10000;
  let pidState = {};  // PID persist

  while (true) {
    try {
      let targets = ns.read('/data/targets.txt').split('\n').filter(t => t);
      if (!targets.length) {  // Check/create
        ns.print('[WARN] Targets.txt missing—creating default XP focus');
        const defaultTargets = ['n00dles', 'foodnstuff', 'joesguns'];  // Low req asc
        ns.write('/data/targets.txt', defaultTargets.join('\n'), 'w');
        targets = defaultTargets;
      }

      const servers = getServers(ns);  // Full recursive
      const rams = {hack: 1.7, grow: 1.75, weaken: 1.75};
      const density = {weaken: 1.2, grow: 1.0, hack: 0.8};

      let leftover = new Map(servers.map(s => [s, ns.getServerMaxRam(s) - ns.getServerUsedRam(s)]));

      for (const target of targets) {
        const server = ns.getServer(target);
        const pidAdj = pidController(ns, server, pidState);  // PID
        pidState = pidAdj.state;

        const req = estimateThreads(ns, target, pidAdj);  // Batcher + PID
        if (req.hack + req.grow + req.weaken <= 0) continue;

        const alloc = knapsack(leftover, rams, req, density, ns);
        deploy(ns, alloc, target);
        updateLeftover(leftover, alloc, rams);
      }

      // Leftover n00dles weaken
      const totalLeft = Array.from(leftover.values()).reduce((a, b) => a + b, 0);
      if (totalLeft > rams.weaken) {
        const nReq = {weaken: Math.floor(totalLeft / rams.weaken)};
        const nAlloc = knapsack(leftover, rams, nReq, density, ns);
        deploy(ns, nAlloc, 'n00dles');
      }

      logPid(ns, pidState);  // Conv2 log
      ns.tprint('[MK0 DEPLOY v0.7] Batch complete—re-checking in 10s');
    } catch (e) {
      ns.print(`[ERROR] Deploy fail: ${e}`);
    }
    await ns.sleep(sleepTime);
  }
}

// Servers: Recursive full (fix home only)
function getServers(ns) {
  const visited = new Set(['home']);
  const stack = ns.scan('home');
  const servers = [];

  while (stack.length) {
    const srv = stack.pop();
    if (visited.has(srv)) continue;
    visited.add(srv);
    stack.push(...ns.scan(srv));

    if (ns.hasRootAccess(srv) && ns.getServerMaxRam(srv) > 0) servers.push(srv);
  }

  // Sort: Network → recent p-serv → home
  const network = servers.filter(s => !s.startsWith('pserv') && s !== 'home');
  const pservs = servers.filter(s => s.startsWith('pserv')).sort((a, b) => parseInt(b.split('-')[1]) - parseInt(a.split('-')[1]));
  return [...network, ...pservs, 'home'];
}

// Heuristic + PID mult + prep
function estimateThreads(ns, target, pidAdj) {
  const moneyMax = ns.getServerMaxMoney(target);
  if (moneyMax <= 0) return {hack: 0, grow: 0, weaken: 0};

  const minSec = ns.getServerMinSecurityLevel(target);
  const curMoney = ns.getServerMoneyAvailable(target);
  const curSec = ns.getServerSecurityLevel(target);
  const moneyThresh = 0.9 * moneyMax;
  const secThresh = 1.05 * minSec;

  if (curMoney < moneyThresh || curSec > secThresh) {  // Prep if out-range
    const weakT = Math.ceil((curSec - minSec) / ns.weakenAnalyze(1));
    const growT = Math.ceil(ns.growthAnalyze(target, moneyMax / Math.max(1, curMoney)));
    return {hack: 0, grow: growT, weaken: weakT};
  }

  // Normal HWGW
  const hackFrac = 0.1;
  const hackT = Math.ceil(hackFrac / ns.hackAnalyze(target)) || 1;
  const post = moneyMax * (1 - hackFrac);
  const growT = Math.ceil(ns.growthAnalyze(target, moneyMax / post)) || 1;
  const secH = ns.hackAnalyzeSecurity(hackT);
  const secG = ns.growthAnalyzeSecurity(growT);
  const weakPer = ns.weakenAnalyze(1);
  return {
    hack: Math.max(1, hackT * pidAdj.hackMult),
    grow: Math.max(1, growT * pidAdj.growMult),
    weaken: Math.max(1, Math.ceil((secH + secG) / weakPer) * pidAdj.weakenMult)
  };
}

// Knapsack: Home boost
function knapsack(leftover, rams, req, density, ns) {
  const alloc = {};
  const types = ['weaken', 'grow', 'hack'].sort((a, b) => density[b] - density[a]);
  for (const srv of Array.from(leftover.keys()).sort((a, b) => leftover.get(b) - leftover.get(a))) {
    alloc[srv] = {hack: 0, grow: 0, weaken: 0};
    let rem = leftover.get(srv);
    const isHome = srv === 'home';
    const cores = isHome ? ns.getServer(srv).cpuCores : 1;
    const coresFactor = cores > 1 ? 1.2 : 1;

    for (const type of types) {
      if (req[type] <= 0) continue;
      const typeDensity = density[type] * (['weaken', 'grow'].includes(type) && isHome ? coresFactor : 1);
      const ramPer = rams[type];
      if (rem < ramPer) continue;

      const base = Math.min(req[type], Math.floor(rem / ramPer));
      alloc[srv][type] += base;
      rem -= base * ramPer;
      req[type] -= base;

      if (rem >= ramPer && req[type] > 0) {
        const scale = Math.min(2, Math.floor(rem / ramPer), req[type]);
        alloc[srv][type] += scale;
        rem -= scale * ramPer;
        req[type] -= scale;
      }
    }
  }
  return alloc;
}

// Deploy >0
function deploy(ns, alloc, target) {
  for (const [srv, t] of Object.entries(alloc)) {
    if (t.hack > 0) ns.exec('/standalone/mk0/worker-hack.js', srv, t.hack, target);
    if (t.grow > 0) ns.exec('/standalone/mk0/worker-grow.js', srv, t.grow, target);
    if (t.weaken > 0) ns.exec('/standalone/mk0/worker-weaken.js', srv, t.weaken, target);
  }
}

// Update
function updateLeftover(leftover, alloc, rams) {
  for (const [srv, t] of Object.entries(alloc)) {
    const used = t.hack * rams.hack + t.grow * rams.grow + t.weaken * rams.weaken;
    leftover.set(srv, leftover.get(srv) - used);
  }
}

// PID (adaptive, multi-var)
function pidController(ns, server, prev = {errorSec: 0, integralSec: 0, errorMoney: 0, integralMoney: 0, errorPrevSec: 0, errorPrevMoney: 0}) {
  const minSec = server.minDifficulty;
  const maxMoney = server.moneyMax;
  const curSec = server.hackDifficulty;
  const curMoney = server.moneyAvailable;

  let kp = 0.5, ki = 0.1, kd = 0.2;  // Adaptive: High sec kp *1.2
  if (curSec > minSec * 1.5) kp *= 1.2;

  // Sec PID
  const errorSec = (curSec - minSec * 1.05) / minSec;
  const derivSec = errorSec - prev.errorPrevSec;
  prev.integralSec += errorSec;
  prev.integralSec = Math.max(-10, Math.min(10, prev.integralSec));

  const secAdj = kp * errorSec + ki * prev.integralSec + kd * derivSec;

  // Money PID
  const errorMoney = (maxMoney * 0.95 - curMoney) / maxMoney;
  const derivMoney = errorMoney - prev.errorPrevMoney;
  prev.integralMoney += errorMoney;
  prev.integralMoney = Math.max(-10, Math.min(10, prev.integralMoney));

  const moneyAdj = kp * errorMoney + ki * prev.integralMoney + kd * derivMoney;

  return {
    hackMult: 1 - secAdj * 0.5,
    growMult: 1 + moneyAdj,
    weakenMult: 1 + secAdj,
    state: {errorSec, integralSec: prev.integralSec, errorMoney, integralMoney: prev.integralMoney, errorPrevSec: errorSec, errorPrevMoney: errorMoney}
  };
}

// Log PID (Conv2 minimal—append, rotate >1000)
function logPid(ns, state) {
  const logPath = '/logs/pid-tune.txt';
  const entry = {ts: Date.now(), state};
  ns.write(logPath, JSON.stringify(entry) + '\n', 'a');

  // Rotate (Conv2 style—clear if >1000)
  const lines = ns.read(logPath).split('\n').length;
  if (lines > 1000) ns.write(logPath, '', 'w');
}