"use strict";


class AddBuildDependenciesPlugin {
	constructor(buildDependencies) {
		this.buildDependencies = new Set(buildDependencies);
	}

	apply(compiler) {
		compiler.hooks.compilation.tap(
			"AddBuildDependenciesPlugin",
			compilation => {
				compilation.buildDependencies.addAll(this.buildDependencies);
			}
		);
	}
}

module.exports = AddBuildDependenciesPlugin;
