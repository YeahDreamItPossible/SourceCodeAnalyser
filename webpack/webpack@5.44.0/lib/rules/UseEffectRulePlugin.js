"use strict";

const util = require("util");

/**
 * 根据以下条件(condition)编译成对应的匹配规则副作用
 * 匹配规则: { type: String, value: { loader: String, options: Object, ident: String} }
 * 其中匹配规则中的type表示当前loader类型(preLoader loaer postLoader)
 * 条件condition:
 * Webpack.Config.Module.Rule.use 
 * Webpack.Config.Module.Rule.loader
 */
class UseEffectRulePlugin {
	apply(ruleSetCompiler) {
		ruleSetCompiler.hooks.rule.tap(
			"UseEffectRulePlugin",
			(path, rule, unhandledProperties, result, references) => {
				// 字段a 与 字段b 不能同时出现
				const conflictWith = (property, correctProperty) => {
					if (unhandledProperties.has(property)) {
						throw ruleSetCompiler.error(
							`${path}.${property}`,
							rule[property],
							`A Rule must not have a '${property}' property when it has a '${correctProperty}' property`
						);
					}
				};

				// Webpack.Config.Module.Rule.use 
				if (unhandledProperties.has("use")) {
					unhandledProperties.delete("use");
					unhandledProperties.delete("enforce");

					// use 与 loader 字段不能同时被使用
					conflictWith("loader", "use");
					// use 与 options 字段不能同时被使用
					conflictWith("options", "use");

					const use = rule.use;
					const enforce = rule.enforce;

					const type = enforce ? `use-${enforce}` : "use";

					const useToEffect = (path, defaultIdent, item) => {
						if (typeof item === "function") {
							return data => useToEffectsWithoutIdent(path, item(data));
						} else {
							return useToEffectRaw(path, defaultIdent, item);
						}
					};

					const useToEffectRaw = (path, defaultIdent, item) => {
						if (typeof item === "string") {
							return {
								type,
								value: {
									loader: item,
									options: undefined,
									ident: undefined
								}
							};
						} else {
							const loader = item.loader;
							const options = item.options;
							let ident = item.ident;
							if (options && typeof options === "object") {
								if (!ident) ident = defaultIdent;
								references.set(ident, options);
							}
							// Webpack.Config.Module.Rule.options 不再支持String类型
							if (typeof options === "string") {
								util.deprecate(
									() => {},
									`Using a string as loader options is deprecated (${path}.options)`,
									"DEP_WEBPACK_RULE_LOADER_OPTIONS_STRING"
								)();
							}
							return {
								type: enforce ? `use-${enforce}` : "use",
								value: {
									loader,
									options,
									ident
								}
							};
						}
					};

					/**
					 * @param {string} path options path
					 * @param {any} items user provided use value
					 * @returns {Effect[]} effects
					 */
					const useToEffectsWithoutIdent = (path, items) => {
						if (Array.isArray(items)) {
							return items.map((item, idx) =>
								useToEffectRaw(`${path}[${idx}]`, "[[missing ident]]", item)
							);
						}
						return [useToEffectRaw(path, "[[missing ident]]", items)];
					};

					const useToEffects = (path, items) => {
						if (Array.isArray(items)) {
							return items.map((item, idx) => {
								const subPath = `${path}[${idx}]`;
								return useToEffect(subPath, subPath, item);
							});
						}
						return [useToEffect(path, path, items)];
					};

					// Webpack.Config.Module.use 是Function
					if (typeof use === "function") {
						result.effects.push(data =>
							useToEffectsWithoutIdent(`${path}.use`, use(data))
						);
					} 
					// Webpack.Config.Module.use 是 Array
					else {
						for (const effect of useToEffects(`${path}.use`, use)) {
							result.effects.push(effect);
						}
					}
				}

				// Webpack.Config.Module.Rule.loader
				if (unhandledProperties.has("loader")) {
					unhandledProperties.delete("loader");
					unhandledProperties.delete("options");
					unhandledProperties.delete("enforce");

					const loader = rule.loader;
					const options = rule.options;
					const enforce = rule.enforce;

					// Webpack.Config.Module.Rule.loader属性不再支持以 ! 的方式使用多个loader
					// 如果想要使用多个loader 使用Webpack.Config.Module.Rule.use
					if (loader.includes("!")) {
						throw ruleSetCompiler.error(
							`${path}.loader`,
							loader,
							"Exclamation mark separated loader lists has been removed in favor of the 'use' property with arrays"
						);
					}
					// Webpack.Config.Module.Rule.loader属性不再支持以 ? 的方式传递参数
					// 如果想要给loader传递参数 使用Webpack.Config.Module.Rule.options
					if (loader.includes("?")) {
						throw ruleSetCompiler.error(
							`${path}.loader`,
							loader,
							"Query arguments on 'loader' has been removed in favor of the 'options' property"
						);
					}
					// Webpack.Config.Module.Rule.options 不再支持String类型
					if (typeof options === "string") {
						util.deprecate(
							() => {},
							`Using a string as loader options is deprecated (${path}.options)`,
							"DEP_WEBPACK_RULE_LOADER_OPTIONS_STRING"
						)();
					}

					// 唯一标识符
					const ident =
						options && typeof options === "object" ? path : undefined;
					references.set(ident, options);
					result.effects.push({
						type: enforce ? `use-${enforce}` : "use",
						value: {
							loader,
							options,
							ident
						}
					});
				}
			}
		);
	}

	useItemToEffects(path, item) {}
}

module.exports = UseEffectRulePlugin;
