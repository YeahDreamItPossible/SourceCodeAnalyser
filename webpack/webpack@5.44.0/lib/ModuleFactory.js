"use strict";

// 模块工厂
// 作用:
// 创建对应的 模块 实例
class ModuleFactory {
	// 创建 Module 的实例
	create(data, callback) {
		const AbstractMethodError = require("./AbstractMethodError");
		throw new AbstractMethodError();
	}
}

module.exports = ModuleFactory;
