"use strict";

const makeSerializable = require("../util/makeSerializable");
const ModuleDependency = require("./ModuleDependency");
const ModuleDependencyTemplateAsId = require("./ModuleDependencyTemplateAsId");

// CommonJS引用依赖
class CommonJsRequireDependency extends ModuleDependency {
	constructor(request, range) {
		super(request);
		this.range = range;
	}

	get type() {
		return "cjs require";
	}

	get category() {
		return "commonjs";
	}
}

CommonJsRequireDependency.Template = ModuleDependencyTemplateAsId;

makeSerializable(
	CommonJsRequireDependency,
	"webpack/lib/dependencies/CommonJsRequireDependency"
);

module.exports = CommonJsRequireDependency;
