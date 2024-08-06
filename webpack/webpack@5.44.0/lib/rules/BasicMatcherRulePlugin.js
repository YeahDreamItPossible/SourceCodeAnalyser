"use strict";

/**
 * 规则属性 枚举:
 * Webpack.options.Module.Rule.test ( => Webpack.options.Module.Rule.resource )
 * Webpack.options.Module.Rule.schema
 * Webpack.options.Module.Rule.mimetype
 * Webpack.options.Module.Rule.dependency
 * Webpack.options.Module.Rule.include ( => Webpack.options.Module.Rule.resource )
 * Webpack.options.Module.Rule.exclude ( => Webpack.options.Module.Rule.resource )
 * Webpack.options.Module.Rule.resouce
 * Webpack.options.Module.Rule.resourceQuery
 * Webpack.options.Module.Rule.resourceFragment
 * Webpack.options.Module.Rule.realResource
 * Webpack.options.Module.Rule.issuer
 * Webpack.options.Module.Rule.compiler
 * Webpack.options.Module.Rule.issuerLayer
 */

/**
 * 数据属性 枚举:
 * ...规则属性枚举
 * Webpack.options.Module.Rule.resource
 */

// 基础规则匹配器插件
// 作用:
// 创建 某个规则属性 的条件匹配(通过 规则属性 对 某个数据属性 进行条件匹配)
class BasicMatcherRulePlugin {
	constructor(ruleProperty, dataProperty, invert) {
		// 规则属性: 标识 当前匹配规则 的匹配路径
		this.ruleProperty = ruleProperty;
		// 数据属性: 
		this.dataProperty = dataProperty || ruleProperty;
		// 标识: 是否对 满足匹配规则 取反
		this.invert = invert || false;
	}

	apply(ruleSetCompiler) {
		ruleSetCompiler.hooks.rule.tap(
			"BasicMatcherRulePlugin",
			(path, rule, unhandledProperties, result) => {
				if (unhandledProperties.has(this.ruleProperty)) {
					// 删除 某个规则 防止被重复编译
					unhandledProperties.delete(this.ruleProperty);
					
					// Webpack.options.module.rules.test 对应的值
					const value = rule[this.ruleProperty];
					// 
					const condition = ruleSetCompiler.compileCondition(
						// 路径示例: ruleSet[0].rules[0].test
						`${path}.${this.ruleProperty}`,
						// 值示例: Webpack.options.module.rules.test 对应的值
						value
					);
					const fn = condition.fn;
					result.conditions.push({
						// 匹配字段名
						property: this.dataProperty,
						// 当 字段为空 时 是否还要进行匹配
						matchWhenEmpty: this.invert
							? !condition.matchWhenEmpty
							: condition.matchWhenEmpty,
						// 匹配函数
						fn: this.invert ? v => !fn(v) : fn
					});
				}
			}
		);
	}
}

module.exports = BasicMatcherRulePlugin;
