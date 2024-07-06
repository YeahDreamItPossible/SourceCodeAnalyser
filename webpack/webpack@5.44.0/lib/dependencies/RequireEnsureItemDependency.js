"use strict";

const makeSerializable = require("../util/makeSerializable");
const ModuleDependency = require("./ModuleDependency");
const NullDependency = require("./NullDependency");

// 通过 webpack特有的 require.ensure 语法引入的依赖
class RequireEnsureItemDependency extends ModuleDependency {
	constructor(request) {
		super(request);
	}

	get type() {
		return "require.ensure item";
	}

	get category() {
		return "commonjs";
	}
}

makeSerializable(
	RequireEnsureItemDependency,
	"webpack/lib/dependencies/RequireEnsureItemDependency"
);

RequireEnsureItemDependency.Template = NullDependency.Template;

module.exports = RequireEnsureItemDependency;
