"use strict";

const DllModule = require("./DllModule");
const ModuleFactory = require("./ModuleFactory");

// 动态链接库模块工厂
// 作用:
// 创建 动态链接库模块 的实例
class DllModuleFactory extends ModuleFactory {
	constructor() {
		super();
		this.hooks = Object.freeze({});
	}
	
	create(data, callback) {
		const dependency = /** @type {DllEntryDependency} */ (data.dependencies[0]);
		callback(null, {
			module: new DllModule(
				data.context,
				dependency.dependencies,
				dependency.name
			)
		});
	}
}

module.exports = DllModuleFactory;
