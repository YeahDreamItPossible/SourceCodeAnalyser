"use strict";

const { RawSource } = require("webpack-sources");
const Generator = require("../Generator");
const RuntimeGlobals = require("../RuntimeGlobals");

/** @typedef {import("webpack-sources").Source} Source */
/** @typedef {import("../Generator").GenerateContext} GenerateContext */
/** @typedef {import("../NormalModule")} NormalModule */

const TYPES = new Set(["javascript"]);

// 导出资源的源代码 通过raw-loader实现
// Webpack.options.module.Rule.type = 'asset/source' 
class AssetSourceGenerator extends Generator {
	/**
	 * @param {NormalModule} module module for which the code should be generated
	 * @param {GenerateContext} generateContext context for generate
	 * @returns {Source} generated code
	 */
	generate(module, { chunkGraph, runtimeTemplate, runtimeRequirements }) {
		runtimeRequirements.add(RuntimeGlobals.module);

		const originalSource = module.originalSource();

		if (!originalSource) {
			return new RawSource("");
		}

		const content = originalSource.source();

		let encodedSource;
		if (typeof content === "string") {
			encodedSource = content;
		} else {
			encodedSource = content.toString("utf-8");
		}
		return new RawSource(
			`${RuntimeGlobals.module}.exports = ${JSON.stringify(encodedSource)};`
		);
	}

	getTypes(module) {
		return TYPES;
	}

	getSize(module, type) {
		const originalSource = module.originalSource();

		if (!originalSource) {
			return 0;
		}

		// Example: m.exports="abcd"
		return originalSource.size() + 12;
	}
}

module.exports = AssetSourceGenerator;
