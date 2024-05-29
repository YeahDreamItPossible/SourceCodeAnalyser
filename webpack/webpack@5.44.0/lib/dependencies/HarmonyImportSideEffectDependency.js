"use strict";

const makeSerializable = require("../util/makeSerializable");
const HarmonyImportDependency = require("./HarmonyImportDependency");

/** @typedef {import("webpack-sources").ReplaceSource} ReplaceSource */
/** @typedef {import("../Dependency")} Dependency */
/** @typedef {import("../DependencyTemplate").DependencyTemplateContext} DependencyTemplateContext */
/** @typedef {import("../InitFragment")} InitFragment */
/** @typedef {import("../Module")} Module */
/** @typedef {import("../ModuleGraph")} ModuleGraph */
/** @typedef {import("../ModuleGraphConnection")} ModuleGraphConnection */
/** @typedef {import("../ModuleGraphConnection").ConnectionState} ConnectionState */
/** @typedef {import("../util/Hash")} Hash */
/** @typedef {import("../util/runtime").RuntimeSpec} RuntimeSpec */

// ES模块导入副作用依赖
// 当遇到 import 语句时 则会创建 HarmonyImportSideEffectDependency 的示例
class HarmonyImportSideEffectDependency extends HarmonyImportDependency {
	constructor(request, sourceOrder) {
		// request: 模块引入依赖
		super(request, sourceOrder);
	}

	get type() {
		return "harmony side effect evaluation";
	}

	// 返回 用于确认连接是否处于活动状态的函数
	getCondition(moduleGraph) {
		return connection => {
			const refModule = connection.resolvedModule;
			if (!refModule) return true;
			return refModule.getSideEffectsConnectionState(moduleGraph);
		};
	}

	// 此依赖关系如何将模块连接到引用模块
	getModuleEvaluationSideEffectsState(moduleGraph) {
		const refModule = moduleGraph.getModule(this);
		if (!refModule) return true;
		return refModule.getSideEffectsConnectionState(moduleGraph);
	}
}

makeSerializable(
	HarmonyImportSideEffectDependency,
	"webpack/lib/dependencies/HarmonyImportSideEffectDependency"
);

HarmonyImportSideEffectDependency.Template = class HarmonyImportSideEffectDependencyTemplate extends (
	HarmonyImportDependency.Template
) {
	/**
	 * @param {Dependency} dependency the dependency for which the template should be applied
	 * @param {ReplaceSource} source the current replace source which can be modified
	 * @param {DependencyTemplateContext} templateContext the context object
	 * @returns {void}
	 */
	apply(dependency, source, templateContext) {
		const { moduleGraph, concatenationScope } = templateContext;
		if (concatenationScope) {
			const module = moduleGraph.getModule(dependency);
			if (concatenationScope.isModuleInScope(module)) {
				return;
			}
		}
		super.apply(dependency, source, templateContext);
	}
};

module.exports = HarmonyImportSideEffectDependency;
