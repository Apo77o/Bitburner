/** @param {NS} ns */
export async function main(ns) {
	let target = ns.args[0];
	let maxmoney = ns.getServerMaxMoney(target);
	let port = ns.getServerNumPortsRequired(target);
	let hackreq = ns.getServerRequiredHackingLevel(target);
	let minsec = ns.getServerMinSecurityLevel(target);
	let growth = ns.getServerGrowth(target);
	let serverram = ns.getServerMaxRam(target)
	
	//await ns.getServerMaxMoney(target)
	//await ns.getServerRequiredHackingLevel(target)
	//await ns.getServerMinSecurityLevel(target)
	//await ns.getServerGrowth(target)

	ns.tprint([target, "server max money", maxmoney, port, hackreq, minsec, growth]);
	ns.write ((target += "-analysis.txt"), [maxmoney, port, hackreq, minsec, growth,], "a");
	ns.tprint (["Server Max Ram", serverram])
}