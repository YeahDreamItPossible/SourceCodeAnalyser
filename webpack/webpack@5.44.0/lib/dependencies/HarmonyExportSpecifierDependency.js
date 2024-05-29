"use strict";

const makeSerializable = require("../util/makeSerializable");
const HarmonyExportInitFragment = require("./HarmonyExportInitFragment");
const NullDependency = require("./NullDependency");

/** @typedef {import("webpack-sources").ReplaceSource} ReplaceSource */
/** @typedef {import("../Dependency")} Dependency */
/** @typedef {import("../Dependency").ExportsSpec} ExportsSpec */
/** @typedef {import("../DependencyTemplate").DependencyTemplateContext} DependencyTemplateContext */
/** @typedef {import("../ModuleGraph")} ModuleGraph */
/** @typedef {import("../ModuleGraphConnection").ConnectionState} ConnectionState */

// ES模块 导出标识符 依赖
// 当遇到 export 语句 且 导出具体的标识符 时
class HarmonyExportSpecifierDependency extends NullDependency {
	constructor(id, name) {
		super();
		// 模块导出的标识符(as字段之后的标识符)
		this.id = id;
		// 模块导出的标识符(as字段之前的标识符)
		this.name = name;
	}

	// 返回依赖类型
	get type() {
		return "harmony export specifier";
	}

	/**
	 * Returns the exported names
	 * @param {ModuleGraph} moduleGraph module graph
	 * @returns {ExportsSpec | undefined} export names
	 */
	getExports(moduleGraph) {
		return {
			exports: [this.name],
			priority: 1,
			terminalBinding: true,
			dependencies: undefined
		};
	}

	getModuleEvaluationSideEffectsState(moduleGraph) {
		return false;
	}

	serialize(context) {
		const { write } = context;
		write(this.id);
		write(this.name);
		super.serialize(context);
	}

	deserialize(context) {
		const { read } = context;
		this.id = read();
		this.name = read();
		super.deserialize(context);
	}
}

makeSerializable(
	HarmonyExportSpecifierDependency,
	"webpack/lib/dependencies/HarmonyExportSpecifierDependency"
);

HarmonyExportSpecifierDependency.Template = class HarmonyExportSpecifierDependencyTemplate extends (
	NullDependency.Template
) {
	/**
	 * @param {Dependency} dependency the dependency for which the template should be applied
	 * @param {ReplaceSource} source the current replace source which can be modified
	 * @param {DependencyTemplateContext} templateContext the context object
	 * @returns {void}
	 */
	apply(
		dependency,
		source,
		{ module, moduleGraph, initFragments, runtime, concatenationScope }
	) {
		const dep = /** @type {HarmonyExportSpecifierDependency} */ (dependency);
		if (concatenationScope) {
			concatenationScope.registerExport(dep.name, dep.id);
			return;
		}
		const used = moduleGraph
			.getExportsInfo(module)
			.getUsedName(dep.name, runtime);
		if (!used) {
			const set = new Set();
			set.add(dep.name || "namespace");
			initFragments.push(
				new HarmonyExportInitFragment(module.exportsArgument, undefined, set)
			);
			return;
		}

		const map = new Map();
		map.set(used, `/* binding */ ${dep.id}`);
		initFragments.push(
			new HarmonyExportInitFragment(module.exportsArgument, map, undefined)
		);
	}
};

module.exports = HarmonyExportSpecifierDependency;
