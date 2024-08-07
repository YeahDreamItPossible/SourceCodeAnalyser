"use strict";

const Dependency = require("../Dependency");
const makeSerializable = require("../util/makeSerializable");

// 容器入口依赖
// 作用:
// 容器入口依赖 存储着 当前容器编译 的入口 和 导出
class ContainerEntryDependency extends Dependency {
	constructor(name, exposes, shareScope) {
		super();
		// ModuleFederationPlugin.options.name
		this.name = name;
		// ModuleFederationPlugin.options.exposes
		this.exposes = exposes;
		// ModuleFederationPlugin.options.shareScope
		this.shareScope = shareScope;
	}

	getResourceIdentifier() {
		return `container-entry-${this.name}`;
	}

	get type() {
		return "container entry";
	}

	get category() {
		return "esm";
	}
}

makeSerializable(
	ContainerEntryDependency,
	"webpack/lib/container/ContainerEntryDependency"
);

module.exports = ContainerEntryDependency;
