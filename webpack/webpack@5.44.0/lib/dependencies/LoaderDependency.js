"use strict";

const ModuleDependency = require("./ModuleDependency");

// 加载器依赖
// 作用:
// 
class LoaderDependency extends ModuleDependency {
	/**
	 * @param {string} request request string
	 */
	constructor(request) {
		super(request);
	}

	get type() {
		return "loader";
	}

	get category() {
		return "loader";
	}
}

module.exports = LoaderDependency;
