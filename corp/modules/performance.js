// /corp/modules/performance.js
export function homeFreeGB(ns) {
  const home = "home";
  const max = ns.getServerMaxRam(home);
  const used = ns.getServerUsedRam(home);
  return Math.max(0, Math.floor(max - used));
}

export function guard(ns, requiredGB, cfg, ultralite = false) {
  if (ultralite) return false;
  const free = homeFreeGB(ns);
  return free >= (requiredGB + (cfg.ram.defaultReserveGB || 0));
}

export function throttleSamples(ns, desiredSamples, cfg) {
  const free = homeFreeGB(ns);
  const reserve = cfg.ram.defaultReserveGB || 0;
  if (free < reserve + 8) return Math.max(10, Math.floor(desiredSamples * 0.1));
  if (free < reserve + 16) return Math.max(20, Math.floor(desiredSamples * 0.25));
  if (free < reserve + 32) return Math.max(50, Math.floor(desiredSamples * 0.5));
  return desiredSamples;
}

export async function alert(ns, msg) {
  const path = "/logs/alerts.txt"; // use .txt
  const line = `${new Date().toISOString()} - ${msg}\n`;
  await ns.write(path, line, "a");
  ns.tprint("ALERT: " + msg);
}
