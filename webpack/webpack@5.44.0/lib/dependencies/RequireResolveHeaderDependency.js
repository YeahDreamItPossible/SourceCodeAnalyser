"use strict";

const makeSerializable = require("../util/makeSerializable");
const NullDependency = require("./NullDependency");

// TODO:
// CommonJS 相关
class RequireResolveHeaderDependency extends NullDependency {
	constructor(range) {
		super();

		if (!Array.isArray(range)) throw new Error("range must be valid");

		this.range = range;
	}

	serialize(context) {
		const { write } = context;

		write(this.range);

		super.serialize(context);
	}

	static deserialize(context) {
		const obj = new RequireResolveHeaderDependency(context.read());
		obj.deserialize(context);
		return obj;
	}
}

makeSerializable(
	RequireResolveHeaderDependency,
	"webpack/lib/dependencies/RequireResolveHeaderDependency"
);

RequireResolveHeaderDependency.Template = class RequireResolveHeaderDependencyTemplate extends (
	NullDependency.Template
) {
	apply(dependency, source, templateContext) {
		const dep = /** @type {RequireResolveHeaderDependency} */ (dependency);
		source.replace(dep.range[0], dep.range[1] - 1, "/*require.resolve*/");
	}

	applyAsTemplateArgument(name, dep, source) {
		source.replace(dep.range[0], dep.range[1] - 1, "/*require.resolve*/");
	}
};

module.exports = RequireResolveHeaderDependency;
