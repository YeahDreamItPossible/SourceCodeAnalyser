"use strict";

const { SyncHook } = require("tapable");

/**
 * rules: [{ conditions: [], effects: [], rules: [], oneOf: []}]
 * condition: { property: String, matchWhenEmpty: Boolean || Function, fn: Function}
 */

/**
 * 规则集合:
 * ruleSet: [
 * 	{
 * 		rules: Webpack.options.module.defaultRules // webpack内置模块规则
 * 	},
 *  {
 * 		rules: Webpack.options.module.rules        // 用户自定义模块规则
 *  }
 * ]
 */

/**
 * 模块匹配规则
 */

// 规则集合编译器
// 作用:
// 
class RuleSetCompiler {
	constructor(plugins) {
		this.hooks = Object.freeze({
			/** @type {SyncHook<[string, object, Set<string>, CompiledRule, Map<string, any>]>} */
			rule: new SyncHook([
				"path",
				"rule",
				"unhandledProperties",
				"compiledRule",
				"references"
			])
		});
		// BasicMatcherRulePlugin
		// DescriptionDataMatcherRulePlugin
		// BasicEffectRulePlugin
		// UseEffectRulePlugin
		if (plugins) {
			for (const plugin of plugins) {
				plugin.apply(this);
			}
		}
	}

	/**
	 * 
	 */
	// 编译
	compile(ruleSet) {
		// refs: Map<loader.ident, laoder.options>
		const refs = new Map();
		// 在创建NormalModuleFactory实例时 调用ruleSetCompiler.compile
		// rules: [
		//	{ 
		//			rules: [], 
		//			oneOf: [], 
		//			conditions: [{ property: String, matchWhenEmpty: Boolean || Function, fn: Function }], 
		//			effects: [{ type: String, value: { loader: String, options: Object, ident: String(唯一标识符) } }]
		// ]
		const rules = this.compileRules("ruleSet", ruleSet, refs);

		/**
		 * @param {object} data data passed in
		 * @param {CompiledRule} rule the compiled rule
		 * @param {Effect[]} effects an array where effects are pushed to
		 * @returns {boolean} true, if the rule has matched
		 */
		const execRule = (data, rule, effects) => {
			for (const condition of rule.conditions) {
				const p = condition.property;
				if (Array.isArray(p)) {
					let current = data;
					for (const subProperty of p) {
						if (
							current &&
							typeof current === "object" &&
							Object.prototype.hasOwnProperty.call(current, subProperty)
						) {
							current = current[subProperty];
						} else {
							current = undefined;
							break;
						}
					}
					if (current !== undefined) {
						if (!condition.fn(current)) return false;
						continue;
					}
				} else if (p in data) {
					const value = data[p];
					if (value !== undefined) {
						if (!condition.fn(value)) return false;
						continue;
					}
				}
				if (!condition.matchWhenEmpty) {
					return false;
				}
			}
			for (const effect of rule.effects) {
				if (typeof effect === "function") {
					const returnedEffects = effect(data);
					for (const effect of returnedEffects) {
						effects.push(effect);
					}
				} else {
					effects.push(effect);
				}
			}
			if (rule.rules) {
				for (const childRule of rule.rules) {
					execRule(data, childRule, effects);
				}
			}
			if (rule.oneOf) {
				for (const childRule of rule.oneOf) {
					if (execRule(data, childRule, effects)) {
						break;
					}
				}
			}
			return true;
		};

		return {
			references: refs,
			exec: data => {
				/** @type {Effect[]} */
				const effects = [];
				for (const rule of rules) {
					execRule(data, rule, effects);
				}
				return effects;
			}
		};
	}

	// 编译所有的规则
	compileRules(path, rules, refs) {
		return rules.map((rule, i) =>
			this.compileRule(`${path}[${i}]`, rule, refs)
		);
	}

	// 返回标准化后的规则
	compileRule(path, rule, refs) {
		// 当某个 规则 的值不是 undefined时
		// 一旦 某个规则 已经被编译后 将会被删除
		const unhandledProperties = new Set(
			Object.keys(rule).filter(key => rule[key] !== undefined)
		);

		const compiledRule = {
			conditions: [], // 条件匹配
			effects: [], // 副作用
			rules: undefined, // 规则
			oneOf: undefined // 
		};

		// 编译 Webpack.options.Module.Rule.[xx]
		this.hooks.rule.call(path, rule, unhandledProperties, compiledRule, refs);

		// 单独对 rules 属性进行编译
		// Webpack.options.Module.Rule.rules
		if (unhandledProperties.has("rules")) {
			unhandledProperties.delete("rules");
			const rules = rule.rules;
			if (!Array.isArray(rules))
				throw this.error(path, rules, "Rule.rules must be an array of rules");
			compiledRule.rules = this.compileRules(`${path}.rules`, rules, refs);
		}

		// 单独对 oneOf 属性进行编译
		// Webpack.options.Module.Rule.oneOf
		if (unhandledProperties.has("oneOf")) {
			unhandledProperties.delete("oneOf");
			const oneOf = rule.oneOf;
			if (!Array.isArray(oneOf))
				throw this.error(path, oneOf, "Rule.oneOf must be an array of rules");
			compiledRule.oneOf = this.compileRules(`${path}.oneOf`, oneOf, refs);
		}

		if (unhandledProperties.size > 0) {
			throw this.error(
				path,
				rule,
				`Properties ${Array.from(unhandledProperties).join(", ")} are unknown`
			);
		}

		return compiledRule;
	}

	/**
	 * 根据 条件(condition) 编译成对应的匹配规则
	 * 匹配规则: { matchWhenEmpty: Boolean || Function, fn: Function}
	 * 条件condition:
	 * 1. 字符串: 匹配输入必须以提供的字符串开始
	 * 2. 正则表达式: test 输入值
	 * 3. 函数
	 * 4. 条件数组: test 输入值
	 * 5. 对象: 匹配所有属性
	 */
	// 编译 条件匹配
	compileCondition(path, condition) {
		// 空字符串条件匹配: 输入值 必须为 空字符串
		if (condition === "") {
			return {
				matchWhenEmpty: true,
				fn: str => str === ""
			};
		}
		if (!condition) {
			throw this.error(
				path,
				condition,
				"Expected condition but got falsy value"
			);
		}
		// 字符串条件匹配: 输入值 必须 以该字符串开始
		if (typeof condition === "string") {
			return {
				matchWhenEmpty: condition.length === 0,
				fn: str => typeof str === "string" && str.startsWith(condition)
			};
		}
		// 函数条件匹配: 以 输入值 为该函数的参数 返回值必须为真值
		if (typeof condition === "function") {
			try {
				return {
					matchWhenEmpty: condition(""),
					fn: condition
				};
			} catch (err) {
				throw this.error(
					path,
					condition,
					"Evaluation of condition function threw error"
				);
			}
		}
		// 正则条件匹配: 输入值 必须满足该正则规则
		if (condition instanceof RegExp) {
			return {
				matchWhenEmpty: condition.test(""),
				fn: v => typeof v === "string" && condition.test(v)
			};
		}
		// 数组条件匹配: 只需满足一个匹配条件即可
		if (Array.isArray(condition)) {
			const items = condition.map((c, i) =>
				this.compileCondition(`${path}[${i}]`, c)
			);
			return this.combineConditionsOr(items);
		}

		if (typeof condition !== "object") {
			throw this.error(
				path,
				condition,
				`Unexpected ${typeof condition} when condition was expected`
			);
		}

		// 对象条件匹配: 需要满足对象中的所有匹配规则
		const conditions = [];
		for (const key of Object.keys(condition)) {
			const value = condition[key];
			switch (key) {
				// 匹配数组中任何一个条件
				case "or":
					if (value) {
						if (!Array.isArray(value)) {
							throw this.error(
								`${path}.or`,
								condition.and,
								"Expected array of conditions"
							);
						}
						conditions.push(this.compileCondition(`${path}.or`, value));
					}
					break;
				// 必须匹配数组中的所有条件
				case "and":
					if (value) {
						if (!Array.isArray(value)) {
							throw this.error(
								`${path}.and`,
								condition.and,
								"Expected array of conditions"
							);
						}
						let i = 0;
						for (const item of value) {
							conditions.push(this.compileCondition(`${path}.and[${i}]`, item));
							i++;
						}
					}
					break;
				// 必须排除这个条件
				case "not":
					if (value) {
						const matcher = this.compileCondition(`${path}.not`, value);
						const fn = matcher.fn;
						conditions.push({
							matchWhenEmpty: !matcher.matchWhenEmpty,
							fn: v => !fn(v)
						});
					}
					break;
				default:
					throw this.error(
						`${path}.${key}`,
						condition[key],
						`Unexpected property ${key} in condition`
					);
			}
		}
		if (conditions.length === 0) {
			throw this.error(
				path,
				condition,
				"Expected condition, but got empty thing"
			);
		}
		return this.combineConditionsAnd(conditions);
	}

	// 当 数组条件匹配 时 只需满足一个匹配条件即可
	combineConditionsOr(conditions) {
		if (conditions.length === 0) {
			return {
				matchWhenEmpty: false,
				fn: () => false
			};
		} else if (conditions.length === 1) {
			return conditions[0];
		} else {
			return {
				matchWhenEmpty: conditions.some(c => c.matchWhenEmpty),
				fn: v => conditions.some(c => c.fn(v))
			};
		}
	}

	// 当 对象条件匹配 时 需要满足对象中的所有匹配规则
	combineConditionsAnd(conditions) {
		if (conditions.length === 0) {
			return {
				matchWhenEmpty: false,
				fn: () => false
			};
		} else if (conditions.length === 1) {
			return conditions[0];
		} else {
			return {
				matchWhenEmpty: conditions.every(c => c.matchWhenEmpty),
				fn: v => conditions.every(c => c.fn(v))
			};
		}
	}

	// 抛出错误
	error(path, value, message) {
		return new Error(
			`Compiling RuleSet failed: ${message} (at ${path}: ${value})`
		);
	}
}

module.exports = RuleSetCompiler;
