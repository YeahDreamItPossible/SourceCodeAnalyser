"use strict";

const CaseSensitiveModulesWarning = require("./CaseSensitiveModulesWarning");

// 当 Module.identifier 有重复时 抛出错误
class WarnCaseSensitiveModulesPlugin {
	apply(compiler) {
		compiler.hooks.compilation.tap(
			"WarnCaseSensitiveModulesPlugin",
			compilation => {
				compilation.hooks.seal.tap("WarnCaseSensitiveModulesPlugin", () => {
					// Map<String, Map<String, Module>>
					const moduleWithoutCase = new Map();
					for (const module of compilation.modules) {
						// 返回 Module标识符
						const identifier = module.identifier();
						// 将 Module标识符 全部转成小写
						const lowerIdentifier = identifier.toLowerCase();
						let map = moduleWithoutCase.get(lowerIdentifier);
						if (map === undefined) {
							map = new Map();
							moduleWithoutCase.set(lowerIdentifier, map);
						}
						map.set(identifier, module);
					}
					for (const pair of moduleWithoutCase) {
						const map = pair[1];
						// 模块路径有重复
						if (map.size > 1) {
							compilation.warnings.push(
								new CaseSensitiveModulesWarning(
									map.values(),
									compilation.moduleGraph
								)
							);
						}
					}
				});
			}
		);
	}
}

module.exports = WarnCaseSensitiveModulesPlugin;
