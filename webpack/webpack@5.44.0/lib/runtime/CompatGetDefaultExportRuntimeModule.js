"use strict";

const RuntimeGlobals = require("../RuntimeGlobals");
const Template = require("../Template");
const HelperRuntimeModule = require("./HelperRuntimeModule");

// 运行时模块之兼容默认导出
// __webpack_require__.n
// 作用:
// 
class CompatGetDefaultExportRuntimeModule extends HelperRuntimeModule {
	constructor() {
		super("compat get default export");
	}

	generate() {
		const { runtimeTemplate } = this.compilation;
		const fn = RuntimeGlobals.compatGetDefaultExport;
		return Template.asString([
			"// getDefaultExport function for compatibility with non-harmony modules",
			`${fn} = ${runtimeTemplate.basicFunction("module", [
				"var getter = module && module.__esModule ?",
				Template.indent([
					`${runtimeTemplate.returningFunction("module['default']")} :`,
					`${runtimeTemplate.returningFunction("module")};`
				]),
				`${RuntimeGlobals.definePropertyGetters}(getter, { a: getter });`,
				"return getter;"
			])};`
		]);
	}
}

module.exports = CompatGetDefaultExportRuntimeModule;

// 生成代码示例:
(() => {
	// getDefaultExport function for compatibility with non-harmony modules
	__webpack_require__.n = (module) => {
		var getter = module && module.__esModule ?
			() => (module['default']) :
			() => (module);
		__webpack_require__.d(getter, { a: getter });
		return getter;
	};
})();