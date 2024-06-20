"use strict";

const RuntimeGlobals = require("../RuntimeGlobals");
const RuntimeModule = require("../RuntimeModule");

// 运行时模块之兼容
class CompatRuntimeModule extends RuntimeModule {
	constructor() {
		super("compat", RuntimeModule.STAGE_ATTACH);
		this.fullHash = true;
	}

	generate() {
		const { chunkGraph, chunk, compilation } = this;
		const {
			runtimeTemplate,
			mainTemplate,
			moduleTemplates,
			dependencyTemplates
		} = compilation;
		const bootstrap = mainTemplate.hooks.bootstrap.call(
			"",
			chunk,
			compilation.hash || "XXXX",
			moduleTemplates.javascript,
			dependencyTemplates
		);
		const localVars = mainTemplate.hooks.localVars.call(
			"",
			chunk,
			compilation.hash || "XXXX"
		);
		const requireExtensions = mainTemplate.hooks.requireExtensions.call(
			"",
			chunk,
			compilation.hash || "XXXX"
		);
		const runtimeRequirements = chunkGraph.getTreeRuntimeRequirements(chunk);
		let requireEnsure = "";
		if (runtimeRequirements.has(RuntimeGlobals.ensureChunk)) {
			const requireEnsureHandler = mainTemplate.hooks.requireEnsure.call(
				"",
				chunk,
				compilation.hash || "XXXX",
				"chunkId"
			);
			if (requireEnsureHandler) {
				requireEnsure = `${
					RuntimeGlobals.ensureChunkHandlers
				}.compat = ${runtimeTemplate.basicFunction(
					"chunkId, promises",
					requireEnsureHandler
				)};`;
			}
		}
		return [bootstrap, localVars, requireEnsure, requireExtensions]
			.filter(Boolean)
			.join("\n");
	}

	// 运行时模块是否应该有独立作用域
	shouldIsolate() {
		// We avoid isolating this to have better backward-compat
		return false;
	}
}

module.exports = CompatRuntimeModule;
