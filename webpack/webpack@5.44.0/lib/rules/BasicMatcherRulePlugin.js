"use strict";

/**
 * 根据以下条件(condition)编译成对应的匹配规则条件
 * 匹配规则: { property: String, matchWhenEmpty: Boolean || Function, fn: Function}
 * 条件condition:
 * Webpack.Config.Module.Rule.test 
 * Webpack.Config.Module.Rule.schema
 * Webpack.Config.Module.Rule.mimetype
 * Webpack.Config.Module.Rule.dependency
 * Webpack.Config.Module.Rule.include
 * Webpack.Config.Module.Rule.exclude
 * Webpack.Config.Module.Rule.resouce
 * Webpack.Config.Module.Rule.resourceQuery
 * Webpack.Config.Module.Rule.resourceFragment
 * Webpack.Config.Module.Rule.realResource
 * Webpack.Config.Module.Rule.issuer
 * Webpack.Config.Module.Rule.compiler
 * Webpack.Config.Module.Rule.issuerLayer
 */
class BasicMatcherRulePlugin {
	constructor(ruleProperty, dataProperty, invert) {
		// 规则属性
		this.ruleProperty = ruleProperty;
		// 
		this.dataProperty = dataProperty || ruleProperty;
		// 是否对满足匹配规则取反
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
