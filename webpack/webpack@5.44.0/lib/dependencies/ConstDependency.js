"use strict";

const makeSerializable = require("../util/makeSerializable");
const NullDependency = require("./NullDependency");

// 常量依赖
// 作用: 在源代码中 替换掉固定位置的字符串 或者 在特定位置插入字符串
// 使用场景: DefinePlugin NodeStuffPlugin
class ConstDependency extends NullDependency {
	constructor(expression, range, runtimeRequirements) {
		super();
		// 常量表达式
		this.expression = expression;
		// [Number, Number]
		this.range = range;
		// Set<String>
		this.runtimeRequirements = runtimeRequirements
			? new Set(runtimeRequirements)
			: null;
	}

	// 更新hash
	updateHash(hash, context) {
		hash.update(this.range + "");
		hash.update(this.expression + "");
		if (this.runtimeRequirements)
			hash.update(Array.from(this.runtimeRequirements).join() + "");
	}

	/**
	 * @param {ModuleGraph} moduleGraph the module graph
	 * @returns {ConnectionState} how this dependency connects the module to referencing modules
	 */
	getModuleEvaluationSideEffectsState(moduleGraph) {
		return false;
	}

	serialize(context) {
		const { write } = context;
		write(this.expression);
		write(this.range);
		write(this.runtimeRequirements);
		super.serialize(context);
	}

	deserialize(context) {
		const { read } = context;
		this.expression = read();
		this.range = read();
		this.runtimeRequirements = read();
		super.deserialize(context);
	}
}

makeSerializable(ConstDependency, "webpack/lib/dependencies/ConstDependency");

ConstDependency.Template = class ConstDependencyTemplate extends (
	NullDependency.Template
) {
	apply(dependency, source, templateContext) {
		const dep = /** @type {ConstDependency} */ (dependency);
		if (dep.runtimeRequirements) {
			for (const req of dep.runtimeRequirements) {
				templateContext.runtimeRequirements.add(req);
			}
		}
		if (typeof dep.range === "number") {
			source.insert(dep.range, dep.expression);
			return;
		}

		source.replace(dep.range[0], dep.range[1] - 1, dep.expression);
	}
};

module.exports = ConstDependency;
