"use strict";

const RuntimeGlobals = require("../RuntimeGlobals");
const makeSerializable = require("../util/makeSerializable");
const NullDependency = require("./NullDependency");

// 通过 webpack特有的 require.ensure 语法引入的依赖
// CommonJS 相关
class RequireEnsureDependency extends NullDependency {
	constructor(range, contentRange, errorHandlerRange) {
		super();

		this.range = range;
		this.contentRange = contentRange;
		this.errorHandlerRange = errorHandlerRange;
	}

	get type() {
		return "require.ensure";
	}

	serialize(context) {
		const { write } = context;

		write(this.range);
		write(this.contentRange);
		write(this.errorHandlerRange);

		super.serialize(context);
	}

	deserialize(context) {
		const { read } = context;

		this.range = read();
		this.contentRange = read();
		this.errorHandlerRange = read();

		super.deserialize(context);
	}
}

makeSerializable(
	RequireEnsureDependency,
	"webpack/lib/dependencies/RequireEnsureDependency"
);

RequireEnsureDependency.Template = class RequireEnsureDependencyTemplate extends (
	NullDependency.Template
) {
	apply(
		dependency,
		source,
		{ runtimeTemplate, moduleGraph, chunkGraph, runtimeRequirements }
	) {
		const dep = /** @type {RequireEnsureDependency} */ (dependency);
		const depBlock = /** @type {AsyncDependenciesBlock} */ (
			moduleGraph.getParentBlock(dep)
		);
		const promise = runtimeTemplate.blockPromise({
			chunkGraph,
			block: depBlock,
			message: "require.ensure",
			runtimeRequirements
		});
		const range = dep.range;
		const contentRange = dep.contentRange;
		const errorHandlerRange = dep.errorHandlerRange;
		source.replace(range[0], contentRange[0] - 1, `${promise}.then((`);
		if (errorHandlerRange) {
			source.replace(
				contentRange[1],
				errorHandlerRange[0] - 1,
				").bind(null, __webpack_require__)).catch("
			);
			source.replace(errorHandlerRange[1], range[1] - 1, ")");
		} else {
			source.replace(
				contentRange[1],
				range[1] - 1,
				`).bind(null, __webpack_require__)).catch(${RuntimeGlobals.uncaughtErrorHandler})`
			);
		}
	}
};

module.exports = RequireEnsureDependency;
