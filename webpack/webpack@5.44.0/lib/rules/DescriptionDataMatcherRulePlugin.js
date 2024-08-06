"use strict";

const RULE_PROPERTY = "descriptionData";

// 作用:
// 允许匹配来自 package.json 中的数据
// 创建 某个规则属性 的条件匹配(通过 规则属性 对 某个数据属性 进行条件匹配)
class DescriptionDataMatcherRulePlugin {
	apply(ruleSetCompiler) {
		ruleSetCompiler.hooks.rule.tap(
			"DescriptionDataMatcherRulePlugin",
			(path, rule, unhandledProperties, result) => {
				if (unhandledProperties.has(RULE_PROPERTY)) {
					// 删除 某个规则 防止被重复编译
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
