"use strict";

const { contextify } = require("./util/identifier");

// 路径缩短器
// 作用:
// 根据 上下文路径 将 用户资源请求路径 转换成 相对于上下文路径的相对路径
// 用户资源请求路径 = 加载器请求路径 + 模块请求路径
class RequestShortener {
	constructor(dir, associatedObjectForCache) {
		// 将 给定的路径 转换成相对于给定上下文的 相对路径
		this.contextify = contextify.bindContextCache(
			dir, // Webpack.options.context
			associatedObjectForCache // compiler
		);
	}

	shorten(request) {
		if (!request) {
			return request;
		}
		// 根据 上下文路径 将 用户资源请求路径 转换成 相对于上下文路径的相对路径
		// 用户资源请求路径 = 加载器请求路径 + 模块请求路径
		return this.contextify(request);
	}
}

module.exports = RequestShortener;
