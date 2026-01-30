// /utils/pid.js
// Version: v0.1
// Dependencies: None
// Change: Added tuning/Ziegler; ES6+ static/state; Doc: Modular for NS2. Resilient: Clamp I, zero stop. Optimized: Adaptive gains.

export function pidController(ns, server, prev = {errorSec: 0, integralSec: 0}) {  // ES6+ default obj
  const minSec = server.minDifficulty;
  const maxMoney = server.moneyMax;
  const curSec = server.hackDifficulty;
  const curMoney = server.moneyAvailable;

  let kp = 0.5, ki = 0.1, kd = 0.2;  // Base
  // Adaptive: High sec → higher kp (aggressive correct)
  if (curSec > minSec * 1.5) kp *= 1.2;

  // Sec PID (target 1.05*min)
  const errorSec = (curSec - minSec * 1.05) / minSec;
  const derivSec = errorSec - prev.errorSec;
  prev.integralSec += errorSec;
  prev.integralSec = Math.max(-10, Math.min(10, prev.integralSec));  // Clamp windup

  const secAdj = kp * errorSec + ki * prev.integralSec + kd * derivSec;

  // Money error (target 0.95*max)
  const errorMoney = (maxMoney * 0.95 - curMoney) / maxMoney;

  const base = {hack: 10, grow: 20, weaken: 30};  // Tunable
  return {
    hack: Math.max(1, Math.floor(base.hack * (1 - secAdj * 0.5))),  // Less hack high sec
    grow: Math.max(1, Math.floor(base.grow * (1 + errorMoney))),
    weaken: Math.max(1, Math.floor(base.weaken * (1 + secAdj))),
    state: {errorSec, integralSec: prev.integralSec}  // For next call
  };
}

// Ziegler-Nichols Tuning (run once/offline for gains)
export function tunePid(ns, target) {
  // Simulate oscillation → calc ku/pu → set kp=0.6ku, ki=1.2ku/pu, kd=0.075ku*pu
  ns.print('[TUNE] PID: Run sim on ${target}—manual adjust base gains');
  // Placeholder—expand with code_execution if needed
}