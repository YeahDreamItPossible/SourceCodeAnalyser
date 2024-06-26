"use strict";

const makeSerializable = require("../util/makeSerializable");
const ModuleDependency = require("./ModuleDependency");
const ModuleDependencyTemplateAsId = require("./ModuleDependencyTemplateAsId");

// TODO:
// module.hot.decline
class ModuleHotDeclineDependency extends ModuleDependency {
	constructor(request, range) {
		super(request);

		this.range = range;
		this.weak = true;
	}

	get type() {
		return "module.hot.decline";
	}

	get category() {
		return "commonjs";
	}
}

makeSerializable(
	ModuleHotDeclineDependency,
	"webpack/lib/dependencies/ModuleHotDeclineDependency"
);

ModuleHotDeclineDependency.Template = ModuleDependencyTemplateAsId;

module.exports = ModuleHotDeclineDependency;
