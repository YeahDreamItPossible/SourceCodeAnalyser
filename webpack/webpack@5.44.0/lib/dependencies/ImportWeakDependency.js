"use strict";

const makeSerializable = require("../util/makeSerializable");
const ImportDependency = require("./ImportDependency");

// ES模块动态导入依赖
// 1. 当代码片段中含有 import() 语法
// 2. 动态导入内敛注释中 webpackMode = 'weak' 时 或者 Webpack.options.module.parser.javascript.dynamicImportMode = 'weak' 时
class ImportWeakDependency extends ImportDependency {
	constructor(request, range, referencedExports) {
		super(request, range, referencedExports);
		// 当前依赖是 弱依赖
		this.weak = true;
	}

	get type() {
		return "import() weak";
	}
}

makeSerializable(
	ImportWeakDependency,
	"webpack/lib/dependencies/ImportWeakDependency"
);

ImportWeakDependency.Template = class ImportDependencyTemplate extends (
	ImportDependency.Template
) {
	apply(
		dependency,
		source,
		{ runtimeTemplate, module, moduleGraph, chunkGraph, runtimeRequirements }
	) {
		const dep = /** @type {ImportWeakDependency} */ (dependency);
		const content = runtimeTemplate.moduleNamespacePromise({
			chunkGraph,
			module: moduleGraph.getModule(dep),
			request: dep.request,
			strict: module.buildMeta.strictHarmonyModule,
			message: "import() weak",
			weak: true,
			runtimeRequirements
		});

		source.replace(dep.range[0], dep.range[1] - 1, content);
	}
};

module.exports = ImportWeakDependency;
