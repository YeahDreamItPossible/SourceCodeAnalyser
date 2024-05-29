"use strict";

const RuntimeGlobals = require("../RuntimeGlobals");
const RuntimeModule = require("../RuntimeModule");
const Template = require("../Template");

// __webpack_require__.o
class HasOwnPropertyRuntimeModule extends RuntimeModule {
	constructor() {
		super("hasOwnProperty shorthand");
	}

	// __webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
	generate() {
		const { runtimeTemplate } = this.compilation;

		return Template.asString([
			`${RuntimeGlobals.hasOwnProperty} = ${runtimeTemplate.returningFunction(
				"Object.prototype.hasOwnProperty.call(obj, prop)",
				"obj, prop"
			)}`
		]);
	}
}

module.exports = HasOwnPropertyRuntimeModule;
