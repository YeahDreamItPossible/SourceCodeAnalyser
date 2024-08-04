"use strict";

const ModuleFactory = require("./ModuleFactory");

// 忽略错误模块工厂
// 作用:
// 当在 创建标准模块 时 忽略报错 仍然返回 标准模块 的实例 
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
