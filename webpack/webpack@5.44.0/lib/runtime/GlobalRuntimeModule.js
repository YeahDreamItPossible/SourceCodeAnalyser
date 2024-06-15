"use strict";

const RuntimeGlobals = require("../RuntimeGlobals");
const RuntimeModule = require("../RuntimeModule");
const Template = require("../Template");

// 运行时模块之返回 全局对象
class GlobalRuntimeModule extends RuntimeModule {
	constructor() {
		super("global");
	}

	// __webpack_require__.g
	generate() {
		return Template.asString([
			`${RuntimeGlobals.global} = (function() {`,
			Template.indent([
				"if (typeof globalThis === 'object') return globalThis;",
				"try {",
				Template.indent(
					// This works in non-strict mode
					// or
					// This works if eval is allowed (see CSP)
					"return this || new Function('return this')();"
				),
				"} catch (e) {",
				Template.indent(
					// This works if the window reference is available
					"if (typeof window === 'object') return window;"
				),
				"}"
				// It can still be `undefined`, but nothing to do about it...
				// We return `undefined`, instead of nothing here, so it's
				// easier to handle this case:
				//   if (!global) { … }
			]),
			"})();"
		]);
	}
}

module.exports = GlobalRuntimeModule;
