"use strict";

const Dependency = require("../Dependency");
const Template = require("../Template");
const makeSerializable = require("../util/makeSerializable");
const ModuleDependency = require("./ModuleDependency");

// 通过 webpack特有的 require.include 语法引入的依赖
class RequireIncludeDependency extends ModuleDependency {
	constructor(request, range) {
		super(request);

		this.range = range;
	}

	getReferencedExports(moduleGraph, runtime) {
		return Dependency.NO_EXPORTS_REFERENCED;
	}

	get type() {
		return "require.include";
	}

	get category() {
		return "commonjs";
	}
}

makeSerializable(
	RequireIncludeDependency,
	"webpack/lib/dependencies/RequireIncludeDependency"
);

RequireIncludeDependency.Template = class RequireIncludeDependencyTemplate extends (
	ModuleDependency.Template
) {
	apply(dependency, source, { runtimeTemplate }) {
		const dep = /** @type {RequireIncludeDependency} */ (dependency);
		const comment = runtimeTemplate.outputOptions.pathinfo
			? Template.toComment(
					`require.include ${runtimeTemplate.requestShortener.shorten(
						dep.request
					)}`
			  )
			: "";

		source.replace(dep.range[0], dep.range[1] - 1, `undefined${comment}`);
	}
};

module.exports = RequireIncludeDependency;
