"use strict";

const RuntimeGlobals = require("../RuntimeGlobals");
const Template = require("../Template");
const HelperRuntimeModule = require("./HelperRuntimeModule");

// define __esModule on exports
// __webpack_require__.r = (exports) => {
// 	if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
// 		Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
// 	}
// 	Object.defineProperty(exports, '__esModule', { value: true });
// };

// 运行时模块之定义输出对象为 ESModule
// __webpack_require__.r
class MakeNamespaceObjectRuntimeModule extends HelperRuntimeModule {
	constructor() {
		super("make namespace object");
	}

	generate() {
		const { runtimeTemplate } = this.compilation;
		const fn = RuntimeGlobals.makeNamespaceObject;
		return Template.asString([
			"// define __esModule on exports",
			`${fn} = ${runtimeTemplate.basicFunction("exports", [
				"if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {",
				Template.indent([
					"Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });"
				]),
				"}",
				"Object.defineProperty(exports, '__esModule', { value: true });"
			])};`
		]);
	}
}

module.exports = MakeNamespaceObjectRuntimeModule;
