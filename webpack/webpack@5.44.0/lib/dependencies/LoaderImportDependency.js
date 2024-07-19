"use strict";

const ModuleDependency = require("./ModuleDependency");

// 加载器导入依赖
// 作用:
// 
class LoaderImportDependency extends ModuleDependency {
	constructor(request) {
		super(request);
		this.weak = true;
	}

	get type() {
		return "loader import";
	}

	get category() {
		return "loaderImport";
	}
}

module.exports = LoaderImportDependency;
