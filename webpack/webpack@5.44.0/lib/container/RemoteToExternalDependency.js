"use strict";

const ModuleDependency = require("../dependencies/ModuleDependency");
const makeSerializable = require("../util/makeSerializable");

// 远程 外部扩展 依赖
class RemoteToExternalDependency extends ModuleDependency {
	constructor(request) {
		super(request);
	}

	get type() {
		return "remote to external";
	}

	get category() {
		return "esm";
	}
}

makeSerializable(
	RemoteToExternalDependency,
	"webpack/lib/container/RemoteToExternalDependency"
);

module.exports = RemoteToExternalDependency;
