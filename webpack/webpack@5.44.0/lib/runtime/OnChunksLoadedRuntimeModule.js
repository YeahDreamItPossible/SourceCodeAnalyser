"use strict";

const RuntimeGlobals = require("../RuntimeGlobals");
const RuntimeModule = require("../RuntimeModule");
const Template = require("../Template");

// var deferred = [];
// __webpack_require__.O = (result, chunkIds, fn, priority) => {
// 	if(chunkIds) {
// 		priority = priority || 0;
// 		for(var i = deferred.length; i > 0 && deferred[i - 1][2] > priority; i--) deferred[i] = deferred[i - 1];
// 		deferred[i] = [chunkIds, fn, priority];
// 		return;
// 	}
// 	var notFulfilled = Infinity;
// 	for (var i = 0; i < deferred.length; i++) {
// 		var [chunkIds, fn, priority] = deferred[i];
// 		var fulfilled = true;
// 		for (var j = 0; j < chunkIds.length; j++) {
// 			if ((priority & 1 === 0 || notFulfilled >= priority) && Object.keys(__webpack_require__.O).every((key) => (__webpack_require__.O[key](chunkIds[j])))) {
// 				chunkIds.splice(j--, 1);
// 			} else {
// 				fulfilled = false;
// 				if(priority < notFulfilled) notFulfilled = priority;
// 			}
// 		}
// 		if(fulfilled) {
// 			deferred.splice(i--, 1)
// 			result = fn();
// 		}
// 	}
// 	return result;
// };

// 运行时模块之当块加载完成后
class OnChunksLoadedRuntimeModule extends RuntimeModule {
	constructor() {
		super("chunk loaded");
	}

	generate() {
		const { compilation } = this;
		const { runtimeTemplate } = compilation;
		return Template.asString([
			"var deferred = [];",
			`${RuntimeGlobals.onChunksLoaded} = ${runtimeTemplate.basicFunction(
				"result, chunkIds, fn, priority",
				[
					"if(chunkIds) {",
					Template.indent([
						"priority = priority || 0;",
						"for(var i = deferred.length; i > 0 && deferred[i - 1][2] > priority; i--) deferred[i] = deferred[i - 1];",
						"deferred[i] = [chunkIds, fn, priority];",
						"return;"
					]),
					"}",
					"var notFulfilled = Infinity;",
					"for (var i = 0; i < deferred.length; i++) {",
					Template.indent([
						runtimeTemplate.destructureArray(
							["chunkIds", "fn", "priority"],
							"deferred[i]"
						),
						"var fulfilled = true;",
						"for (var j = 0; j < chunkIds.length; j++) {",
						Template.indent([
							`if ((priority & 1 === 0 || notFulfilled >= priority) && Object.keys(${
								RuntimeGlobals.onChunksLoaded
							}).every(${runtimeTemplate.returningFunction(
								`${RuntimeGlobals.onChunksLoaded}[key](chunkIds[j])`,
								"key"
							)})) {`,
							Template.indent(["chunkIds.splice(j--, 1);"]),
							"} else {",
							Template.indent([
								"fulfilled = false;",
								"if(priority < notFulfilled) notFulfilled = priority;"
							]),
							"}"
						]),
						"}",
						"if(fulfilled) {",
						Template.indent(["deferred.splice(i--, 1)", "result = fn();"]),
						"}"
					]),
					"}",
					"return result;"
				]
			)};`
		]);
	}
}

module.exports = OnChunksLoadedRuntimeModule;
