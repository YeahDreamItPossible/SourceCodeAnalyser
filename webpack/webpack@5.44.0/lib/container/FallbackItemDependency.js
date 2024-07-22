"use strict";

const ModuleDependency = require("../dependencies/ModuleDependency");
const makeSerializable = require("../util/makeSerializable");

// 回退项依赖
// 作用:
// 
class FallbackItemDependency extends ModuleDependency {
	constructor(request) {
		super(request);
	}

	get type() {
		return "fallback item";
	}

	get category() {
		return "esm";
	}
}

makeSerializable(
	FallbackItemDependency,
	"webpack/lib/container/FallbackItemDependency"
);

module.exports = FallbackItemDependency;
