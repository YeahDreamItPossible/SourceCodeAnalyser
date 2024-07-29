"use strict";

// 模块本身没有连接，但传递模块是传递连接的
const TRANSITIVE_ONLY = Symbol("transitive only");

// 在确定活动状态时，此标志用于表示循环连接。
const CIRCULAR_CONNECTION = Symbol("circular connection");

/**
 * ConnectionState(连接状态):
 * Boolean
 * TRANSITIVE_ONLY
 * CIRCULAR_CONNECTION
 */

// 合并 连接状态
const addConnectionStates = (a, b) => {
	// 只要有 一个链接 
	if (a === true || b === true) return true;
	if (a === false) return b;
	if (b === false) return a;
	if (a === TRANSITIVE_ONLY) return b;
	if (b === TRANSITIVE_ONLY) return a;
	return a;
};

// 相交 连接状态
const intersectConnectionStates = (a, b) => {
	if (a === false || b === false) return false;
	if (a === true) return b;
	if (b === true) return a;
	if (a === CIRCULAR_CONNECTION) return b;
	if (b === CIRCULAR_CONNECTION) return a;
	return a;
};

/**
 * 模块图连接
 * 作用:
 * 以 依赖 为核心 描述当前依赖的引用关系
 * 1. 当前依赖Dependency 与 引用当前依赖的模块Module 的引用关系
 * 2. 引用当前依赖的模块Module 与 引用当前依赖的模块的父模块Module 的引用关系
 * 在 ModuleGraph 中 通过 Dependency 找到对应的 ModuleGraphConnection
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
		// 当前依赖
		this.dependency = dependency;
		// 引用当前依赖的模块(已经被加工过)
		this.resolvedModule = module;
		// 引用当前依赖的模块
		this.module = module;
		// 引用 当前模块 的 父模块
		this.originModule = originModule;
		// 引用 当前模块 的 父模块(该父模块已经被加工过)
		this.resolvedOriginModule = originModule;
		// 标识: 当前连接 是否是可选的
		// 根据 dep.weak 决定
		this.weak = weak;
		// 标识: 当前连接 是否激活(当前依赖 与 当前模块 是否存在引用关系)
		this._active = condition !== false;
		// 标识: 当前连接 是否是可选的
		// 根据 dep.condition  决定
		this.conditional = !!condition;
		// 条件(判断当前连接是否是激活的)
		// 根据 dep.getCondition 决定
		this.condition = condition || undefined;
		// 解释(为什么关联的解释)
		this.explanations = undefined;
		if (explanation) {
			this.explanations = new Set();
			this.explanations.add(explanation);
		}
	}

	// 返回 克隆的 ModuleGraphConnection
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

	// 添加条件
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

	// 添加解释
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

	// ModuleGraphConnection.prototype.active 属性被已被 ModuleGraphConnection.prototype.getActiveState 替代
	get active() {
		throw new Error("Use getActiveState instead");
	}

	// 返回 当前Connection 是否是激活的
	isActive(runtime) {
		if (!this.conditional) return this._active;
		return this.condition(this, runtime) !== false;
	}

	// 返回 当前Connection 是否是激活的
	isTargetActive(runtime) {
		if (!this.conditional) return this._active;
		return this.condition(this, runtime) === true;
	}

	// 返回当前Connection 是否激活
	getActiveState(runtime) {
		// 当当前 Connection 是
		if (!this.conditional) return this._active;
		return this.condition(this, runtime);
	}

	// 设置当前 Connection 是否激活
	setActive(value) {
		this.conditional = false;
		this._active = value;
	}

	// ModuleGraphConnection.prototype.active 属性已被 ModuleGraphConnection.prototype.setActive 替代
	set active(value) {
		throw new Error("Use setActive instead");
	}
}

module.exports = ModuleGraphConnection;
module.exports.addConnectionStates = addConnectionStates;
module.exports.TRANSITIVE_ONLY = (
	TRANSITIVE_ONLY
);
module.exports.CIRCULAR_CONNECTION = (
	CIRCULAR_CONNECTION
);
