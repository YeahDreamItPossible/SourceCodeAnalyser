"use strict";

const ModuleFactory = require("../ModuleFactory");
const FallbackModule = require("./FallbackModule");

// 回退模块工厂
module.exports = class FallbackModuleFactory extends ModuleFactory {
	create({ dependencies: [dependency] }, callback) {
		const dep = /** @type {FallbackDependency} */ (dependency);
		callback(null, {
			module: new FallbackModule(dep.requests)
		});
	}
};
