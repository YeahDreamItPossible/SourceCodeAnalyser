"use strict";

const memoize = require("./util/memoize");

const getIgnoredModule = memoize(() => {
	const RawModule = require("./RawModule");
	return new RawModule("/* (ignored) */", `ignored`, `(ignored)`);
});

// 依赖: 用来描述 当前引用依赖 的位置信息 和 引用模块信息
class Dependency {
	constructor() {
		// 引用当前依赖的 模块
		this._parentModule = undefined;
		// 引用当前依赖的 依赖块
		this._parentDependenciesBlock = undefined;
		// 标识: 当前依赖 是否是弱的
		// 弱依赖 意味着这个依赖 对于模块的运行不是必须的
		// 即使这个依赖不存在 模块也能以某种降级模式运行
		this.weak = false;
		// 标识: 当前依赖 是否是可选的
		// 与弱依赖类似 可选依赖也不是模块运行所必需的
		// 可选依赖通常有一个更具体的含义 即当这个依赖不存在时
		// 模块应该能够优雅地处理这种情况 而不是简单地失败
		this.optional = false;
		// 位置信息
		// 起始行 SL(start line) 
		this._locSL = 0;
		// 起始列 SC(start column) 
		this._locSC = 0;
		// 结束行 EL(end line) 
		this._locEL = 0;
		// 结束列 EC(end column) 
		this._locEC = 0;
		// 索引(Index)
		this._locI = undefined;
		// 名(Name)
		this._locN = undefined;
		// 位置信息对象(Location)
		this._loc = undefined;
	}

	// 返回 Dependency 的类型
	// javacript/auto javascript/dynamic 
	get type() {
		return "unknown";
	}

	// 返回 Dependency 的分类
	// commonjs | amd | esm | self
	get category() {
		return "unknown";
	}

	// 返回 位置信息
	get loc() {
		if (this._loc !== undefined) return this._loc;
		/** @type {SyntheticDependencyLocation & RealDependencyLocation} */
		const loc = {};
		if (this._locSL > 0) {
			loc.start = { line: this._locSL, column: this._locSC };
		}
		if (this._locEL > 0) {
			loc.end = { line: this._locEL, column: this._locEC };
		}
		if (this._locN !== undefined) {
			loc.name = this._locN;
		}
		if (this._locI !== undefined) {
			loc.index = this._locI;
		}
		return (this._loc = loc);
	}

	// 设置 位置信息
	set loc(loc) {
		if ("start" in loc && typeof loc.start === "object") {
			this._locSL = loc.start.line || 0;
			this._locSC = loc.start.column || 0;
		} else {
			this._locSL = 0;
			this._locSC = 0;
		}
		if ("end" in loc && typeof loc.end === "object") {
			this._locEL = loc.end.line || 0;
			this._locEC = loc.end.column || 0;
		} else {
			this._locEL = 0;
			this._locEC = 0;
		}
		if ("index" in loc) {
			this._locI = loc.index;
		} else {
			this._locI = undefined;
		}
		if ("name" in loc) {
			this._locN = loc.name;
		} else {
			this._locN = undefined;
		}
		this._loc = loc;
	}

	// 获取资源标识符
	getResourceIdentifier() {
		return null;
	}

	// Dependency.prototype.getReference 已被 Dependency.prototype.getReferencedExports 替代
	getReference(moduleGraph) {
		throw new Error(
			"Dependency.getReference was removed in favor of Dependency.getReferencedExports, ModuleGraph.getModule and ModuleGraph.getConnection().active"
		);
	}

	// 返回关联输出
	getReferencedExports(moduleGraph, runtime) {
		return Dependency.EXPORTS_OBJECT_REFERENCED;
	}

	// 返回条件
	getCondition(moduleGraph) {
		return null;
	}

	// 返回 导出的 names
	getExports(moduleGraph) {
		return undefined;
	}

	// 返回所有的警告 Array<WebpackError>
	getWarnings(moduleGraph) {
		return null;
	}

	// 返回所有的错误 Array<WebpackError>
	getErrors(moduleGraph) {
		return null;
	}

	// 更新hash
	updateHash(hash, context) {}

	// 返回 此依赖中 id 的使用频率
	getNumberOfIdOccurrences() {
		return 1;
	}

	// 此依赖如何关联模块
	getModuleEvaluationSideEffectsState(moduleGraph) {
		return true;
	}

	// 返回 RawModule 的实例
	createIgnoredModule(context) {
		return getIgnoredModule();
	}

	// 序列化
	serialize({ write }) {
		write(this.weak);
		write(this.optional);
		write(this._locSL);
		write(this._locSC);
		write(this._locEL);
		write(this._locEC);
		write(this._locI);
		write(this._locN);
	}

	// 反序列化
	deserialize({ read }) {
		this.weak = read();
		this.optional = read();
		this._locSL = read();
		this._locSC = read();
		this._locEL = read();
		this._locEC = read();
		this._locI = read();
		this._locN = read();
	}
}

// Array<Array<String>>
Dependency.NO_EXPORTS_REFERENCED = [];
// Array<Array<String>>
Dependency.EXPORTS_OBJECT_REFERENCED = [[]];

// Dependency.prototype.module 已被Compilation.ModuleGraph.getModule(Dependency) 替代
Object.defineProperty(Dependency.prototype, "module", {
	/**
	 * @deprecated
	 * @returns {never} throws
	 */
	get() {
		throw new Error(
			"module property was removed from Dependency (use compilation.moduleGraph.getModule(dependency) instead)"
		);
	},

	/**
	 * @deprecated
	 * @returns {never} throws
	 */
	set() {
		throw new Error(
			"module property was removed from Dependency (use compilation.moduleGraph.updateModule(dependency, module) instead)"
		);
	}
});
// Dependency.prototype.disconnect 移除 不再支持
Object.defineProperty(Dependency.prototype, "disconnect", {
	get() {
		throw new Error(
			"disconnect was removed from Dependency (Dependency no longer carries graph specific information)"
		);
	}
});

module.exports = Dependency;
