"use strict";

// 基类
class ModuleFactory {
	// 抽象方法
	create(data, callback) {
		const AbstractMethodError = require("./AbstractMethodError");
		throw new AbstractMethodError();
	}
}

module.exports = ModuleFactory;
