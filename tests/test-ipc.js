// /tests/test-ipc.js
import { atomicWrite, acquireLock, releaseLock, pushEvent, readEvents, markProcessed } from "/corp/modules/ipc.js";

export async function run(ns) {
  ns.disableLog("sleep");
  const testFile = "/data/test-ipc.txt";
  await atomicWrite(ns, testFile, JSON.stringify({ ok: true, ts: new Date().toISOString() }));
  if (!ns.fileExists(testFile)) { ns.tprint("test-ipc: atomicWrite failed"); return false; }

  const locksDir = "/data/locks";
  const lockName = "testlock";
  const locked = await acquireLock(ns, locksDir, lockName, 2000);
  if (!locked) { ns.tprint("test-ipc: acquireLock failed"); return false; }
  await releaseLock(ns, locksDir, lockName);

  const eventsPath = "/data/test-events.log"; // events are data files; keep .log if you prefer
  const processedIdx = "/data/test-events-idx.txt";
  await pushEvent(ns, eventsPath, { type: "test", payload: { v: 1 } });
  const { events, nextIndex } = readEvents(ns, eventsPath, processedIdx, 10);
  if (!events || events.length === 0) { ns.tprint("test-ipc: readEvents failed"); return false; }
  await markProcessed(ns, processedIdx, nextIndex);

  // Write a small test result to logs (use .txt)
  await ns.write("/logs/test-ipc-result.txt", `${new Date().toISOString()} - PASS\n`, "a");
  ns.tprint("test-ipc: PASS");
  return true;
}
