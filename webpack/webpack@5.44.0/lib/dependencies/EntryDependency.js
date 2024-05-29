"use strict";

const makeSerializable = require("../util/makeSerializable");
const ModuleDependency = require("./ModuleDependency");

// 入口依赖
class EntryDependency extends ModuleDependency {
	constructor(request) {
		super(request);
	}

	get type() {
		return "entry";
	}

	get category() {
		return "esm";
	}
}

makeSerializable(EntryDependency, "webpack/lib/dependencies/EntryDependency");

module.exports = EntryDependency;
