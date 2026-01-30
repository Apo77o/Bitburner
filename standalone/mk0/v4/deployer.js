// /standalone/mk0/v4/deployer.js
// Version: v0.8
// Dependencies: /shared/hack.js, /shared/grow.js, /shared/weaken.js (light auto-die from home)
// Merged Change: Treat home like any other server (deploy HGW workers with same method, no skip SCP on home—harmless as repo); ES6+ let/const/arrows; Doc: Simple single target HGW deployer (iterative over v3—3 dedicated workers, no combined). Resilient: Root/freeRAM guards, try-catch SCP/exec. Optimized: Floor threads max fit, 1s throttle. Func: Remote worker exec with target arg + threads; Skip scan/cracker if complete list, regen on new programs.

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog('ALL');
  const target = ns.args[0] || 'n00dles';  // Args or fallback
  const workers = ["/shared/hack.js", "/shared/grow.js", "/shared/weaken.js"];
  const hackRam = ns.getScriptRam(workers[0]);  // Get once
  const growRam = ns.getScriptRam(workers[1]);
  const weakenRam = ns.getScriptRam(workers[2]);
  let moneyThresh = ns.getServerMaxMoney(target) * 0.9;
  let securityThresh = ns.getServerMinSecurityLevel(target) + 5;

  let lastNumPrograms = countPrograms(ns);  // Initial for regen

  // Scan/root/SCP workers (usable list: home/p-serv/rooted network >0RAM)
  let servers = [];
  if (!isListComplete(ns)) {
    let serversToScan = ns.scan("home");
    while (serversToScan.length > 0) {
      let host = serversToScan.shift();
      if (servers.includes(host)) continue;
      servers.push(host);
      serversToScan = serversToScan.concat(ns.scan(host));

      // Root (resilient port count)
      let openPorts = 0;
      try {
        if (ns.fileExists("BruteSSH.exe")) { ns.brutessh(host); openPorts++; }
        if (ns.fileExists("FTPCrack.exe")) { ns.ftpcrack(host); openPorts++; }
        if (ns.fileExists("relaySMTP.exe")) { ns.relaysmtp(host); openPorts++; }
        if (ns.fileExists("HTTPWorm.exe")) { ns.httpworm(host); openPorts++; }
        if (ns.fileExists("SQLInject.exe")) { ns.sqlinject(host); openPorts++; }
        if (ns.getServerNumPortsRequired(host) <= openPorts) ns.nuke(host);
      } catch (e) {
        ns.print(`[ERROR] Root fail on ${host}: ${e}`);  // Resilience
      }

      if (ns.hasRootAccess(host) && ns.getServerMaxRam(host) > 0) {  // Usable filter
        // SCP workers from home (now includes home—harmless)
        for (const worker of workers) {
          await ns.scp(worker, host);
        }
      }
    }
    // Cache usables
    ns.write('/data/usables.txt', servers.join('\n'), 'w');
  } else {
    // Load cached
    servers = ns.read('/data/usables.txt').split('\n').filter(s => s);
  }

  while (true) {
    let numPrograms = countPrograms(ns);
    if (numPrograms > lastNumPrograms) {  // New cracker—regen list
      ns.print('[INFO] New program—regen usable list');
      lastNumPrograms = numPrograms;
      servers = [];  // Reset and re-scan
      let serversToScan = ns.scan("home");
      while (serversToScan.length > 0) {
        let host = serversToScan.shift();
        if (servers.includes(host)) continue;
        servers.push(host);
        serversToScan = serversToScan.concat(ns.scan(host));

        // Root (resilient port count)
        let openPorts = 0;
        try {
          if (ns.fileExists("BruteSSH.exe")) { ns.brutessh(host); openPorts++; }
          if (ns.fileExists("FTPCrack.exe")) { ns.ftpcrack(host); openPorts++; }
          if (ns.fileExists("relaySMTP.exe")) { ns.relaysmtp(host); openPorts++; }
          if (ns.fileExists("HTTPWorm.exe")) { ns.httpworm(host); openPorts++; }
          if (ns.fileExists("SQLInject.exe")) { ns.sqlinject(host); openPorts++; }
          if (ns.getServerNumPortsRequired(host) <= openPorts) ns.nuke(host);
        } catch (e) {
          ns.print(`[ERROR] Root fail on ${host}: ${e}`);  // Resilience
        }

        if (ns.hasRootAccess(host) && ns.getServerMaxRam(host) > 0) {  // Usable filter
          // SCP workers from home
          for (const worker of workers) {
            await ns.scp(worker, host);
          }
        }
      }
      ns.write('/data/usables.txt', servers.join('\n'), 'w');  // Re-cache
    }

    for (const host of servers) {
      const ramAvailable = ns.getServerMaxRam(host) - ns.getServerUsedRam(host);
      if (ramAvailable <= 0 || !ns.hasRootAccess(host)) continue;  // Guard

      // HGW loop (exec with target arg + threads per type RAM—same method for home/other)
      if (ns.getServerSecurityLevel(target) > securityThresh) {
        const threads = Math.floor(ramAvailable / weakenRam);
        if (threads > 0) ns.exec("/shared/weaken.js", host, threads, target);
      } else if (ns.getServerMoneyAvailable(target) < moneyThresh) {
        const threads = Math.floor(ramAvailable / growRam);
        if (threads > 0) ns.exec("/shared/grow.js", host, threads, target);
      } else {
        const threads = Math.floor(ramAvailable / hackRam);
        if (threads > 0) ns.exec("/shared/hack.js", host, threads, target);
      }
    }

    await ns.sleep(1000);  // 1s throttle
  }
}

// Count programs for regen check
function countPrograms(ns) {
  return ['BruteSSH.exe', 'FTPCrack.exe', 'relaySMTP.exe', 'HTTPWorm.exe', 'SQLInject.exe'].reduce((count, exe) => count + (ns.fileExists(exe) ? 1 : 0), 0);
}

// Check if list complete (home +25 maxRAM p-serv + all rooted network >0RAM)
function isListComplete(ns) {
  const pservs = ns.getPurchasedServers();
  if (pservs.length !== 25) return false;
  if (!pservs.every(s => ns.getServerMaxRam(s) === 1048576)) return false;  // Max 1PTB
  const network = servers.filter(s => !s.startsWith('pserv') && s !== 'home');
  if (network.some(s => !ns.hasRootAccess(s) && ns.getServerMaxRam(s) > 0)) return false;
  return true;
}