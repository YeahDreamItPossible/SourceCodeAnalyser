"use strict";

const makeSerializable = require("../util/makeSerializable");
const ImportDependency = require("./ImportDependency");

// ES模块动态导入弱引用加载依赖
// 1. 当代码片段中含有 import() 语法
// 2. 且动态导入内敛注释中 webpackMode = 'weak' 时 或者 Webpack.options.module.parser.javascript.dynamicImportMode = 'weak' 时
// 该动态导入的模块不会生成额外的模块, 但是会以返回 Promise 的方式尝试加载该模块
// 如果该模块已经以其他方式加载，(即另一个 chunk 导入过此模块，或包含模块的脚本被加载)时 才会成功解析
// 如果该模块不可用，则返回 rejected 状态的 Promise，且网络请求永远都不会执行。
// 当需要的 chunks 始终在（嵌入在页面中的）初始请求中手动提供，
// 而不是在应用程序导航在最初没有提供的模块导入的情况下触发，这对于通用渲染（SSR）是非常有用的
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
