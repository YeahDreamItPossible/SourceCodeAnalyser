"use strict";

const DllModule = require("./DllModule");
const ModuleFactory = require("./ModuleFactory");

// 动态链接库 模块工厂
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
