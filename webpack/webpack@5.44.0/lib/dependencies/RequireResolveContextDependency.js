"use strict";

const makeSerializable = require("../util/makeSerializable");
const ContextDependency = require("./ContextDependency");
const ContextDependencyTemplateAsId = require("./ContextDependencyTemplateAsId");

// TODO:
// AMD 相关
class RequireResolveContextDependency extends ContextDependency {
	constructor(options, range, valueRange) {
		super(options);

		this.range = range;
		this.valueRange = valueRange;
	}

	get type() {
		return "amd require context";
	}

	serialize(context) {
		const { write } = context;

		write(this.range);
		write(this.valueRange);

		super.serialize(context);
	}

	deserialize(context) {
		const { read } = context;

		this.range = read();
		this.valueRange = read();

		super.deserialize(context);
	}
}

makeSerializable(
	RequireResolveContextDependency,
	"webpack/lib/dependencies/RequireResolveContextDependency"
);

RequireResolveContextDependency.Template = ContextDependencyTemplateAsId;

module.exports = RequireResolveContextDependency;
