"use strict";

const DynamicExports = require("./DynamicExports");
const HarmonyCompatibilityDependency = require("./HarmonyCompatibilityDependency");
const HarmonyExports = require("./HarmonyExports");

// ES模块检测语法分析插件
// 该插件主要是用来分析当前模式是否是 ES模块 及 分析
module.exports = class HarmonyDetectionParserPlugin {
	constructor(options) {
		const { topLevelAwait = false } = options || {};
		this.topLevelAwait = topLevelAwait;
	}

	apply(parser) {
		parser.hooks.program.tap("HarmonyDetectionParserPlugin", ast => {
			// 是否是 esm 模块
			const isStrictHarmony = parser.state.module.type === "javascript/esm";
			// 是否是 esm 模块
			const isHarmony =
				isStrictHarmony ||
				ast.body.some(
					statement =>
						statement.type === "ImportDeclaration" ||
						statement.type === "ExportDefaultDeclaration" ||
						statement.type === "ExportNamedDeclaration" ||
						statement.type === "ExportAllDeclaration"
				);
			if (isHarmony) {
				const module = parser.state.module;
				const compatDep = new HarmonyCompatibilityDependency();
				compatDep.loc = {
					start: {
						line: -1,
						column: 0
					},
					end: {
						line: -1,
						column: 0
					},
					index: -3
				};
				module.addPresentationalDependency(compatDep);
				DynamicExports.bailout(parser.state);
				HarmonyExports.enable(parser.state, isStrictHarmony);
				parser.scope.isStrict = true;
			}
		});

		parser.hooks.topLevelAwait.tap("HarmonyDetectionParserPlugin", () => {
			const module = parser.state.module;
			if (!this.topLevelAwait) {
				throw new Error(
					"The top-level-await experiment is not enabled (set experiments.topLevelAwait: true to enabled it)"
				);
			}
			if (!HarmonyExports.isEnabled(parser.state)) {
				throw new Error(
					"Top-level-await is only supported in EcmaScript Modules"
				);
			}
			module.buildMeta.async = true;
		});

		const skipInHarmony = () => {
			if (HarmonyExports.isEnabled(parser.state)) {
				return true;
			}
		};

		const nullInHarmony = () => {
			if (HarmonyExports.isEnabled(parser.state)) {
				return null;
			}
		};

		const nonHarmonyIdentifiers = ["define", "exports"];
		for (const identifier of nonHarmonyIdentifiers) {
			parser.hooks.evaluateTypeof
				.for(identifier)
				.tap("HarmonyDetectionParserPlugin", nullInHarmony);
			parser.hooks.typeof
				.for(identifier)
				.tap("HarmonyDetectionParserPlugin", skipInHarmony);
			parser.hooks.evaluate
				.for(identifier)
				.tap("HarmonyDetectionParserPlugin", nullInHarmony);
			parser.hooks.expression
				.for(identifier)
				.tap("HarmonyDetectionParserPlugin", skipInHarmony);
			parser.hooks.call
				.for(identifier)
				.tap("HarmonyDetectionParserPlugin", skipInHarmony);
		}
	}
};
