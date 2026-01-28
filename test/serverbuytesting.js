/** @param {NS} ns */
export async function main(ns) {
	let limit = ns.getPurchasedServerLimit("home");
	let maxram = ns.getPurchasedServerMaxRam("home");
	let cost = ns.getPurchasedServerCost(maxram);
	let networkcost = (cost * limit)
	let maxserverram = (limit * maxram)

	//ns.upgradeHomeRam
	//ns.upgradeHomeCores
	//let corecost = ns.getUpgradeHomeCoresCost
	//let ramcost = ns.getUpgradeHomeRamCost
	if (ns.getServerMoneyAvailable(ns.args[0]) < 1); {
		let growamount = (ns.getServerMaxMoney(ns.args[0]))
		ns.tprint(growamount);
		let growthreads = ns.growthAnalyze("n00dles", growamount,);
		ns.tprint(growthreads);	}
	if (ns.getServerMoneyAvailable(ns.args[0]) > 1); {
		let growamount = (ns.getServerMoneyAvailable(ns.args[0]) / ns.getServerMaxMoney(ns.args[0]));
		ns.tprint(growamount);
		//let growthreads = ns.growthAnalyze("n00dles", growamount,);
		//ns.tprint(growthreads);
	}



	//let server = ns.getServer(ns.args[0])
	//ns.singularity.installBackdoor
	//ns.sleeve.setToGymWorkout

	

	ns.tprint([limit, maxram, cost,]);
	ns.tprint(networkcost);
	//ns.tprint(maxserverram);
	//ns.tprint(corecost, ramcost,);
	//ns.tprint (server);
}