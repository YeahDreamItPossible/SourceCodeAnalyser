"use strict";

const ModuleFactory = require("../ModuleFactory");
const ContainerEntryModule = require("./ContainerEntryModule");

// 容器入口模块工厂
// 作用:
// 创建 容器入口模块
module.exports = class ContainerEntryModuleFactory extends ModuleFactory {
	create({ dependencies: [dependency] }, callback) {
		const dep = /** @type {ContainerEntryDependency} */ (dependency);
		callback(null, {
			module: new ContainerEntryModule(dep.name, dep.exposes, dep.shareScope)
		});
	}
};
