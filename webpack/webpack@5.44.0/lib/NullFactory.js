"use strict";

const ModuleFactory = require("./ModuleFactory");

// 
class NullFactory extends ModuleFactory {
	create(data, callback) {
		return callback();
	}
}
module.exports = NullFactory;
