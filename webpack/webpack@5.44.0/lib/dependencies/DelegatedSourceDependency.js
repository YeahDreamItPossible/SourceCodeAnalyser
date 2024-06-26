"use strict";

const makeSerializable = require("../util/makeSerializable");
const ModuleDependency = require("./ModuleDependency");

// 代理源代码依赖
class DelegatedSourceDependency extends ModuleDependency {
	constructor(request) {
		super(request);
	}

	get type() {
		return "delegated source";
	}

	get category() {
		return "esm";
	}
}

makeSerializable(
	DelegatedSourceDependency,
	"webpack/lib/dependencies/DelegatedSourceDependency"
);

module.exports = DelegatedSourceDependency;
