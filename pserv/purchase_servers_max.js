/** @param {NS} ns **/
export async function main(ns) {
    let ram = ns.getPurchasedServerMaxRam();
    let servers = ns.getPurchasedServers();
    ns.tprint([ram,(ns.getPurchasedServerCost(ns.getPurchasedServerMaxRam()))]);

    while (true) {
        for (let i = 0; i < ns.getPurchasedServerLimit(); i++) {
            let name = ("pserv-" + i);
            while (ns.getPurchasedServerCost(ram) > ns.getServerMoneyAvailable("home")) {
                await ns.sleep(3000);
            }
            if (servers.includes(name)) {
                if (ns.getServerMaxRam(name) < ram) {
                    ns.killall(name);
                    ns.deleteServer(name);
                } else {
                    continue;
                }
            }
            ns.purchaseServer(name, ram);
        }

        servers = ns.getPurchasedServers();
        await ns.sleep(1000);
    }
}