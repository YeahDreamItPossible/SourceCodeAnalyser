"use strict";

const Dependency = require("../Dependency");
const makeSerializable = require("../util/makeSerializable");
const ModuleDependency = require("./ModuleDependency");
const ModuleDependencyAsId = require("./ModuleDependencyTemplateAsId");

// 通过 webpack特有的 require.resolve 语法引入的依赖
class RequireResolveDependency extends ModuleDependency {
	constructor(request, range) {
		super(request);

		this.range = range;
	}

	get type() {
		return "require.resolve";
	}

	get category() {
		return "commonjs";
	}

	getReferencedExports(moduleGraph, runtime) {
		// This doesn't use any export
		return Dependency.NO_EXPORTS_REFERENCED;
	}
}

makeSerializable(
	RequireResolveDependency,
	"webpack/lib/dependencies/RequireResolveDependency"
);

RequireResolveDependency.Template = ModuleDependencyAsId;

module.exports = RequireResolveDependency;
