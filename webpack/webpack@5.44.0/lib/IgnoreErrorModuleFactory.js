"use strict";

const ModuleFactory = require("./ModuleFactory");

// 模块未解析时忽略错误
class IgnoreErrorModuleFactory extends ModuleFactory {
	constructor(normalModuleFactory) {
		super();
		this.normalModuleFactory = normalModuleFactory;
	}

	create(data, callback) {
		this.normalModuleFactory.create(data, (err, result) => {
			return callback(null, result);
		});
	}
}

module.exports = IgnoreErrorModuleFactory;
