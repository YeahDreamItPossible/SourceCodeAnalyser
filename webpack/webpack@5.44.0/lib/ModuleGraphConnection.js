"use strict";

/** @typedef {import("./Dependency")} Dependency */
/** @typedef {import("./Module")} Module */
/** @typedef {import("./util/runtime").RuntimeSpec} RuntimeSpec */

/**
 * Module itself is not connected, but transitive modules are connected transitively.
 */
const TRANSITIVE_ONLY = Symbol("transitive only");

/**
 * While determining the active state, this flag is used to signal a circular connection.
 */
const CIRCULAR_CONNECTION = Symbol("circular connection");

/** @typedef {boolean | typeof TRANSITIVE_ONLY | typeof CIRCULAR_CONNECTION} ConnectionState */

/**
 * @param {ConnectionState} a first
 * @param {ConnectionState} b second
 * @returns {ConnectionState} merged
 */
const addConnectionStates = (a, b) => {
	if (a === true || b === true) return true;
	if (a === false) return b;
	if (b === false) return a;
	if (a === TRANSITIVE_ONLY) return b;
	if (b === TRANSITIVE_ONLY) return a;
	return a;
};

/**
 * @param {ConnectionState} a first
 * @param {ConnectionState} b second
 * @returns {ConnectionState} intersected
 */
const intersectConnectionStates = (a, b) => {
	if (a === false || b === false) return false;
	if (a === true) return b;
	if (b === true) return a;
	if (a === CIRCULAR_CONNECTION) return b;
	if (b === CIRCULAR_CONNECTION) return a;
	return a;
};

/**
 * 描述当前模块的引用关系(通过 Dependency 来获取对应的 Module 和 父Module)
 * Dependency 与 Module 的引用关系(当前依赖Dependency 与 引用当前依赖Dependency的Module)
 * Module 与 Module 的引用关系(使用当前依赖的Module 与 引用 使用当前依赖的Module 的父Module)
 * 
 */
class ModuleGraphConnection {
	constructor(
		originModule,
		dependency,
		module,
		explanation,
		weak = false,
		condition = undefined
	) {
		// 引用 当前Module 的 父Module
		this.originModule = originModule;
		// 引用 当前Module 的 父Module(该父Module已经被加工过)
		this.resolvedOriginModule = originModule;

		// 当前依赖Dependency
		this.dependency = dependency;

		// 当前Module(已经被加工过)
		this.resolvedModule = module;
		// 当前Module
		this.module = module;

		this.weak = weak;
		this.conditional = !!condition;
		this._active = condition !== false;
		/** @type {function(ModuleGraphConnection, RuntimeSpec): ConnectionState} */
		this.condition = condition || undefined;
		/** @type {Set<string>} */
		this.explanations = undefined;
		if (explanation) {
			this.explanations = new Set();
			this.explanations.add(explanation);
		}
	}

	// 克隆
	clone() {
		const clone = new ModuleGraphConnection(
			this.resolvedOriginModule,
			this.dependency,
			this.resolvedModule,
			undefined,
			this.weak,
			this.condition
		);
		clone.originModule = this.originModule;
		clone.module = this.module;
		clone.conditional = this.conditional;
		clone._active = this._active;
		if (this.explanations) clone.explanations = new Set(this.explanations);
		return clone;
	}

	/**
	 * @param {function(ModuleGraphConnection, RuntimeSpec): ConnectionState} condition condition for the connection
	 * @returns {void}
	 */
	addCondition(condition) {
		if (this.conditional) {
			const old = this.condition;
			this.condition = (c, r) =>
				intersectConnectionStates(old(c, r), condition(c, r));
		} else if (this._active) {
			this.conditional = true;
			this.condition = condition;
		}
	}

	// 添加解释(explanation: String)
	addExplanation(explanation) {
		if (this.explanations === undefined) {
			this.explanations = new Set();
		}
		this.explanations.add(explanation);
	}

	// 返回序列化后的解释
	get explanation() {
		if (this.explanations === undefined) return "";
		return Array.from(this.explanations).join(" ");
	}

	// TODO webpack 5 remove
	get active() {
		throw new Error("Use getActiveState instead");
	}

	/**
	 * @param {RuntimeSpec} runtime the runtime
	 * @returns {boolean} true, if the connection is active
	 */
	isActive(runtime) {
		if (!this.conditional) return this._active;
		return this.condition(this, runtime) !== false;
	}

	/**
	 * @param {RuntimeSpec} runtime the runtime
	 * @returns {boolean} true, if the connection is active
	 */
	isTargetActive(runtime) {
		if (!this.conditional) return this._active;
		return this.condition(this, runtime) === true;
	}

	/**
	 * @param {RuntimeSpec} runtime the runtime
	 * @returns {ConnectionState} true: fully active, false: inactive, TRANSITIVE: direct module inactive, but transitive connection maybe active
	 */
	getActiveState(runtime) {
		if (!this.conditional) return this._active;
		return this.condition(this, runtime);
	}

	/**
	 * @param {boolean} value active or not
	 * @returns {void}
	 */
	setActive(value) {
		this.conditional = false;
		this._active = value;
	}

	set active(value) {
		throw new Error("Use setActive instead");
	}
}

/** @typedef {typeof TRANSITIVE_ONLY} TRANSITIVE_ONLY */
/** @typedef {typeof CIRCULAR_CONNECTION} CIRCULAR_CONNECTION */

module.exports = ModuleGraphConnection;
module.exports.addConnectionStates = addConnectionStates;
module.exports.TRANSITIVE_ONLY = /** @type {typeof TRANSITIVE_ONLY} */ (
	TRANSITIVE_ONLY
);
module.exports.CIRCULAR_CONNECTION = /** @type {typeof CIRCULAR_CONNECTION} */ (
	CIRCULAR_CONNECTION
);
