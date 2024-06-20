"use strict";

const RuntimeGlobals = require("../RuntimeGlobals");
const Template = require("../Template");
const HelperRuntimeModule = require("./HelperRuntimeModule");

// define getter functions for harmony exports
// __webpack_require__.d = (exports, definition) => {
// 	for(var key in definition) {
// 		if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
// 			Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
// 		}
// 	}
// };

// 运行时模块之定义属性getters函数
// __webpack_require__.d
class DefinePropertyGettersRuntimeModule extends HelperRuntimeModule {
	constructor() {
		super("define property getters");
	}
	
	generate() {
		const { runtimeTemplate } = this.compilation;
		const fn = RuntimeGlobals.definePropertyGetters;
		return Template.asString([
			"// define getter functions for harmony exports",
			`${fn} = ${runtimeTemplate.basicFunction("exports, definition", [
				`for(var key in definition) {`,
				Template.indent([
					`if(${RuntimeGlobals.hasOwnProperty}(definition, key) && !${RuntimeGlobals.hasOwnProperty}(exports, key)) {`,
					Template.indent([
						"Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });"
					]),
					"}"
				]),
				"}"
			])};`
		]);
	}
}

module.exports = DefinePropertyGettersRuntimeModule;
