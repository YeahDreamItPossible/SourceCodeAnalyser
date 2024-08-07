"use strict";

const ConcatenationScope = require("../ConcatenationScope");
const RuntimeGlobals = require("../RuntimeGlobals");
const makeSerializable = require("../util/makeSerializable");
const HarmonyExportInitFragment = require("./HarmonyExportInitFragment");
const NullDependency = require("./NullDependency");

// ES模块导出默认值依赖
// 当代码片段中包含 export default 时
class HarmonyExportExpressionDependency extends NullDependency {
	constructor(range, rangeStatement, prefix, declarationId) {
		super();
		this.range = range;
		this.rangeStatement = rangeStatement;
		this.prefix = prefix;
		this.declarationId = declarationId;
	}

	get type() {
		return "harmony export expression";
	}

	getExports(moduleGraph) {
		return {
			exports: ["default"],
			priority: 1,
			terminalBinding: true,
			dependencies: undefined
		};
	}

	getModuleEvaluationSideEffectsState(moduleGraph) {
		// The expression/declaration is already covered by SideEffectsFlagPlugin
		return false;
	}

	serialize(context) {
		const { write } = context;
		write(this.range);
		write(this.rangeStatement);
		write(this.prefix);
		write(this.declarationId);
		super.serialize(context);
	}

	deserialize(context) {
		const { read } = context;
		this.range = read();
		this.rangeStatement = read();
		this.prefix = read();
		this.declarationId = read();
		super.deserialize(context);
	}
}

makeSerializable(
	HarmonyExportExpressionDependency,
	"webpack/lib/dependencies/HarmonyExportExpressionDependency"
);

HarmonyExportExpressionDependency.Template = class HarmonyExportDependencyTemplate extends (
	NullDependency.Template
) {
	apply(
		dependency,
		source,
		{
			module,
			moduleGraph,
			runtimeTemplate,
			runtimeRequirements,
			initFragments,
			runtime,
			concatenationScope
		}
	) {
		const dep = /** @type {HarmonyExportExpressionDependency} */ (dependency);
		const { declarationId } = dep;
		const exportsName = module.exportsArgument;
		if (declarationId) {
			let name;
			if (typeof declarationId === "string") {
				name = declarationId;
			} else {
				name = ConcatenationScope.DEFAULT_EXPORT;
				source.replace(
					declarationId.range[0],
					declarationId.range[1] - 1,
					`${declarationId.prefix}${name}${declarationId.suffix}`
				);
			}

			if (concatenationScope) {
				concatenationScope.registerExport("default", name);
			} else {
				const used = moduleGraph
					.getExportsInfo(module)
					.getUsedName("default", runtime);
				if (used) {
					const map = new Map();
					map.set(used, `/* export default binding */ ${name}`);
					initFragments.push(new HarmonyExportInitFragment(exportsName, map));
				}
			}

			source.replace(
				dep.rangeStatement[0],
				dep.range[0] - 1,
				`/* harmony default export */ ${dep.prefix}`
			);
		} else {
			let content;
			const name = ConcatenationScope.DEFAULT_EXPORT;
			if (runtimeTemplate.supportsConst()) {
				content = `/* harmony default export */ const ${name} = `;
				if (concatenationScope) {
					concatenationScope.registerExport("default", name);
				} else {
					const used = moduleGraph
						.getExportsInfo(module)
						.getUsedName("default", runtime);
					if (used) {
						runtimeRequirements.add(RuntimeGlobals.exports);
						const map = new Map();
						map.set(used, name);
						initFragments.push(new HarmonyExportInitFragment(exportsName, map));
					} else {
						content = `/* unused harmony default export */ var ${name} = `;
					}
				}
			} else if (concatenationScope) {
				content = `/* harmony default export */ var ${name} = `;
				concatenationScope.registerExport("default", name);
			} else {
				const used = moduleGraph
					.getExportsInfo(module)
					.getUsedName("default", runtime);
				if (used) {
					runtimeRequirements.add(RuntimeGlobals.exports);
					// This is a little bit incorrect as TDZ is not correct, but we can't use const.
					content = `/* harmony default export */ ${exportsName}[${JSON.stringify(
						used
					)}] = `;
				} else {
					content = `/* unused harmony default export */ var ${name} = `;
				}
			}

			if (dep.range) {
				source.replace(
					dep.rangeStatement[0],
					dep.range[0] - 1,
					content + "(" + dep.prefix
				);
				source.replace(dep.range[1], dep.rangeStatement[1] - 0.5, ");");
				return;
			}

			source.replace(dep.rangeStatement[0], dep.rangeStatement[1] - 1, content);
		}
	}
};

module.exports = HarmonyExportExpressionDependency;
