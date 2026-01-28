/** @param {NS} ns */
export async function main(ns) {
	let network = ns.getPurchasedServers();
	ns.tprint ([network,]);
	let servers = [];

	let serversToScan = network;
	while (serversToScan.length > 0) {
		let server = serversToScan.shift();
			let maxram = ns.getServerMaxRam (server)
			ns.tprint ([server, maxram]);
		if (!servers.includes(server) && server !== "home") {
			servers.push(server);
		}
	}	
}