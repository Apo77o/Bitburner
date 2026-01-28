// /tests/test-mc.js
export async function run(ns) {
  ns.disableLog("sleep");
  function randNormal(mu, sigma) {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return z * sigma + mu;
  }

  const samples = 500;
  const mu = 1000;
  const sigma = 200;
  const vals = [];
  for (let i = 0; i < samples; i++) vals.push(randNormal(mu, sigma));
  const mean = vals.reduce((a,b)=>a+b,0)/vals.length;
  const variance = vals.reduce((a,b)=>a + Math.pow(b-mean,2),0)/vals.length;
  const std = Math.sqrt(variance);
  ns.tprint(`test-mc: mean=${Math.round(mean)} std=${Math.round(std)}`);
  await ns.write("/logs/test-mc-result.txt", `${new Date().toISOString()} - mean=${Math.round(mean)} std=${Math.round(std)}\n`, "a");
  if (Math.abs(mean - mu) > sigma) { ns.tprint("test-mc: FAIL mean off"); return false; }
  ns.tprint("test-mc: PASS");
  return true;
}
