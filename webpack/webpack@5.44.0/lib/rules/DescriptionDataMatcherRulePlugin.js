"use strict";

const RULE_PROPERTY = "descriptionData";

/**
 * 根据条件(condition.descriptionData)编译成对应的匹配规则条件
 * 匹配规则: { property: String, matchWhenEmpty: Boolean || Function, fn: Function}\
 */
class DescriptionDataMatcherRulePlugin {
	apply(ruleSetCompiler) {
		ruleSetCompiler.hooks.rule.tap(
			"DescriptionDataMatcherRulePlugin",
			(path, rule, unhandledProperties, result) => {
				if (unhandledProperties.has(RULE_PROPERTY)) {
					unhandledProperties.delete(RULE_PROPERTY);
					const value = rule[RULE_PROPERTY];
					for (const property of Object.keys(value)) {
						const dataProperty = property.split(".");
						const condition = ruleSetCompiler.compileCondition(
							`${path}.${RULE_PROPERTY}.${property}`,
							value[property]
						);
						result.conditions.push({
							property: ["descriptionData", ...dataProperty],
							matchWhenEmpty: condition.matchWhenEmpty,
							fn: condition.fn
						});
					}
				}
			}
		);
	}
}

module.exports = DescriptionDataMatcherRulePlugin;
