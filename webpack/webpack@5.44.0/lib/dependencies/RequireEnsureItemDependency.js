"use strict";

const makeSerializable = require("../util/makeSerializable");
const ModuleDependency = require("./ModuleDependency");
const NullDependency = require("./NullDependency");

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
