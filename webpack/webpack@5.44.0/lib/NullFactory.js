"use strict";

const ModuleFactory = require("./ModuleFactory");

// 空工厂:
// 作用:
// 
class NullFactory extends ModuleFactory {
	create(data, callback) {
		return callback();
	}
}
module.exports = NullFactory;
