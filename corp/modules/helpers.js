// /corp/modules/helpers.js
export function isDryRun(ns) {
  if (!ns.fileExists("/data/corp-mode.txt")) return false;
  return ns.read("/data/corp-mode.txt").trim().toUpperCase() === "DRYRUN";
}

export async function detectEmployeeAPIs(ns) {
  const hasAutoAssign = !!ns.corporation.setAutoJobAssignment;
  const hasAssignJob = !!ns.corporation.assignJob;
  const line = `${new Date().toISOString()} - autoAssign:${hasAutoAssign} assignJob:${hasAssignJob}\n`;
  // write to /logs/hiring.txt (text file)
  await ns.write("/logs/hiring.txt", line, "a");
  if (!hasAutoAssign) ns.print("Warning: setAutoJobAssignment not available; using fallback heuristics.");
  return { hasAutoAssign, hasAssignJob };
}
