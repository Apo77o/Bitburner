/** @param {NS} ns */
export async function main(ns) {
	let servers = ns.scan("home")
	let maxmoney = ns.getServerMaxMoney
	//let hackreq = ns.getServerRequiredHackingLevel
	//let reqports = ns.getServerNumPortsRequired
	//let minsec = ns.getServerMinSecurityLevel
	await ns.tprint([...servers, maxmoney]);
}