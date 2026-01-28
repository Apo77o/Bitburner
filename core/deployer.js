// /core/deployer.js
/** @param {NS} ns **/
export async function main(ns) {
  ns.disableLog("sleep");
  const HOME = "home";
  const RESERVE_PATH = "/data/corp-ram-reserve.txt";
  const CONFIRM_PATH = "/data/deployer-confirm.txt";
  const TEMP_CONFIRM_PATH = "/data/deployer-confirm.tmp";
  let desiredGB = 0;
  if (ns.fileExists(RESERVE_PATH)) desiredGB = Number(ns.read(RESERVE_PATH).trim()) || 0;
  if (!desiredGB || desiredGB <= 0) desiredGB = 4;
  const homeMax = ns.getServerMaxRam(HOME);
  const homeUsed = ns.getServerUsedRam(HOME);
  const homeFree = Math.max(0, homeMax - homeUsed);
  let canReserveGB = Math.floor(homeFree);
  if (canReserveGB < 4) canReserveGB = 4;
  const reservedGB = Math.min(desiredGB, canReserveGB);
  const confirmPayload = { reserved: reservedGB, ts: new Date().toISOString() };
  await ns.write(TEMP_CONFIRM_PATH, JSON.stringify(confirmPayload), "w");
  await ns.write(CONFIRM_PATH, JSON.stringify(confirmPayload), "w");
  try { await ns.rm(TEMP_CONFIRM_PATH); } catch {}
  ns.tprint(`Deployer: confirmed RAM reservation ${reservedGB} GB (desired ${desiredGB} GB).`);
  // Deploy scripts to rooted servers (simple copy + exec logic)
  const scripts = ["/core/batcher.js"];
  const rooted = getAllRootedServers(ns);
  for (const host of rooted) {
    for (const script of scripts) {
      try { if (!ns.fileExists(script, host)) await ns.scp(script, "home", host); } catch {}
      const ramPerThread = ns.getScriptRam(script, host);
      if (!ramPerThread) continue;
      const freeRam = ns.getServerMaxRam(host) - ns.getServerUsedRam(host);
      const threads = Math.floor(freeRam / ramPerThread);
      if (threads <= 0) continue;
      try { ns.exec(script, host, threads); } catch {}
    }
  }
  // Deploy to home respecting reservedGB
  const usableRam = Math.max(0, homeFree - reservedGB);
  for (const script of scripts) {
    const ramPerThread = ns.getScriptRam(script, HOME);
    if (!ramPerThread) continue;
    const threads = Math.floor(usableRam / ramPerThread);
    if (threads <= 0) continue;
    try { if (!ns.fileExists(script, HOME)) await ns.scp(script, "home", HOME); ns.exec(script, HOME, threads); } catch {}
  }
}

function getAllRootedServers(ns) {
  const visited = new Set();
  const stack = ["home"];
  const rooted = [];
  while (stack.length) {
    const host = stack.pop();
    if (!host || visited.has(host)) continue;
    visited.add(host);
    for (const n of ns.scan(host)) stack.push(n);
    if (host === "home") continue;
    if (!ns.hasRootAccess(host)) continue;
    if (ns.getServerMaxRam(host) <= 0) continue;
    rooted.push(host);
  }
  return rooted;
}
