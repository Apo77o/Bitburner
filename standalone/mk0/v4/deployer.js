// /standalone/mk0/v4/deployer.js
// Version: v0.9
// Dependencies: /shared/hack.js, /shared/grow.js, /shared/weaken.js (light auto-die from home)
// Merged Change: Changed to one worker/type per server with max threads (fill RAM with -t for determined type); ES6+ let/const/arrows; Doc: Simple single target HGW deployer (iterative over v0.8—3 dedicated workers, no combined). Resilient: Root/freeRAM guards, try-catch SCP/exec. Optimized: Floor threads max fit/type, 1s throttle. Func: Remote worker exec with type/target arg + max threads/server; Skip scan/cracker if complete list, regen on new programs.

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog('ALL');
  const target = ns.args[0] || 'n00dles';  // Args or fallback
  const workers = {hack: "/shared/hack.js", grow: "/shared/grow.js", weaken: "/shared/weaken.js"};
  const hackRam = ns.getScriptRam(workers.hack);  // Get once
  const growRam = ns.getScriptRam(workers.grow);
  const weakenRam = ns.getScriptRam(workers.weaken);
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
        // SCP workers from home
        for (const workerPath of Object.values(workers)) {
          await ns.scp(workerPath, host);
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
          for (const workerPath of Object.values(workers)) {
            await ns.scp(workerPath, host);
          }
        }
      }
      ns.write('/data/usables.txt', servers.join('\n'), 'w');  // Re-cache
    }

    for (const host of servers) {
      const ramAvailable = ns.getServerMaxRam(host) - ns.getServerUsedRam(host);
      if (ramAvailable <= 0 || !ns.hasRootAccess(host)) continue;  // Guard

      // Determine type by thresh, run one worker with max threads (fill RAM with -t for that type)
      let type, ramPer;
      if (ns.getServerSecurityLevel(target) > securityThresh) {
        type = 'weaken';
        ramPer = weakenRam;
      } else if (ns.getServerMoneyAvailable(target) < moneyThresh) {
        type = 'grow';
        ramPer = growRam;
      } else {
        type = 'hack';
        ramPer = hackRam;
      }

      const threads = Math.floor(ramAvailable / ramPer);
      if (threads > 0) ns.exec(workers[type], host, threads, target);  // Exec one type with max -t
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
