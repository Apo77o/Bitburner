/** @param {NS} ns */
export async function main(ns) {
	let servers = [];

	let serversToScan = ns.scan("home");
	while (serversToScan.length > 0) {
		let server = serversToScan.shift();
		if (!servers.includes(server) && server !== "home") {
			servers.push(server);
			serversToScan = serversToScan.concat(ns.scan(server));
		}

		let maxmoney = ns.getServerMaxMoney(server);
		let growth = ns.getServerGrowth(server);
		ns.tprint(server);
		ns.write("Servers.txt", [server, maxmoney, growth,], "a");
		ns.tprint([maxmoney,]);
		ns.tprint (servers.length);

	}
}