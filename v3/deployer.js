/** @param {NS} ns **/
export async function main(ns) {
    let servers = [];
    let ramPerThread = ns.getScriptRam("early-hack-template.js");
    let target = ns.args[0];
    let moneyThresh = ns.getServerMaxMoney(target) * 0.75;
    let securityThresh = ns.getServerMinSecurityLevel(target) + 5;

    let serversToScan = ns.scan("home");
    while (serversToScan.length > 0) {
        let server = serversToScan.shift();
        if (!servers.includes(server) && server !== "home") {
            servers.push(server);
            serversToScan = serversToScan.concat(ns.scan(server));

            // Get root access
            let openPorts = 0;
            if (ns.fileExists("BruteSSH.exe")) {
                ns.brutessh(server);
                openPorts++;
            }
            if (ns.fileExists("FTPCrack.exe")) {
                ns.ftpcrack(server);
                openPorts++;
            }
            if (ns.fileExists("RelaySMTP.exe")) {
                ns.relaysmtp(server);
                openPorts++;
            }
            if (ns.fileExists("HTTPWorm.exe")) {
                ns.httpworm(server);
                openPorts++;
            }
            if (ns.fileExists("SQLInject.exe")) {
                ns.sqlinject(server);
                openPorts++;
            }
            if (ns.getServerNumPortsRequired(server) <= openPorts) {
                ns.nuke(server);
            }

            if (ns.hasRootAccess(server)) {
                // Deploy the 'early-hack-template' script
                await ns.scp("early-hack-template.js", server);
                let ramAvailable = ns.getServerMaxRam(server)
                    - ns.getServerUsedRam(server);
                let threads = Math.floor(ramAvailable / ramPerThread);
                if (threads > 0) {
                    ns.exec("early-hack-template.js", server, threads, "joesguns");
                }
            }
        }
    }
    


    while (true) {
        if (ns.getServerSecurityLevel(target) > securityThresh) {
            sleeptime = ns.getWeakenTime(target)
            await ns.exec("/shared/weaken.js", server, threads, target);
        } else if (ns.getServerMoneyAvailable(target) < moneyThresh) {
            await ns.exec("/shared/grow.js", server, threads, target);
        } else {
            await ns.exec("/shared/hack.js", server, threads, target);
        }
    }
}