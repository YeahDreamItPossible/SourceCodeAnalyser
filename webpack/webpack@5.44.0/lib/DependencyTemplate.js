"use strict";

// 模板基类
// 依赖模板
class DependencyTemplate {
	apply(dependency, source, templateContext) {
		const AbstractMethodError = require("./AbstractMethodError");
		throw new AbstractMethodError();
	}
}

module.exports = DependencyTemplate;
