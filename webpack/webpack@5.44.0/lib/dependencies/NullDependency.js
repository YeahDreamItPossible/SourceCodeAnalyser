"use strict";

const Dependency = require("../Dependency");
const DependencyTemplate = require("../DependencyTemplate");

// 空依赖
// 作用:
// 该依赖在模块中并不是真实的模块引用 但是在构建过程中需要额外处理的
class NullDependency extends Dependency {
	get type() {
		return "null";
	}
}

NullDependency.Template = class NullDependencyTemplate extends (
	DependencyTemplate
) {
	apply(dependency, source, templateContext) {}
};

module.exports = NullDependency;
