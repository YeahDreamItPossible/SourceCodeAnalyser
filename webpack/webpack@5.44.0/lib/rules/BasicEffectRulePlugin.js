"use strict";

/**
 * 根据以下条件(condition)编译成对应的匹配规则副作用
 * 匹配规则: { type: String, value: String || Function || RegExp || Array }
 * 条件condition:
 * Webpack.options.Module.Rule.type
 * Webpack.options.Module.Rule.sideEffects
 * Webpack.options.Module.Rule.parser
 * Webpack.options.Module.Rule.resolve
 * Webpack.options.Module.Rule.generator
 * Webpack.options.Module.Rule.layer
 */
class BasicEffectRulePlugin {
	constructor(ruleProperty, effectType) {
		// 规则属性
		this.ruleProperty = ruleProperty;
		this.effectType = effectType || ruleProperty;
	}

	apply(ruleSetCompiler) {
		ruleSetCompiler.hooks.rule.tap(
			"BasicEffectRulePlugin",
			(path, rule, unhandledProperties, result, references) => {
				if (unhandledProperties.has(this.ruleProperty)) {
					unhandledProperties.delete(this.ruleProperty);

					const value = rule[this.ruleProperty];

					result.effects.push({
						type: this.effectType,
						value
					});
				}
			}
		);
	}
}

module.exports = BasicEffectRulePlugin;
