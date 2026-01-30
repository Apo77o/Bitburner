// /utils/knapsack.js
// Version: v0.3
// Dependencies: None
// Change: Greedy → Hybrid DP for exact (if leftover < threshold); ES6+ memo/map; Doc: Modular for NS2. Resilient: Bound W, skip 0. Optimized: Memo for O(nW) <1s.

export function solveKnapsack(ns, servers, rams, req, density, threshold = 100 * 1.6) {  // ES6+ default param
  const alloc = {};
  const types = ['weaken', 'grow', 'hack'].sort((a, b) => density[b] - density[a]);
  const isHome = srv => srv === 'home';
  const avgCores = 1;  // Placeholder—calc from servers if needed
  const leftover = new Map(servers.map(s => [s, ns.getServerMaxRam(s) - ns.getServerUsedRam(s)]));

  for (const targetType of types) {  // Parallel-ish by type
    let typeReq = req[targetType];
    if (typeReq <= 0) continue;

    for (const srv of Array.from(leftover.keys()).sort((a, b) => leftover.get(b) - leftover.get(a))) {
      alloc[srv] = alloc[srv] || {hack: 0, grow: 0, weaken: 0};
      let rem = leftover.get(srv);
      if (rem < rams[targetType]) continue;

      const cores = isHome(srv) ? ns.getServer(srv).cpuCores : 1;
      const coresFactor = cores > avgCores ? cores / avgCores : 1;
      const typeDensity = density[targetType] * (['weaken', 'grow'].includes(targetType) ? coresFactor : 1);

      let threads;
      if (rem < threshold) {  // DP for small rem (exact)
        threads = dpKnapsack(rem, rams[targetType], typeReq, typeDensity);  // Exact threads
      } else {  // Greedy for large
        threads = Math.min(typeReq, Math.floor(rem / rams[targetType]));
      }

      alloc[srv][targetType] += threads;
      rem -= threads * rams[targetType];
      typeReq -= threads;
      leftover.set(srv, rem);

      if (typeReq <= 0) break;
    }
  }
  return alloc;
}

// DP Helper: 0-1 for threads (memoized)
function dpKnapsack(cap, weight, maxItems, value) {
  const memo = new Map();  // ES6+ Map for memo
  function recurse(remCap, itemsLeft) {
    const key = `${remCap}-${itemsLeft}`;
    if (memo.has(key)) return memo.get(key);
    if (itemsLeft === 0 || remCap < weight) return 0;

    const skip = recurse(remCap, itemsLeft - 1);
    const take = remCap >= weight ? value + recurse(remCap - weight, itemsLeft - 1) : 0;
    const max = Math.max(skip, take);
    memo.set(key, max);
    return max;
  }
  return recurse(cap, maxItems);
}