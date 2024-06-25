"use strict";

const { RawSource } = require("webpack-sources");
const Module = require("./Module");
const RuntimeGlobals = require("./RuntimeGlobals");
const makeSerializable = require("./util/makeSerializable");

const TYPES = new Set(["javascript"]);
const RUNTIME_REQUIREMENTS = new Set([
	RuntimeGlobals.require,
	RuntimeGlobals.module
]);

// 动态链接库 模块
class DllModule extends Module {
	constructor(context, dependencies, name) {
		super("javascript/dynamic", context);

		// Info from Factory
		this.dependencies = dependencies;
		this.name = name;
	}

	getSourceTypes() {
		return TYPES;
	}

	identifier() {
		return `dll ${this.name}`;
	}

	/**
	 * @param {RequestShortener} requestShortener the request shortener
	 * @returns {string} a user readable identifier of the module
	 */
	readableIdentifier(requestShortener) {
		return `dll ${this.name}`;
	}

	build(options, compilation, resolver, fs, callback) {
		this.buildMeta = {};
		this.buildInfo = {};
		return callback();
	}

	/**
	 * @param {CodeGenerationContext} context context for code generation
	 * @returns {CodeGenerationResult} result
	 */
	codeGeneration(context) {
		const sources = new Map();
		sources.set(
			"javascript",
			new RawSource("module.exports = __webpack_require__;")
		);
		return {
			sources,
			runtimeRequirements: RUNTIME_REQUIREMENTS
		};
	}

	needBuild(context, callback) {
		return callback(null, !this.buildMeta);
	}

	/**
	 * @param {string=} type the source type for which the size should be estimated
	 * @returns {number} the estimated size of the module (must be non-zero)
	 */
	size(type) {
		return 12;
	}

	updateHash(hash, context) {
		hash.update("dll module");
		hash.update(this.name || "");
		super.updateHash(hash, context);
	}

	serialize(context) {
		context.write(this.name);
		super.serialize(context);
	}

	deserialize(context) {
		this.name = context.read();
		super.deserialize(context);
	}

	/**
	 * Assuming this module is in the cache. Update the (cached) module with
	 * the fresh module from the factory. Usually updates internal references
	 * and properties.
	 * @param {Module} module fresh module
	 * @returns {void}
	 */
	updateCacheModule(module) {
		super.updateCacheModule(module);
		this.dependencies = module.dependencies;
	}

	/**
	 * Assuming this module is in the cache. Remove internal references to allow freeing some memory.
	 */
	cleanupForCache() {
		super.cleanupForCache();
		this.dependencies = undefined;
	}
}

makeSerializable(DllModule, "webpack/lib/DllModule");

module.exports = DllModule;
