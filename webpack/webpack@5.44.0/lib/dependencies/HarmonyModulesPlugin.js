"use strict";

const HarmonyAcceptDependency = require("./HarmonyAcceptDependency");
const HarmonyAcceptImportDependency = require("./HarmonyAcceptImportDependency");
const HarmonyCompatibilityDependency = require("./HarmonyCompatibilityDependency");
const HarmonyExportExpressionDependency = require("./HarmonyExportExpressionDependency");
const HarmonyExportHeaderDependency = require("./HarmonyExportHeaderDependency");
const HarmonyExportImportedSpecifierDependency = require("./HarmonyExportImportedSpecifierDependency");
const HarmonyExportSpecifierDependency = require("./HarmonyExportSpecifierDependency");
const HarmonyImportSideEffectDependency = require("./HarmonyImportSideEffectDependency");
const HarmonyImportSpecifierDependency = require("./HarmonyImportSpecifierDependency");

const HarmonyDetectionParserPlugin = require("./HarmonyDetectionParserPlugin");
const HarmonyExportDependencyParserPlugin = require("./HarmonyExportDependencyParserPlugin");
const HarmonyImportDependencyParserPlugin = require("./HarmonyImportDependencyParserPlugin");
const HarmonyTopLevelThisParserPlugin = require("./HarmonyTopLevelThisParserPlugin");

// ES模块插件
class HarmonyModulesPlugin {
	constructor(options) {
		this.options = options;
	}

	apply(compiler) {
		compiler.hooks.compilation.tap(
			"HarmonyModulesPlugin",
			(compilation, { normalModuleFactory }) => {
				compilation.dependencyTemplates.set(
					HarmonyCompatibilityDependency,
					new HarmonyCompatibilityDependency.Template()
				);

				compilation.dependencyFactories.set(
					HarmonyImportSideEffectDependency,
					normalModuleFactory
				);
				compilation.dependencyTemplates.set(
					HarmonyImportSideEffectDependency,
					new HarmonyImportSideEffectDependency.Template()
				);

				compilation.dependencyFactories.set(
					HarmonyImportSpecifierDependency,
					normalModuleFactory
				);
				compilation.dependencyTemplates.set(
					HarmonyImportSpecifierDependency,
					new HarmonyImportSpecifierDependency.Template()
				);

				compilation.dependencyTemplates.set(
					HarmonyExportHeaderDependency,
					new HarmonyExportHeaderDependency.Template()
				);

				compilation.dependencyTemplates.set(
					HarmonyExportExpressionDependency,
					new HarmonyExportExpressionDependency.Template()
				);

				compilation.dependencyTemplates.set(
					HarmonyExportSpecifierDependency,
					new HarmonyExportSpecifierDependency.Template()
				);

				compilation.dependencyFactories.set(
					HarmonyExportImportedSpecifierDependency,
					normalModuleFactory
				);
				compilation.dependencyTemplates.set(
					HarmonyExportImportedSpecifierDependency,
					new HarmonyExportImportedSpecifierDependency.Template()
				);

				compilation.dependencyTemplates.set(
					HarmonyAcceptDependency,
					new HarmonyAcceptDependency.Template()
				);

				compilation.dependencyFactories.set(
					HarmonyAcceptImportDependency,
					normalModuleFactory
				);
				compilation.dependencyTemplates.set(
					HarmonyAcceptImportDependency,
					new HarmonyAcceptImportDependency.Template()
				);

				// 代码解析器
				const handler = (parser, parserOptions) => {
					// TODO webpack 6: rename harmony to esm or module
					if (parserOptions.harmony !== undefined && !parserOptions.harmony)
						return;

					new HarmonyDetectionParserPlugin(this.options).apply(parser);
					// ES模块 import 语句
					new HarmonyImportDependencyParserPlugin(parserOptions).apply(parser);
					// ES模块 export 语句
					new HarmonyExportDependencyParserPlugin(parserOptions).apply(parser);
					new HarmonyTopLevelThisParserPlugin().apply(parser);
				};

				normalModuleFactory.hooks.parser
					.for("javascript/auto")
					.tap("HarmonyModulesPlugin", handler);
				normalModuleFactory.hooks.parser
					.for("javascript/esm")
					.tap("HarmonyModulesPlugin", handler);
			}
		);
	}
}
module.exports = HarmonyModulesPlugin;
