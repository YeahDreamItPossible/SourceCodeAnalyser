"use strict";

const RuntimeGlobals = require("../RuntimeGlobals");
const {
	getDependencyUsedByExportsCondition
} = require("../optimize/InnerGraph");
const makeSerializable = require("../util/makeSerializable");
const memoize = require("../util/memoize");
const ModuleDependency = require("./ModuleDependency");

const getRawModule = memoize(() => require("../RawModule"));

// URL依赖
// 当代码中包含 new URL('./xx/xx.xx', import.meta.url)
class URLDependency extends ModuleDependency {
	constructor(request, range, outerRange, relative) {
		super(request);
		// [number, number]
		this.range = range;
		// [number, number]
		this.outerRange = outerRange;
		// 是否时相对路径
		this.relative = relative || false;
		// Set<string> | boolean>
		this.usedByExports = undefined;
	}

	get type() {
		return "new URL()";
	}

	get category() {
		return "url";
	}

	// 
	getCondition(moduleGraph) {
		return getDependencyUsedByExportsCondition(
			this,
			this.usedByExports,
			moduleGraph
		);
	}

	// 返回 RawModule 的实例
	createIgnoredModule(context) {
		const RawModule = getRawModule();
		return new RawModule(
			'module.exports = "data:,";',
			`ignored-asset`,
			`(ignored asset)`,
			new Set([RuntimeGlobals.module])
		);
	}

	serialize(context) {
		const { write } = context;
		write(this.outerRange);
		write(this.relative);
		write(this.usedByExports);
		super.serialize(context);
	}

	deserialize(context) {
		const { read } = context;
		this.outerRange = read();
		this.relative = read();
		this.usedByExports = read();
		super.deserialize(context);
	}
}

URLDependency.Template = class URLDependencyTemplate extends (
	ModuleDependency.Template
) {
	apply(dependency, source, templateContext) {
		const {
			chunkGraph,
			moduleGraph,
			runtimeRequirements,
			runtimeTemplate,
			runtime
		} = templateContext;
		const dep = /** @type {URLDependency} */ (dependency);
		// ModuleGraphConnection
		const connection = moduleGraph.getConnection(dep);
		// Skip rendering depending when dependency is conditional
		if (connection && !connection.isTargetActive(runtime)) {
			source.replace(
				dep.outerRange[0],
				dep.outerRange[1] - 1,
				"/* unused asset import */ undefined"
			);
			return;
		}

		runtimeRequirements.add(RuntimeGlobals.require);

		if (dep.relative) {
			runtimeRequirements.add(RuntimeGlobals.relativeUrl);
			source.replace(
				dep.outerRange[0],
				dep.outerRange[1] - 1,
				`/* asset import */ new ${
					RuntimeGlobals.relativeUrl
				}(${runtimeTemplate.moduleRaw({
					chunkGraph,
					module: moduleGraph.getModule(dep),
					request: dep.request,
					runtimeRequirements,
					weak: false
				})})`
			);
		} else {
			runtimeRequirements.add(RuntimeGlobals.baseURI);

			source.replace(
				dep.range[0],
				dep.range[1] - 1,
				`/* asset import */ ${runtimeTemplate.moduleRaw({
					chunkGraph,
					module: moduleGraph.getModule(dep),
					request: dep.request,
					runtimeRequirements,
					weak: false
				})}, ${RuntimeGlobals.baseURI}`
			);
		}
	}
};

makeSerializable(URLDependency, "webpack/lib/dependencies/URLDependency");

module.exports = URLDependency;
