"use strict";

const Template = require("../Template");
const makeSerializable = require("../util/makeSerializable");
const HarmonyImportDependency = require("./HarmonyImportDependency");
const NullDependency = require("./NullDependency");

// ES模块接受更新依赖
// 热更新相关
class HarmonyAcceptDependency extends NullDependency {
	/**
	 * @param {[number, number]} range expression range
	 * @param {HarmonyAcceptImportDependency[]} dependencies import dependencies
	 * @param {boolean} hasCallback true, if the range wraps an existing callback
	 */
	constructor(range, dependencies, hasCallback) {
		super();
		this.range = range;
		this.dependencies = dependencies;
		this.hasCallback = hasCallback;
	}

	get type() {
		return "accepted harmony modules";
	}

	serialize(context) {
		const { write } = context;
		write(this.range);
		write(this.dependencies);
		write(this.hasCallback);
		super.serialize(context);
	}

	deserialize(context) {
		const { read } = context;
		this.range = read();
		this.dependencies = read();
		this.hasCallback = read();
		super.deserialize(context);
	}
}

makeSerializable(
	HarmonyAcceptDependency,
	"webpack/lib/dependencies/HarmonyAcceptDependency"
);

HarmonyAcceptDependency.Template = class HarmonyAcceptDependencyTemplate extends (
	NullDependency.Template
) {
	/**
	 * @param {Dependency} dependency the dependency for which the template should be applied
	 * @param {ReplaceSource} source the current replace source which can be modified
	 * @param {DependencyTemplateContext} templateContext the context object
	 * @returns {void}
	 */
	apply(dependency, source, templateContext) {
		const dep = /** @type {HarmonyAcceptDependency} */ (dependency);
		const {
			module,
			runtime,
			runtimeRequirements,
			runtimeTemplate,
			moduleGraph,
			chunkGraph
		} = templateContext;
		const content = dep.dependencies
			.map(dependency => {
				const referencedModule = moduleGraph.getModule(dependency);
				return {
					dependency,
					runtimeCondition: referencedModule
						? HarmonyImportDependency.Template.getImportEmittedRuntime(
								module,
								referencedModule
						  )
						: false
				};
			})
			.filter(({ runtimeCondition }) => runtimeCondition !== false)
			.map(({ dependency, runtimeCondition }) => {
				const condition = runtimeTemplate.runtimeConditionExpression({
					chunkGraph,
					runtime,
					runtimeCondition,
					runtimeRequirements
				});
				const s = dependency.getImportStatement(true, templateContext);
				const code = s[0] + s[1];
				if (condition !== "true") {
					return `if (${condition}) {\n${Template.indent(code)}\n}\n`;
				}
				return code;
			})
			.join("");

		if (dep.hasCallback) {
			if (runtimeTemplate.supportsArrowFunction()) {
				source.insert(
					dep.range[0],
					`__WEBPACK_OUTDATED_DEPENDENCIES__ => { ${content}(`
				);
				source.insert(dep.range[1], ")(__WEBPACK_OUTDATED_DEPENDENCIES__); }");
			} else {
				source.insert(
					dep.range[0],
					`function(__WEBPACK_OUTDATED_DEPENDENCIES__) { ${content}(`
				);
				source.insert(
					dep.range[1],
					")(__WEBPACK_OUTDATED_DEPENDENCIES__); }.bind(this)"
				);
			}
			return;
		}

		const arrow = runtimeTemplate.supportsArrowFunction();
		source.insert(
			dep.range[1] - 0.5,
			`, ${arrow ? "() =>" : "function()"} { ${content} }`
		);
	}
};

module.exports = HarmonyAcceptDependency;
