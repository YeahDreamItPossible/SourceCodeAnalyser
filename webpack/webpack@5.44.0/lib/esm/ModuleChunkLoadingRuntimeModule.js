"use strict";

const { SyncWaterfallHook } = require("tapable");
const Compilation = require("../Compilation");
const RuntimeGlobals = require("../RuntimeGlobals");
const RuntimeModule = require("../RuntimeModule");
const Template = require("../Template");
const {
	getChunkFilenameTemplate,
	chunkHasJs
} = require("../javascript/JavascriptModulesPlugin");
const { getInitialChunkIds } = require("../javascript/StartupHelpers");
const compileBooleanMatcher = require("../util/compileBooleanMatcher");
const { getUndoPath } = require("../util/identifier");

// WeakMap<Compilation, Hooks>
const compilationHooksMap = new WeakMap();

// // no baseURI
// // object to store loaded and loading chunks
// // undefined = chunk not loaded, null = chunk preloaded/prefetched
// // [resolve, reject, Promise] = chunk loading, 0 = chunk loaded
// var installedChunks = {
// 	"runtime": 0
// };
// var installChunk = (data) => {
// 	var {ids, modules, runtime} = data;
// 	// add "modules" to the modules object,
// 	// then flag all "ids" as loaded and fire callback
// 	var moduleId, chunkId, i = 0;
// 	for(moduleId in modules) {
// 		if(__webpack_require__.o(modules, moduleId)) {
// 			__webpack_require__.m[moduleId] = modules[moduleId];
// 		}
// 	}
// 	if(runtime) runtime(__webpack_require__);
// 	for(;i < ids.length; i++) {
// 		chunkId = ids[i];
// 		if(__webpack_require__.o(installedChunks, chunkId) && installedChunks[chunkId]) {
// 			installedChunks[chunkId][0]();
// 		}
// 		installedChunks[ids[i]] = 0;
// 	}
// 	__webpack_require__.O();
// }
// __webpack_require__.f.j = (chunkId, promises) => {
// 		// import() chunk loading for javascript
// 		var installedChunkData = __webpack_require__.o(installedChunks, chunkId) ? installedChunks[chunkId] : undefined;
// 		if(installedChunkData !== 0) { // 0 means "already installed".

// 			// a Promise means "currently loading".
// 			if(installedChunkData) {
// 				promises.push(installedChunkData[1]);
// 			} else {
// 				if("runtime" != chunkId) {
// 					// setup Promise in chunk cache
// 					var promise = import("./" + __webpack_require__.u(chunkId)).then(installChunk, (e) => {
// 						if(installedChunks[chunkId] !== 0) installedChunks[chunkId] = undefined;
// 						throw e;
// 					});
// 					var promise = Promise.race([promise, new Promise((resolve) => (installedChunkData = installedChunks[chunkId] = [resolve]))])
// 					promises.push(installedChunkData[1] = promise);
// 				} else installedChunks[chunkId] = 0;
// 			}
// 		}
// };
// // no external install chunk
// webpack_require__.O.j = (chunkId) => (installedChunks[chunkId] === 0);

// 根据 Webpack.options.output.chunkLoading = 'import' 注册该插件
// 在 esm 环境中 以 import 的方式加载非初始化块
class ModuleChunkLoadingRuntimeModule extends RuntimeModule {
	static getCompilationHooks(compilation) {
		if (!(compilation instanceof Compilation)) {
			throw new TypeError(
				"The 'compilation' argument must be an instance of Compilation"
			);
		}
		let hooks = compilationHooksMap.get(compilation);
		if (hooks === undefined) {
			hooks = {
				linkPreload: new SyncWaterfallHook(["source", "chunk"]),
				linkPrefetch: new SyncWaterfallHook(["source", "chunk"])
			};
			compilationHooksMap.set(compilation, hooks);
		}
		return hooks;
	}

	constructor(runtimeRequirements) {
		super("import chunk loading", RuntimeModule.STAGE_ATTACH);
		this._runtimeRequirements = runtimeRequirements;
	}

	generate() {
		const { compilation, chunk } = this;
		const {
			runtimeTemplate,
			chunkGraph,
			outputOptions: { importFunctionName, importMetaName }
		} = compilation;
		const fn = RuntimeGlobals.ensureChunkHandlers;
		const withBaseURI = this._runtimeRequirements.has(RuntimeGlobals.baseURI);
		const withExternalInstallChunk = this._runtimeRequirements.has(
			RuntimeGlobals.externalInstallChunk
		);
		const withLoading = this._runtimeRequirements.has(
			RuntimeGlobals.ensureChunkHandlers
		);
		const withOnChunkLoad = this._runtimeRequirements.has(
			RuntimeGlobals.onChunksLoaded
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
						`${RuntimeGlobals.baseURI} = new URL(${JSON.stringify(
							rootOutputDir
						)}, ${importMetaName}.url);`
				  ])
				: "// no baseURI",
			"",
			"// object to store loaded and loading chunks",
			"// undefined = chunk not loaded, null = chunk preloaded/prefetched",
			"// [resolve, reject, Promise] = chunk loading, 0 = chunk loaded",
			"var installedChunks = {",
			Template.indent(
				Array.from(initialChunkIds, id => `${JSON.stringify(id)}: 0`).join(
					",\n"
				)
			),
			"};",
			"",
			withLoading || withExternalInstallChunk
				? `var installChunk = ${runtimeTemplate.basicFunction("data", [
						runtimeTemplate.destructureObject(
							["ids", "modules", "runtime"],
							"data"
						),
						'// add "modules" to the modules object,',
						'// then flag all "ids" as loaded and fire callback',
						"var moduleId, chunkId, i = 0;",
						"for(moduleId in modules) {",
						Template.indent([
							`if(${RuntimeGlobals.hasOwnProperty}(modules, moduleId)) {`,
							Template.indent(
								`${RuntimeGlobals.moduleFactories}[moduleId] = modules[moduleId];`
							),
							"}"
						]),
						"}",
						"if(runtime) runtime(__webpack_require__);",
						"for(;i < ids.length; i++) {",
						Template.indent([
							"chunkId = ids[i];",
							`if(${RuntimeGlobals.hasOwnProperty}(installedChunks, chunkId) && installedChunks[chunkId]) {`,
							Template.indent("installedChunks[chunkId][0]();"),
							"}",
							"installedChunks[ids[i]] = 0;"
						]),
						"}",
						withOnChunkLoad ? `${RuntimeGlobals.onChunksLoaded}();` : ""
				  ])}`
				: "// no install chunk",
			"",
			withLoading
				? Template.asString([
						`${fn}.j = ${runtimeTemplate.basicFunction(
							"chunkId, promises",
							hasJsMatcher !== false
								? Template.indent([
										"// import() chunk loading for javascript",
										`var installedChunkData = ${RuntimeGlobals.hasOwnProperty}(installedChunks, chunkId) ? installedChunks[chunkId] : undefined;`,
										'if(installedChunkData !== 0) { // 0 means "already installed".',
										Template.indent([
											"",
											'// a Promise means "currently loading".',
											"if(installedChunkData) {",
											Template.indent([
												"promises.push(installedChunkData[1]);"
											]),
											"} else {",
											Template.indent([
												hasJsMatcher === true
													? "if(true) { // all chunks have JS"
													: `if(${hasJsMatcher("chunkId")}) {`,
												Template.indent([
													"// setup Promise in chunk cache",
													`var promise = ${importFunctionName}(${JSON.stringify(
														rootOutputDir
													)} + ${
														RuntimeGlobals.getChunkScriptFilename
													}(chunkId)).then(installChunk, ${runtimeTemplate.basicFunction(
														"e",
														[
															"if(installedChunks[chunkId] !== 0) installedChunks[chunkId] = undefined;",
															"throw e;"
														]
													)});`,
													`var promise = Promise.race([promise, new Promise(${runtimeTemplate.expressionFunction(
														`installedChunkData = installedChunks[chunkId] = [resolve]`,
														"resolve"
													)})])`,
													`promises.push(installedChunkData[1] = promise);`
												]),
												"} else installedChunks[chunkId] = 0;"
											]),
											"}"
										]),
										"}"
								  ])
								: Template.indent(["installedChunks[chunkId] = 0;"])
						)};`
				  ])
				: "// no chunk on demand loading",
			"",
			withExternalInstallChunk
				? Template.asString([
						`${RuntimeGlobals.externalInstallChunk} = installChunk;`
				  ])
				: "// no external install chunk",
			"",
			withOnChunkLoad
				? `${
						RuntimeGlobals.onChunksLoaded
				  }.j = ${runtimeTemplate.returningFunction(
						"installedChunks[chunkId] === 0",
						"chunkId"
				  )};`
				: "// no on chunks loaded"
		]);
	}
}

module.exports = ModuleChunkLoadingRuntimeModule;
