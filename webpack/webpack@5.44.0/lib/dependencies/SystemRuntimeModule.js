"use strict";

const RuntimeGlobals = require("../RuntimeGlobals");
const RuntimeModule = require("../RuntimeModule");
const Template = require("../Template");

// 
class SystemRuntimeModule extends RuntimeModule {
	constructor() {
		super("system");
	}

	generate() {
		return Template.asString([
			`${RuntimeGlobals.system} = {`,
			Template.indent([
				"import: function () {",
				Template.indent(
					"throw new Error('System.import cannot be used indirectly');"
				),
				"}"
			]),
			"};"
		]);
	}
}

module.exports = SystemRuntimeModule;
