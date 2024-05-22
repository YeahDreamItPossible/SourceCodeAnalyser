"use strict";

const Dependency = require("../Dependency");
const DependencyTemplate = require("../DependencyTemplate");
const memoize = require("../util/memoize");

/** @typedef {import("../Module")} Module */

const getRawModule = memoize(() => require("../RawModule"));

/**
 * 模块依赖
 * 示例: 
 * import { add } from '../plugins/loaders/first.js?auth=lee!../plugins/loaders/second.js?use=wang!./utils/math.js?ts=12345'
 */
class ModuleDependency extends Dependency {
	/**
	 * @param {string} request request path which needs resolving
	 */
	constructor(request) {
		super();
		// 模块路径
		// 示例:
		// '../plugins/loaders/first.js?auth=lee!../plugins/loaders/second.js?use=wang!./utils/math.js?ts=12345'
		this.request = request;
		this.userRequest = request;
		// 范围
		this.range = undefined;
	}

	/**
	 * @returns {string | null} an identifier to merge equal requests
	 */
	getResourceIdentifier() {
		return `module${this.request}`;
	}

	/**
	 * @param {string} context context directory
	 * @returns {Module} a module
	 */
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
