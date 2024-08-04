"use strict";

const Dependency = require("../Dependency");
const makeSerializable = require("../util/makeSerializable");

// 动态链接库入口依赖
// 作用:
// 标识该依赖是动态链接库构建入口
class DllEntryDependency extends Dependency {
	constructor(dependencies, name) {
		super();

		this.dependencies = dependencies;
		this.name = name;
	}

	get type() {
		return "dll entry";
	}

	serialize(context) {
		const { write } = context;

		write(this.dependencies);
		write(this.name);

		super.serialize(context);
	}

	deserialize(context) {
		const { read } = context;

		this.dependencies = read();
		this.name = read();

		super.deserialize(context);
	}
}

makeSerializable(
	DllEntryDependency,
	"webpack/lib/dependencies/DllEntryDependency"
);

module.exports = DllEntryDependency;
