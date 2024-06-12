"use strict";

// TODO:
// 
class AddManagedPathsPlugin {
	constructor(managedPaths, immutablePaths) {
		// Webpack.Config.snap.managedPaths
		this.managedPaths = new Set(managedPaths);
		// Webpack.Config.snap.immutablePaths
		this.immutablePaths = new Set(immutablePaths);
	}

	apply(compiler) {
		for (const managedPath of this.managedPaths) {
			compiler.managedPaths.add(managedPath);
		}
		for (const immutablePath of this.immutablePaths) {
			compiler.immutablePaths.add(immutablePath);
		}
	}
}

module.exports = AddManagedPathsPlugin;
