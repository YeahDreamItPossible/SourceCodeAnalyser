"use strict";

/**
 * 根据以下条件(condition)编译成对应的匹配规则条件
 * 匹配规则: { property: String, matchWhenEmpty: Boolean || Function, fn: Function}
 * 条件condition:
 * Webpack.options.Module.Rule.test 
 * Webpack.options.Module.Rule.schema
 * Webpack.options.Module.Rule.mimetype
 * Webpack.options.Module.Rule.dependency
 * Webpack.options.Module.Rule.include
 * Webpack.options.Module.Rule.exclude
 * Webpack.options.Module.Rule.resouce
 * Webpack.options.Module.Rule.resourceQuery
 * Webpack.options.Module.Rule.resourceFragment
 * Webpack.options.Module.Rule.realResource
 * Webpack.options.Module.Rule.issuer
 * Webpack.options.Module.Rule.compiler
 * Webpack.options.Module.Rule.issuerLayer
 */

// 基础规则匹配器插件
// 作用:
// 
class BasicMatcherRulePlugin {
	constructor(ruleProperty, dataProperty, invert) {
		// 规则属性:
		this.ruleProperty = ruleProperty;
		// 数据属性:
		this.dataProperty = dataProperty || ruleProperty;
		// 标识: 是否对满足匹配规则取反
		this.invert = invert || false;
	}

	apply(ruleSetCompiler) {
		ruleSetCompiler.hooks.rule.tap(
			"BasicMatcherRulePlugin",
			(path, rule, unhandledProperties, result) => {
				if (unhandledProperties.has(this.ruleProperty)) {
					// 防止某条Rule的属性被重复解析
					unhandledProperties.delete(this.ruleProperty);
					
					const value = rule[this.ruleProperty];
					const condition = ruleSetCompiler.compileCondition(
						// 例如: ruleSet[0].rules[0].test
						`${path}.${this.ruleProperty}`,
						value
					);
					const fn = condition.fn;
					result.conditions.push({
						// 字段名
						property: this.dataProperty,
						// 该字段是否需要匹配
						matchWhenEmpty: this.invert
							? !condition.matchWhenEmpty
							: condition.matchWhenEmpty,
						// 该字段匹配函数
						fn: this.invert ? v => !fn(v) : fn
					});
				}
			}
		);
	}
}

module.exports = BasicMatcherRulePlugin;
