"use strict";

const makeSerializable = require("../util/makeSerializable");
const ContextDependency = require("./ContextDependency");
const ModuleDependencyTemplateAsRequireId = require("./ModuleDependencyTemplateAsRequireId");

// 通过 webpack特有的 require.context 语法引入的依赖
class RequireContextDependency extends ContextDependency {
	constructor(options, range) {
		super(options);

		this.range = range;
	}

	get type() {
		return "require.context";
	}

	serialize(context) {
		const { write } = context;

		write(this.range);

		super.serialize(context);
	}

	deserialize(context) {
		const { read } = context;

		this.range = read();

		super.deserialize(context);
	}
}

makeSerializable(
	RequireContextDependency,
	"webpack/lib/dependencies/RequireContextDependency"
);

RequireContextDependency.Template = ModuleDependencyTemplateAsRequireId;

module.exports = RequireContextDependency;
