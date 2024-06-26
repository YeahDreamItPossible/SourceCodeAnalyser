"use strict";

const RuntimeGlobals = require("../RuntimeGlobals");
const RuntimeModule = require("../RuntimeModule");
const Template = require("../Template");
const {
	chunkHasJs,
	getChunkFilenameTemplate
} = require("../javascript/JavascriptModulesPlugin");
const { getInitialChunkIds } = require("../javascript/StartupHelpers");
const compileBooleanMatcher = require("../util/compileBooleanMatcher");
const { getUndoPath } = require("../util/identifier");

// // no baseURI
// // object to store loaded chunks
// // "1" means "loaded", otherwise not loaded yet
// var installedChunks = {
// 	"runtime": 1
// };
// __webpack_require__.O.require = (chunkId) => (installedChunks[chunkId]);
// var installChunk = (chunk) => {
// 	var moreModules = chunk.modules, chunkIds = chunk.ids, runtime = chunk.runtime;
// 	for(var moduleId in moreModules) {
// 		if(__webpack_require__.o(moreModules, moduleId)) {
// 			__webpack_require__.m[moduleId] = moreModules[moduleId];
// 		}
// 	}
// 	if(runtime) runtime(__webpack_require__);
// 	for(var i = 0; i < chunkIds.length; i++)
// 		installedChunks[chunkIds[i]] = 1;
// 	__webpack_require__.O();
// };
// // require() chunk loading for javascript
// __webpack_require__.f.require = (chunkId, promises) => {
// 	// "1" is the signal for "already loaded"
// 	if(!installedChunks[chunkId]) {
// 		if("runtime" != chunkId) {
// 			installChunk(require("./" + __webpack_require__.u(chunkId)));
// 		} else installedChunks[chunkId] = 1;
// 	}
// };
// // no external install chunk
// // no HMR
// // no HMR manifest

// 在 node 环境中 以 同步的方式 加载 非初始化块
class RequireChunkLoadingRuntimeModule extends RuntimeModule {
	constructor(runtimeRequirements) {
		super("require chunk loading", RuntimeModule.STAGE_ATTACH);
		this.runtimeRequirements = runtimeRequirements;
	}

	generate() {
		const { chunkGraph, chunk } = this;
		const { runtimeTemplate } = this.compilation;
		const fn = RuntimeGlobals.ensureChunkHandlers;
		const withBaseURI = this.runtimeRequirements.has(RuntimeGlobals.baseURI);
		const withExternalInstallChunk = this.runtimeRequirements.has(
			RuntimeGlobals.externalInstallChunk
		);
		const withOnChunkLoad = this.runtimeRequirements.has(
			RuntimeGlobals.onChunksLoaded
		);
		const withLoading = this.runtimeRequirements.has(
			RuntimeGlobals.ensureChunkHandlers
		);
		const withHmr = this.runtimeRequirements.has(
			RuntimeGlobals.hmrDownloadUpdateHandlers
		);
		const withHmrManifest = this.runtimeRequirements.has(
			RuntimeGlobals.hmrDownloadManifest
		);
		const conditionMap = chunkGraph.getChunkConditionMap(chunk, chunkHasJs);
		const hasJsMatcher = compileBooleanMatcher(conditionMap);
		const initialChunkIds = getInitialChunkIds(chunk, chunkGraph);

		const outputName = this.compilation.getPath(
			getChunkFilenameTemplate(chunk, this.compilation.outputOptions),
			{
				chunk,
				contentHashType: "javascript"
			}
		);
		const rootOutputDir = getUndoPath(
			outputName,
			this.compilation.outputOptions.path,
			true
		);

		return Template.asString([
			withBaseURI
				? Template.asString([
						`${RuntimeGlobals.baseURI} = require("url").pathToFileURL(${
							rootOutputDir !== "./"
								? `__dirname + ${JSON.stringify("/" + rootOutputDir)}`
								: "__filename"
						});`
				  ])
				: "// no baseURI",
			"",
			"// object to store loaded chunks",
			'// "1" means "loaded", otherwise not loaded yet',
			"var installedChunks = {",
			Template.indent(
				Array.from(initialChunkIds, id => `${JSON.stringify(id)}: 1`).join(
					",\n"
				)
			),
			"};",
			"",
			withOnChunkLoad
				? `${
						RuntimeGlobals.onChunksLoaded
				  }.require = ${runtimeTemplate.returningFunction(
						"installedChunks[chunkId]",
						"chunkId"
				  )};`
				: "// no on chunks loaded",
			"",
			withLoading || withExternalInstallChunk
				? `var installChunk = ${runtimeTemplate.basicFunction("chunk", [
						"var moreModules = chunk.modules, chunkIds = chunk.ids, runtime = chunk.runtime;",
						"for(var moduleId in moreModules) {",
						Template.indent([
							`if(${RuntimeGlobals.hasOwnProperty}(moreModules, moduleId)) {`,
							Template.indent([
								`${RuntimeGlobals.moduleFactories}[moduleId] = moreModules[moduleId];`
							]),
							"}"
						]),
						"}",
						`if(runtime) runtime(__webpack_require__);`,
						"for(var i = 0; i < chunkIds.length; i++)",
						Template.indent("installedChunks[chunkIds[i]] = 1;"),
						withOnChunkLoad ? `${RuntimeGlobals.onChunksLoaded}();` : ""
				  ])};`
				: "// no chunk install function needed",
			"",
			withLoading
				? Template.asString([
						"// require() chunk loading for javascript",
						`${fn}.require = ${runtimeTemplate.basicFunction(
							"chunkId, promises",
							hasJsMatcher !== false
								? [
										'// "1" is the signal for "already loaded"',
										"if(!installedChunks[chunkId]) {",
										Template.indent([
											hasJsMatcher === true
												? "if(true) { // all chunks have JS"
												: `if(${hasJsMatcher("chunkId")}) {`,
											Template.indent([
												`installChunk(require(${JSON.stringify(
													rootOutputDir
												)} + ${
													RuntimeGlobals.getChunkScriptFilename
												}(chunkId)));`
											]),
											"} else installedChunks[chunkId] = 1;",
											""
										]),
										"}"
								  ]
								: "installedChunks[chunkId] = 1;"
						)};`
				  ])
				: "// no chunk loading",
			"",
			withExternalInstallChunk
				? Template.asString([
						"module.exports = __webpack_require__;",
						`${RuntimeGlobals.externalInstallChunk} = installChunk;`
				  ])
				: "// no external install chunk",
			"",
			withHmr
				? Template.asString([
						"function loadUpdateChunk(chunkId, updatedModulesList) {",
						Template.indent([
							`var update = require(${JSON.stringify(rootOutputDir)} + ${
								RuntimeGlobals.getChunkUpdateScriptFilename
							}(chunkId));`,
							"var updatedModules = update.modules;",
							"var runtime = update.runtime;",
							"for(var moduleId in updatedModules) {",
							Template.indent([
								`if(${RuntimeGlobals.hasOwnProperty}(updatedModules, moduleId)) {`,
								Template.indent([
									`currentUpdate[moduleId] = updatedModules[moduleId];`,
									"if(updatedModulesList) updatedModulesList.push(moduleId);"
								]),
								"}"
							]),
							"}",
							"if(runtime) currentUpdateRuntime.push(runtime);"
						]),
						"}",
						"",
						Template.getFunctionContent(
							require("../hmr/JavascriptHotModuleReplacement.runtime.js")
						)
							.replace(/\$key\$/g, "require")
							.replace(/\$installedChunks\$/g, "installedChunks")
							.replace(/\$loadUpdateChunk\$/g, "loadUpdateChunk")
							.replace(/\$moduleCache\$/g, RuntimeGlobals.moduleCache)
							.replace(/\$moduleFactories\$/g, RuntimeGlobals.moduleFactories)
							.replace(
								/\$ensureChunkHandlers\$/g,
								RuntimeGlobals.ensureChunkHandlers
							)
							.replace(/\$hasOwnProperty\$/g, RuntimeGlobals.hasOwnProperty)
							.replace(/\$hmrModuleData\$/g, RuntimeGlobals.hmrModuleData)
							.replace(
								/\$hmrDownloadUpdateHandlers\$/g,
								RuntimeGlobals.hmrDownloadUpdateHandlers
							)
							.replace(
								/\$hmrInvalidateModuleHandlers\$/g,
								RuntimeGlobals.hmrInvalidateModuleHandlers
							)
				  ])
				: "// no HMR",
			"",
			withHmrManifest
				? Template.asString([
						`${RuntimeGlobals.hmrDownloadManifest} = function() {`,
						Template.indent([
							"return Promise.resolve().then(function() {",
							Template.indent([
								`return require(${JSON.stringify(rootOutputDir)} + ${
									RuntimeGlobals.getUpdateManifestFilename
								}());`
							]),
							'}).catch(function(err) { if(err.code !== "MODULE_NOT_FOUND") throw err; });'
						]),
						"}"
				  ])
				: "// no HMR manifest"
		]);
	}
}

module.exports = RequireChunkLoadingRuntimeModule;
