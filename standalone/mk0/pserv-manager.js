// /standalone/mk0/pserv-manager.js
// Version: v0.6
// Dependencies: None
// Merged Change: Math opt (buy biggest batch > current if <25, else *2 incremental on low/oldest); Dynamic sleep reset on action; ES6+ const/maps/sort; Doc: Resilient guards. Optimized: Low/oldest first (naming low num = oldest). Func: Loop forever/break on max, log progress.

 /** @param {NS} ns */
export async function main(ns) {
  ns.disableLog('ALL');
  const maxServers = 25;
  const maxRam = 2 ** 20;  // 1PTB
  const tiers = [2, 4, 8, /* full powers of 2 */ 1048576];  // 2GB to 1PTB
  let sleepTime = 10000;  // Start 10s

  while (true) {
    try {
      let pservs = ns.getPurchasedServers();
      const money = ns.getPlayer().money;
      let actionTaken = false;

      if (pservs.length < maxServers) {  // Buy phase (math opt: biggest > current)
        const currentMax = pservs.length ? Math.max(...pservs.map(s => ns.getServerMaxRam(s))) : 0;
        let buyRam = tiers[tiers.length - 1];  // High start
        for (let i = tiers.length - 1; i >= 0; i--) {
          if (tiers[i] <= currentMax) continue;  // Skip <= current
          const batchSize = maxServers - pservs.length;
          const cost = ns.getPurchasedServerCost(tiers[i]) * batchSize;
          if (money >= cost) {
            buyRam = tiers[i];
            break;
          }
        }
        const fallback = money < ns.getPurchasedServerCost(tiers[0]) * (maxServers - pservs.length);
        for (let j = pservs.length; j < maxServers; j++) {
          const ram = fallback ? tiers[0] : buyRam;
          if (money < ns.getPurchasedServerCost(ram)) break;
          ns.purchaseServer(`pserv-${j}`, ram);
          actionTaken = true;
        }
      } else {  // Upgrade phase (low/oldest first—sort RAM asc, then name asc low num=oldest)
        pservs = pservs.sort((a, b) => {
          const ramA = ns.getServerMaxRam(a);
          const ramB = ns.getServerMaxRam(b);
          if (ramA !== ramB) return ramA - ramB;  // Low RAM first
          const numA = parseInt(a.split('-')[1]);
          const numB = parseInt(b.split('-')[1]);
          return numA - numB;  // Oldest low num
        });
        for (const srv of pservs) {
          const current = ns.getServerMaxRam(srv);
          if (current === maxRam) continue;
          const next = current * 2;  // *2 (next power)
          const cost = ns.getPurchasedServerUpgradeCost(srv, next);
          if (money >= cost && next <= maxRam) {
            ns.upgradePurchasedServer(srv, next);
            actionTaken = true;
          }
        }
      }

      // Complete? Break + log
      pservs = ns.getPurchasedServers();
      if (pservs.length === maxServers && pservs.every(s => ns.getServerMaxRam(s) === maxRam)) {
        ns.tprint('[MK0 PSERV v0.6] Complete—25x1PTB');
        break;
      }

      // Dynamic sleep: Action → reset 10s, no → *2 (max 5min)
      sleepTime = actionTaken ? 10000 : Math.min(sleepTime * 2, 300000);
    } catch (e) {
      ns.print(`[ERROR] Pserv fail: ${e}`);
      sleepTime = 10000;  // Reset on error
    }

    await ns.sleep(sleepTime);
  }
}