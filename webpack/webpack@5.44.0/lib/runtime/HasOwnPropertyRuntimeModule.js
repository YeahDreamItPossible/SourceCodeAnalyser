"use strict";

const RuntimeGlobals = require("../RuntimeGlobals");
const RuntimeModule = require("../RuntimeModule");
const Template = require("../Template");

// __webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))

// 运行时模块之判断某个对象是否具有某个属性
//  __webpack_require__.o
class HasOwnPropertyRuntimeModule extends RuntimeModule {
	constructor() {
		super("hasOwnProperty shorthand");
	}
	
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
