/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/

"use strict";

const makeSerializable = require("../util/makeSerializable");
const NullDependency = require("./NullDependency");

/** @typedef {import("webpack-sources").ReplaceSource} ReplaceSource */
/** @typedef {import("../Dependency")} Dependency */
/** @typedef {import("../DependencyTemplate").DependencyTemplateContext} DependencyTemplateContext */

// TODO:
// AMD 相关
class UnsupportedDependency extends NullDependency {
	constructor(request, range) {
		super();

		this.request = request;
		this.range = range;
	}

	serialize(context) {
		const { write } = context;

		write(this.request);
		write(this.range);

		super.serialize(context);
	}

	deserialize(context) {
		const { read } = context;

		this.request = read();
		this.range = read();

		super.deserialize(context);
	}
}

makeSerializable(
	UnsupportedDependency,
	"webpack/lib/dependencies/UnsupportedDependency"
);

UnsupportedDependency.Template = class UnsupportedDependencyTemplate extends (
	NullDependency.Template
) {
	apply(dependency, source, { runtimeTemplate }) {
		const dep = /** @type {UnsupportedDependency} */ (dependency);

		source.replace(
			dep.range[0],
			dep.range[1],
			runtimeTemplate.missingModule({
				request: dep.request
			})
		);
	}
};

module.exports = UnsupportedDependency;
