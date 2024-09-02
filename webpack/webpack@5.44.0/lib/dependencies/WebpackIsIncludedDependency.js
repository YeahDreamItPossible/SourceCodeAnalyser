"use strict";

const Dependency = require("../Dependency");
const Template = require("../Template");
const makeSerializable = require("../util/makeSerializable");
const ModuleDependency = require("./ModuleDependency");

// 
// 作用:
// 标识 某个模块 是否是否被 webpack 打包
class WebpackIsIncludedDependency extends ModuleDependency {
	constructor(request, range) {
		// 某模块路径
		super(request);
		// 当前依赖是弱依赖
		this.weak = true;
		this.range = range;
	}

	getReferencedExports(moduleGraph, runtime) {
		// This doesn't use any export
		return Dependency.NO_EXPORTS_REFERENCED;
	}

	get type() {
		return "__webpack_is_included__";
	}
}

makeSerializable(
	WebpackIsIncludedDependency,
	"webpack/lib/dependencies/WebpackIsIncludedDependency"
);

WebpackIsIncludedDependency.Template = class WebpackIsIncludedDependencyTemplate extends (
	ModuleDependency.Template
) {
	apply(dependency, source, { runtimeTemplate, chunkGraph, moduleGraph }) {
		const dep = /** @type {WebpackIsIncludedDependency} */ (dependency);
		const connection = moduleGraph.getConnection(dep);
		const included = connection
			? chunkGraph.getNumberOfModuleChunks(connection.module) > 0
			: false;
		const comment = runtimeTemplate.outputOptions.pathinfo
			? Template.toComment(
					`__webpack_is_included__ ${runtimeTemplate.requestShortener.shorten(
						dep.request
					)}`
			  )
			: "";

		source.replace(
			dep.range[0],
			dep.range[1] - 1,
			`${comment}${JSON.stringify(included)}`
		);
	}
};

module.exports = WebpackIsIncludedDependency;
