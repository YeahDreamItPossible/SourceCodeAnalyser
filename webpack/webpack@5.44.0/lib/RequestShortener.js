"use strict";

const { contextify } = require("./util/identifier");

// 路径缩短器
class RequestShortener {
	constructor(dir, associatedObjectForCache) {
		// 将 给定的路径 转换成相对于给定上下文的 相对路径
		this.contextify = contextify.bindContextCache(
			dir, // Webpack.options.context
			associatedObjectForCache // Compiler示例
		);
	}

	shorten(request) {
		if (!request) {
			return request;
		}
		// 将 用户资源加载路径 转换成相对于给定上下文的 相对路径
		// Loader Path + Module Path 均为相对路径
		return this.contextify(request);
	}
}

module.exports = RequestShortener;
