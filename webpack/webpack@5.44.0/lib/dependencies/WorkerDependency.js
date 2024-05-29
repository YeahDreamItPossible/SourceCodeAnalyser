"use strict";

const Dependency = require("../Dependency");
const RuntimeGlobals = require("../RuntimeGlobals");
const makeSerializable = require("../util/makeSerializable");
const ModuleDependency = require("./ModuleDependency");

// Worker依赖
// 当代码片段中包含 new Worker()
class WorkerDependency extends ModuleDependency {
	constructor(request, range) {
		super(request);
		this.range = range;
	}

	getReferencedExports(moduleGraph, runtime) {
		return Dependency.NO_EXPORTS_REFERENCED;
	}

	get type() {
		return "new Worker()";
	}

	get category() {
		return "worker";
	}
}

WorkerDependency.Template = class WorkerDependencyTemplate extends (
	ModuleDependency.Template
) {
	apply(dependency, source, templateContext) {
		const { chunkGraph, moduleGraph, runtimeRequirements } = templateContext;
		const dep = /** @type {WorkerDependency} */ (dependency);
		const block = /** @type {AsyncDependenciesBlock} */ (
			moduleGraph.getParentBlock(dependency)
		);
		const entrypoint = /** @type {Entrypoint} */ (
			chunkGraph.getBlockChunkGroup(block)
		);
		const chunk = entrypoint.getEntrypointChunk();

		runtimeRequirements.add(RuntimeGlobals.publicPath);
		runtimeRequirements.add(RuntimeGlobals.baseURI);
		runtimeRequirements.add(RuntimeGlobals.getChunkScriptFilename);

		source.replace(
			dep.range[0],
			dep.range[1] - 1,
			// /* worker import */ __webpack_require__.p + __webpack_require__.u(\"src_w_js\", __webpack_require__.b)
			`/* worker import */ ${RuntimeGlobals.publicPath} + ${
				RuntimeGlobals.getChunkScriptFilename
			}(${JSON.stringify(chunk.id)}), ${RuntimeGlobals.baseURI}`
		);
	}
};

makeSerializable(WorkerDependency, "webpack/lib/dependencies/WorkerDependency");

module.exports = WorkerDependency;
