"use strict";

const ModuleFactory = require("../ModuleFactory");
const FallbackModule = require("./FallbackModule");

/** @typedef {import("../ModuleFactory").ModuleFactoryCreateData} ModuleFactoryCreateData */
/** @typedef {import("../ModuleFactory").ModuleFactoryResult} ModuleFactoryResult */
/** @typedef {import("./FallbackDependency")} FallbackDependency */

// 回退模块工厂
module.exports = class FallbackModuleFactory extends ModuleFactory {
	/**
	 * @param {ModuleFactoryCreateData} data data object
	 * @param {function(Error=, ModuleFactoryResult=): void} callback callback
	 * @returns {void}
	 */
	create({ dependencies: [dependency] }, callback) {
		const dep = /** @type {FallbackDependency} */ (dependency);
		callback(null, {
			module: new FallbackModule(dep.requests)
		});
	}
};
