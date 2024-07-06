"use strict";

const Dependency = require("../Dependency");
const DependencyTemplate = require("../DependencyTemplate");
const memoize = require("../util/memoize");

const getRawModule = memoize(() => require("../RawModule"));

/**
 * 模块依赖
 * 示例: 
 * import { add } from '../plugins/loaders/first.js?auth=lee!../plugins/loaders/second.js?use=wang!./utils/math.js?ts=12345'
 */
class ModuleDependency extends Dependency {
	constructor(request) {
		super();
		// 内部请求
		// 模块引入路径
		// '../plugins/loaders/first.js?auth=lee!../plugins/loaders/second.js?use=wang!./utils/math.js?ts=12345'
		this.request = request;
		// 用户请求路径
		this.userRequest = request;
		// 范围 [Number, Number]
		this.range = undefined;
	}

	// 获取资源标识符
	getResourceIdentifier() {
		return `module${this.request}`;
	}

	// 返回 RawModule 的实例
	createIgnoredModule(context) {
		const RawModule = getRawModule();
		return new RawModule(
			"/* (ignored) */",
			`ignored|${context}|${this.request}`,
			`${this.request} (ignored)`
		);
	}

	serialize(context) {
		const { write } = context;
		write(this.request);
		write(this.userRequest);
		write(this.range);
		super.serialize(context);
	}

	deserialize(context) {
		const { read } = context;
		this.request = read();
		this.userRequest = read();
		this.range = read();
		super.deserialize(context);
	}
}

ModuleDependency.Template = DependencyTemplate;

module.exports = ModuleDependency;
