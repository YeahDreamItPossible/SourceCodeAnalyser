/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/

"use strict";

const makeSerializable = require("../util/makeSerializable");
const ImportDependency = require("./ImportDependency");

// ES模块动态导入依赖
// 1. 当代码片段中含有 import() 语法
// 2. 动态导入内敛注释中 webpackMode = 'eager' 时 或者 Webpack.Config.module.parser.javascript.dynamicImportMode = 'eager' 时
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
