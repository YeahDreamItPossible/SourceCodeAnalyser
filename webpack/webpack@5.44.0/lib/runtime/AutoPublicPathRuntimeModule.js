"use strict";

const RuntimeGlobals = require("../RuntimeGlobals");
const RuntimeModule = require("../RuntimeModule");
const Template = require("../Template");
const JavascriptModulesPlugin = require("../javascript/JavascriptModulesPlugin");
const { getUndoPath } = require("../util/identifier");

// 运行时模块之公共路径
// __webpack_require__.p
// 作用:
// 根据 运行环境 自动设置 公共路径 属性
class AutoPublicPathRuntimeModule extends RuntimeModule {
	constructor() {
		super("publicPath", RuntimeModule.STAGE_BASIC);
	}
	
	generate() {
		const { compilation } = this;
		const { scriptType, importMetaName, path } = compilation.outputOptions;
		const chunkName = compilation.getPath(
			JavascriptModulesPlugin.getChunkFilenameTemplate(
				this.chunk,
				compilation.outputOptions
			),
			{
				chunk: this.chunk,
				contentHashType: "javascript"
			}
		);
		const undoPath = getUndoPath(chunkName, path, false);

		return Template.asString([
			"var scriptUrl;",
			scriptType === "module"
				? `if (typeof ${importMetaName}.url === "string") scriptUrl = ${importMetaName}.url`
				: Template.asString([
						`if (${RuntimeGlobals.global}.importScripts) scriptUrl = ${RuntimeGlobals.global}.location + "";`,
						`var document = ${RuntimeGlobals.global}.document;`,
						"if (!scriptUrl && document) {",
						Template.indent([
							`if (document.currentScript)`,
							Template.indent(`scriptUrl = document.currentScript.src`),
							"if (!scriptUrl) {",
							Template.indent([
								'var scripts = document.getElementsByTagName("script");',
								"if(scripts.length) scriptUrl = scripts[scripts.length - 1].src"
							]),
							"}"
						]),
						"}"
				  ]),
			"// When supporting browsers where an automatic publicPath is not supported you must specify an output.publicPath manually via configuration",
			'// or pass an empty string ("") and set the __webpack_public_path__ variable from your code to use your own logic.',
			'if (!scriptUrl) throw new Error("Automatic publicPath is not supported in this browser");',
			'scriptUrl = scriptUrl.replace(/#.*$/, "").replace(/\\?.*$/, "").replace(/\\/[^\\/]+$/, "/");',
			!undoPath
				? `${RuntimeGlobals.publicPath} = scriptUrl;`
				: `${RuntimeGlobals.publicPath} = scriptUrl + ${JSON.stringify(
						undoPath
				  )};`
		]);
	}
}

module.exports = AutoPublicPathRuntimeModule;

// 生成代码示例:
(() => {
	var scriptUrl;
	if (__webpack_require__.g.importScripts) scriptUrl = __webpack_require__.g.location + "";
	var document = __webpack_require__.g.document;
	if (!scriptUrl && document) {
		if (document.currentScript)
			scriptUrl = document.currentScript.src
		if (!scriptUrl) {
			var scripts = document.getElementsByTagName("script");
			if(scripts.length) scriptUrl = scripts[scripts.length - 1].src
		}
	}
	// When supporting browsers where an automatic publicPath is not supported you must specify an output.publicPath manually via configuration
	// or pass an empty string ("") and set the __webpack_public_path__ variable from your code to use your own logic.
	if (!scriptUrl) throw new Error("Automatic publicPath is not supported in this browser");
	scriptUrl = scriptUrl.replace(/#.*$/, "").replace(/\?.*$/, "").replace(/\/[^\/]+$/, "/");
	__webpack_require__.p = scriptUrl;
})();