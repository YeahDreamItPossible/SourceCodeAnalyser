"use strict";

const ImportContextDependency = require("./ImportContextDependency");
const ImportDependency = require("./ImportDependency");
const ImportEagerDependency = require("./ImportEagerDependency");
const ImportParserPlugin = require("./ImportParserPlugin");
const ImportWeakDependency = require("./ImportWeakDependency");

// ES模块动态导入插件
// 主要用来分析 ES 动态导入(即: import('...').then(...).catch(...))
class ImportPlugin {
	apply(compiler) {
		compiler.hooks.compilation.tap(
			"ImportPlugin",
			(compilation, { contextModuleFactory, normalModuleFactory }) => {
				compilation.dependencyFactories.set(
					ImportDependency,
					normalModuleFactory
				);
				compilation.dependencyTemplates.set(
					ImportDependency,
					new ImportDependency.Template()
				);

				compilation.dependencyFactories.set(
					ImportEagerDependency,
					normalModuleFactory
				);
				compilation.dependencyTemplates.set(
					ImportEagerDependency,
					new ImportEagerDependency.Template()
				);

				compilation.dependencyFactories.set(
					ImportWeakDependency,
					normalModuleFactory
				);
				compilation.dependencyTemplates.set(
					ImportWeakDependency,
					new ImportWeakDependency.Template()
				);

				compilation.dependencyFactories.set(
					ImportContextDependency,
					contextModuleFactory
				);
				compilation.dependencyTemplates.set(
					ImportContextDependency,
					new ImportContextDependency.Template()
				);

				const handler = (parser, parserOptions) => {
					if (parserOptions.import !== undefined && !parserOptions.import)
						return;

					new ImportParserPlugin(parserOptions).apply(parser);
				};

				normalModuleFactory.hooks.parser
					.for("javascript/auto")
					.tap("ImportPlugin", handler);
				normalModuleFactory.hooks.parser
					.for("javascript/dynamic")
					.tap("ImportPlugin", handler);
				normalModuleFactory.hooks.parser
					.for("javascript/esm")
					.tap("ImportPlugin", handler);
			}
		);
	}
}
module.exports = ImportPlugin;
