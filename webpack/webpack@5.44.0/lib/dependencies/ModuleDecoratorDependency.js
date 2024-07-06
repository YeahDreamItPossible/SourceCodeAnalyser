"use strict";

const Dependency = require("../Dependency");
const InitFragment = require("../InitFragment");
const RuntimeGlobals = require("../RuntimeGlobals");
const makeSerializable = require("../util/makeSerializable");
const NullDependency = require("./NullDependency");

// 模块装饰依赖
class ModuleDecoratorDependency extends NullDependency {
	/**
	 * @param {string} decorator the decorator requirement
	 * @param {boolean} allowExportsAccess allow to access exports from module
	 */
	constructor(decorator, allowExportsAccess) {
		super();
		this.decorator = decorator;
		this.allowExportsAccess = allowExportsAccess;
	}

	get type() {
		return "module decorator";
	}

	get category() {
		return "self";
	}

	getResourceIdentifier() {
		return `self`;
	}

	/**
	 * Returns list of exports referenced by this dependency
	 * @param {ModuleGraph} moduleGraph module graph
	 * @param {RuntimeSpec} runtime the runtime for which the module is analysed
	 * @returns {(string[] | ReferencedExport)[]} referenced exports
	 */
	getReferencedExports(moduleGraph, runtime) {
		return this.allowExportsAccess
			? Dependency.EXPORTS_OBJECT_REFERENCED
			: Dependency.NO_EXPORTS_REFERENCED;
	}

	/**
	 * Update the hash
	 * @param {Hash} hash hash to be updated
	 * @param {UpdateHashContext} context context
	 * @returns {void}
	 */
	updateHash(hash, context) {
		hash.update(this.decorator);
		hash.update(`${this.allowExportsAccess}`);
	}

	serialize(context) {
		const { write } = context;
		write(this.decorator);
		write(this.allowExportsAccess);
		super.serialize(context);
	}

	deserialize(context) {
		const { read } = context;
		this.decorator = read();
		this.allowExportsAccess = read();
		super.deserialize(context);
	}
}

makeSerializable(
	ModuleDecoratorDependency,
	"webpack/lib/dependencies/ModuleDecoratorDependency"
);

ModuleDecoratorDependency.Template = class ModuleDecoratorDependencyTemplate extends (
	NullDependency.Template
) {
	apply(
		dependency,
		source,
		{ module, chunkGraph, initFragments, runtimeRequirements }
	) {
		const dep = /** @type {ModuleDecoratorDependency} */ (dependency);
		runtimeRequirements.add(RuntimeGlobals.moduleLoaded);
		runtimeRequirements.add(RuntimeGlobals.moduleId);
		runtimeRequirements.add(RuntimeGlobals.module);
		runtimeRequirements.add(dep.decorator);
		initFragments.push(
			new InitFragment(
				`/* module decorator */ ${module.moduleArgument} = ${dep.decorator}(${module.moduleArgument});\n`,
				InitFragment.STAGE_PROVIDES,
				0,
				`module decorator ${chunkGraph.getModuleId(module)}`
			)
		);
	}
};

module.exports = ModuleDecoratorDependency;
