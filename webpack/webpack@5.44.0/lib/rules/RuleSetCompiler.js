"use strict";

const { SyncHook } = require("tapable");

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
 * 编译后的规则集合:
 * rules: [
 * 	{
 * 		rules: [],
 * 		oneOf: [],
 * 		conditions: [ // 条件集合
 * 			{
 * 				property: String, // 匹配字段名
 * 				matchWhenEmpty: Boolean || Function, // 当 字段为空 时 是否还要进行匹配
 * 				fn: Function // 匹配函数
 * 			}
 * 		]，
 * 		effects: [ // 副作用集合
 * 			{ 
 * 				type: String, // 副作用类型
 * 				value: { 
 * 					loader: String,  // 加载器 
 * 					options: Object, // 加载器选项
 * 					ident: String(唯一标识符) // 
 * 				} 
 * 			}
 * 		]
 * 	}
 * ]
 */

/**
 * 条件匹配：
 * 对 某个字段 进行匹配 并返回 Boolean 表示是否满足匹配结果
 * 副作用:
 * 在 满足字段匹配 的基础上 返回匹配结果(例如成功匹配的 loader 信息)
 * 在 执行匹配 时 只有满足所有的 条件匹配 时 才能返回 副作用
 * 所谓的 副作用 是指在对 模块加工处理 时 需要的额外信息
 */

/**
 * 总结:
 * Webpack 对 模块 的匹配规则 实现原理:
 * 将 部分属性 编译成 条件匹配
 * 将 部分属性 编译成 副作用
 * 在对 模块 进行匹配时 只有满足所有的 条件匹配 时 才能返回 副作用
 * 该 副作用 在 模块构建 和 代码生成 的过程中 起标识性作用
 */

// 规则集合编译器
// 作用:
// 将 所有的规则集合 编译成 匹配器
// 调用 匹配器 的匹配方法 对 模块 进行匹配 并返回匹配结果
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

	// 编译 所有的规则集合 后返回 匹配器
	// 在创建 NormalModuleFactory 实例时 调用 ruleSetCompiler.compile
	compile(ruleSet) {
		// Map<loader.ident, laoder.options>
		// loader.ident 一般是指 加载器 在 规则集合 中的路径
		const refs = new Map();
		// 编译后的规则集合
		const rules = this.compileRules("ruleSet", ruleSet, refs);

		/**
		 * @param {object} data data passed in
		 * @param {CompiledRule} rule the compiled rule
		 * @param {Effect[]} effects an array where effects are pushed to
		 * @returns {boolean} true, if the rule has matched
		 */
		const execRule = (data, rule, effects) => {
			// 遍历所有的 条件匹配 必须满足所有的条件匹配
			// 当 某个条件匹配 不满足时 直接返回
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
						// 当不满足 某个条件匹配 时 直接返回
						if (!condition.fn(value)) return false;
						continue;
					}
				}
				if (!condition.matchWhenEmpty) {
					return false;
				}
			}
			// 当满足所有的 条件匹配 后 添加所有的副作用
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
			// 递归
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

		// 返回 匹配器
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

	// 抛出规则编译时错误
	error(path, value, message) {
		return new Error(
			`Compiling RuleSet failed: ${message} (at ${path}: ${value})`
		);
	}
}

module.exports = RuleSetCompiler;
