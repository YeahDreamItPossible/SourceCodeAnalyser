"use strict";

const Dependency = require("../Dependency");
const {
	getDependencyUsedByExportsCondition
} = require("../optimize/InnerGraph");
const makeSerializable = require("../util/makeSerializable");
const propertyAccess = require("../util/propertyAccess");
const HarmonyImportDependency = require("./HarmonyImportDependency");

/** @typedef {import("webpack-sources").ReplaceSource} ReplaceSource */
/** @typedef {import("../ChunkGraph")} ChunkGraph */
/** @typedef {import("../Dependency").ExportsSpec} ExportsSpec */
/** @typedef {import("../Dependency").ReferencedExport} ReferencedExport */
/** @typedef {import("../Dependency").UpdateHashContext} UpdateHashContext */
/** @typedef {import("../DependencyTemplate").DependencyTemplateContext} DependencyTemplateContext */
/** @typedef {import("../ModuleGraph")} ModuleGraph */
/** @typedef {import("../ModuleGraphConnection")} ModuleGraphConnection */
/** @typedef {import("../ModuleGraphConnection").ConnectionState} ConnectionState */
/** @typedef {import("../WebpackError")} WebpackError */
/** @typedef {import("../util/Hash")} Hash */
/** @typedef {import("../util/runtime").RuntimeSpec} RuntimeSpec */

const idsSymbol = Symbol("HarmonyImportSpecifierDependency.ids");

// ES模块导入标识符依赖
// 当 import 语句中 包含具体的导入标识符时(即: import '...')
// 当遇到 import 语句时 则会创建 HarmonyImportSideEffectDependency 的实例
class HarmonyImportSpecifierDependency extends HarmonyImportDependency {
	constructor(request, sourceOrder, ids, name, range, strictExportPresence) {
		super(request, sourceOrder);
		// 导入的标识符(即: 变量)
		this.ids = ids;
		// 导入的真正标识符
		// 如果 导入的标识符号没有使用别名时 this.name 与 this.ids[0] 一致
		this.name = name;
		// 
		this.range = range;
		// 
		this.strictExportPresence = strictExportPresence;
		this.namespaceObjectAsContext = false;
		this.call = undefined;
		this.directImport = undefined;
		this.shorthand = undefined;
		this.asiSafe = undefined;
		// Set<string> | boolean
		this.usedByExports = undefined;
	}

	// HarmonyImportSpecifierDependency.prototype.id 移除
	// HarmonyImportSpecifierDependency.prototype.ids 替代
	get id() {
		throw new Error("id was renamed to ids and type changed to string[]");
	}
	getId() {
		throw new Error("id was renamed to ids and type changed to string[]");
	}
	setId() {
		throw new Error("id was renamed to ids and type changed to string[]");
	}

	get type() {
		return "harmony import specifier";
	}

	// 返回 导入的字段
	// 示例: import { add, minus } from 'xx' => ids: [ 'add', 'minus' ]
	getIds(moduleGraph) {
		// 返回 moduleGraph._metaMap[this]
		const meta = moduleGraph.getMetaIfExisting(this);
		if (meta === undefined) return this.ids;
		const ids = meta[idsSymbol];
		// 优先返回 moduleGraph._metaMap
		// 其次 this.ids
		return ids !== undefined ? ids : this.ids;
	}

	// 设置 moduleGraph._metaMap[this](idsSymbol) = ids
	setIds(moduleGraph, ids) {
		moduleGraph.getMeta(this)[idsSymbol] = ids;
	}

	/**
	 * @param {ModuleGraph} moduleGraph module graph
	 * @returns {null | false | function(ModuleGraphConnection, RuntimeSpec): ConnectionState} function to determine if the connection is active
	 */
	getCondition(moduleGraph) {
		return getDependencyUsedByExportsCondition(
			this,
			this.usedByExports,
			moduleGraph
		);
	}

	/**
	 * @param {ModuleGraph} moduleGraph the module graph
	 * @returns {ConnectionState} how this dependency connects the module to referencing modules
	 */
	getModuleEvaluationSideEffectsState(moduleGraph) {
		return false;
	}

	/**
	 * Returns list of exports referenced by this dependency
	 * @param {ModuleGraph} moduleGraph module graph
	 * @param {RuntimeSpec} runtime the runtime for which the module is analysed
	 * @returns {(string[] | ReferencedExport)[]} referenced exports
	 */
	getReferencedExports(moduleGraph, runtime) {
		let ids = this.getIds(moduleGraph);
		if (ids.length === 0) return Dependency.EXPORTS_OBJECT_REFERENCED;
		let namespaceObjectAsContext = this.namespaceObjectAsContext;
		if (ids[0] === "default") {
			const selfModule = moduleGraph.getParentModule(this);
			const importedModule = moduleGraph.getModule(this);
			switch (
				importedModule.getExportsType(
					moduleGraph,
					selfModule.buildMeta.strictHarmonyModule
				)
			) {
				case "default-only":
				case "default-with-named":
					if (ids.length === 1) return Dependency.EXPORTS_OBJECT_REFERENCED;
					ids = ids.slice(1);
					namespaceObjectAsContext = true;
					break;
				case "dynamic":
					return Dependency.EXPORTS_OBJECT_REFERENCED;
			}
		}

		if (
			this.call &&
			!this.directImport &&
			(namespaceObjectAsContext || ids.length > 1)
		) {
			if (ids.length === 1) return Dependency.EXPORTS_OBJECT_REFERENCED;
			ids = ids.slice(0, -1);
		}

		return [ids];
	}

	/**
	 * Returns warnings
	 * @param {ModuleGraph} moduleGraph module graph
	 * @returns {WebpackError[]} warnings
	 */
	getWarnings(moduleGraph) {
		if (
			this.strictExportPresence ||
			moduleGraph.getParentModule(this).buildMeta.strictHarmonyModule
		) {
			return null;
		}
		return this._getErrors(moduleGraph);
	}

	/**
	 * Returns errors
	 * @param {ModuleGraph} moduleGraph module graph
	 * @returns {WebpackError[]} errors
	 */
	getErrors(moduleGraph) {
		if (
			this.strictExportPresence ||
			moduleGraph.getParentModule(this).buildMeta.strictHarmonyModule
		) {
			return this._getErrors(moduleGraph);
		}
		return null;
	}

	/**
	 * @param {ModuleGraph} moduleGraph module graph
	 * @returns {WebpackError[] | undefined} errors
	 */
	_getErrors(moduleGraph) {
		const ids = this.getIds(moduleGraph);
		return this.getLinkingErrors(
			moduleGraph,
			ids,
			`(imported as '${this.name}')`
		);
	}

	// 
	getNumberOfIdOccurrences() {
		return 0;
	}

	serialize(context) {
		const { write } = context;
		write(this.ids);
		write(this.name);
		write(this.range);
		write(this.strictExportPresence);
		write(this.namespaceObjectAsContext);
		write(this.call);
		write(this.directImport);
		write(this.shorthand);
		write(this.asiSafe);
		write(this.usedByExports);
		super.serialize(context);
	}

	deserialize(context) {
		const { read } = context;
		this.ids = read();
		this.name = read();
		this.range = read();
		this.strictExportPresence = read();
		this.namespaceObjectAsContext = read();
		this.call = read();
		this.directImport = read();
		this.shorthand = read();
		this.asiSafe = read();
		this.usedByExports = read();
		super.deserialize(context);
	}
}

makeSerializable(
	HarmonyImportSpecifierDependency,
	"webpack/lib/dependencies/HarmonyImportSpecifierDependency"
);

HarmonyImportSpecifierDependency.Template = class HarmonyImportSpecifierDependencyTemplate extends (
	HarmonyImportDependency.Template
) {
	/**
	 * @param {Dependency} dependency the dependency for which the template should be applied
	 * @param {ReplaceSource} source the current replace source which can be modified
	 * @param {DependencyTemplateContext} templateContext the context object
	 * @returns {void}
	 */
	apply(dependency, source, templateContext) {
		const dep = /** @type {HarmonyImportSpecifierDependency} */ (dependency);
		const { moduleGraph, module, runtime, concatenationScope } =
			templateContext;
		const connection = moduleGraph.getConnection(dep);
		// Skip rendering depending when dependency is conditional
		if (connection && !connection.isTargetActive(runtime)) return;

		const ids = dep.getIds(moduleGraph);

		let exportExpr;
		if (
			connection &&
			concatenationScope &&
			concatenationScope.isModuleInScope(connection.module)
		) {
			if (ids.length === 0) {
				exportExpr = concatenationScope.createModuleReference(
					connection.module,
					{
						asiSafe: dep.asiSafe
					}
				);
			} else if (dep.namespaceObjectAsContext && ids.length === 1) {
				exportExpr =
					concatenationScope.createModuleReference(connection.module, {
						asiSafe: dep.asiSafe
					}) + propertyAccess(ids);
			} else {
				exportExpr = concatenationScope.createModuleReference(
					connection.module,
					{
						ids,
						call: dep.call,
						directImport: dep.directImport,
						asiSafe: dep.asiSafe
					}
				);
			}
		} else {
			super.apply(dependency, source, templateContext);

			const { runtimeTemplate, initFragments, runtimeRequirements } =
				templateContext;

			exportExpr = runtimeTemplate.exportFromImport({
				moduleGraph,
				module: moduleGraph.getModule(dep),
				request: dep.request,
				exportName: ids,
				originModule: module,
				asiSafe: dep.shorthand ? true : dep.asiSafe,
				isCall: dep.call,
				callContext: !dep.directImport,
				defaultInterop: true,
				importVar: dep.getImportVar(moduleGraph),
				initFragments,
				runtime,
				runtimeRequirements
			});
		}
		if (dep.shorthand) {
			source.insert(dep.range[1], `: ${exportExpr}`);
		} else {
			source.replace(dep.range[0], dep.range[1] - 1, exportExpr);
		}
	}
};

module.exports = HarmonyImportSpecifierDependency;
