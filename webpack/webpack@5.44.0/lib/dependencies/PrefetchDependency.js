"use strict";

const ModuleDependency = require("./ModuleDependency");

// 预拉取依赖
class PrefetchDependency extends ModuleDependency {
	constructor(request) {
		super(request);
	}

	get type() {
		return "prefetch";
	}

	get category() {
		return "esm";
	}
}

module.exports = PrefetchDependency;
