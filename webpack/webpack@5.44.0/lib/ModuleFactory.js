"use strict";

// 模块工厂
class ModuleFactory {
	// 创建 Module 的示例
	create(data, callback) {
		const AbstractMethodError = require("./AbstractMethodError");
		throw new AbstractMethodError();
	}
}

module.exports = ModuleFactory;
