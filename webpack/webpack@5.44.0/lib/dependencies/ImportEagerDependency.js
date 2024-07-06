"use strict";

const makeSerializable = require("../util/makeSerializable");
const ImportDependency = require("./ImportDependency");

// ES模块动态导入立即加载依赖
// 1. 当代码片段中含有 import() 语法
// 2. 且动态导入内敛注释中 webpackMode = 'eager' 时 或者 Webpack.options.module.parser.javascript.dynamicImportMode = 'eager' 时
// 该动态导入的模块不会生成额外的chunk
// 所有的模块都被当前的 chunk 引入，并且没有额外的网络请求。
// 但是仍会返回一个 resolved 状态的 Promise。
// 与静态导入相比，在调用 import() 完成之前，该模块不会被执行。
class ImportEagerDependency extends ImportDependency {
	constructor(request, range, referencedExports) {
		super(request, range, referencedExports);
	}

	get type() {
		return "import() eager";
	}

	get category() {
		return "esm";
	}
}

makeSerializable(
	ImportEagerDependency,
	"webpack/lib/dependencies/ImportEagerDependency"
);

ImportEagerDependency.Template = class ImportEagerDependencyTemplate extends (
	ImportDependency.Template
) {
	apply(
		dependency,
		source,
		{ runtimeTemplate, module, moduleGraph, chunkGraph, runtimeRequirements }
	) {
		const dep = /** @type {ImportEagerDependency} */ (dependency);
		const content = runtimeTemplate.moduleNamespacePromise({
			chunkGraph,
			module: moduleGraph.getModule(dep),
			request: dep.request,
			strict: module.buildMeta.strictHarmonyModule,
			message: "import() eager",
			runtimeRequirements
		});

		source.replace(dep.range[0], dep.range[1] - 1, content);
	}
};

module.exports = ImportEagerDependency;
