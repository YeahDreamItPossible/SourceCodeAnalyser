"use strict";

/**
 * 语法分析器分类:
 * 
 * JS类型语法分析器(JavascriptParser):
 * 
 * JSON类型语法分析器(JsonParser):
 * 
 * 资源语法分析器(AssetParser):
 * 
 * 源码资源语法分析器(AssetSourceParser):
 * 
 * (WebAssemblyParser):
 * 
 * (WebAssemblyParser):
 */

// 语法解析器
// 作用:
// 
class Parser {
	// 语法解析
	parse(source, state) {
		const AbstractMethodError = require("./AbstractMethodError");
		throw new AbstractMethodError();
	}
}

module.exports = Parser;
