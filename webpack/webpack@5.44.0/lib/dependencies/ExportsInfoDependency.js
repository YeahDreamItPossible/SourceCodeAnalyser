"use strict";

const { UsageState } = require("../ExportsInfo");
const makeSerializable = require("../util/makeSerializable");
const NullDependency = require("./NullDependency");

const getProperty = (moduleGraph, module, exportName, property, runtime) => {
	if (!exportName) {
		switch (property) {
			case "usedExports": {
				const usedExports = moduleGraph
					.getExportsInfo(module)
					.getUsedExports(runtime);
				if (
					typeof usedExports === "boolean" ||
					usedExports === undefined ||
					usedExports === null
				) {
					return usedExports;
				}
				return Array.from(usedExports).sort();
			}
		}
	}
	switch (property) {
		case "used":
			return (
				moduleGraph.getExportsInfo(module).getUsed(exportName, runtime) !==
				UsageState.Unused
			);
		case "useInfo": {
			const state = moduleGraph
				.getExportsInfo(module)
				.getUsed(exportName, runtime);
			switch (state) {
				case UsageState.Used:
				case UsageState.OnlyPropertiesUsed:
					return true;
				case UsageState.Unused:
					return false;
				case UsageState.NoInfo:
					return undefined;
				case UsageState.Unknown:
					return null;
				default:
					throw new Error(`Unexpected UsageState ${state}`);
			}
		}
		case "provideInfo":
			return moduleGraph.getExportsInfo(module).isExportProvided(exportName);
	}
	return undefined;
};

// 导出信息依赖
// 作用:
// 
class ExportsInfoDependency extends NullDependency {
	constructor(range, exportName, property) {
		super();
		this.range = range;
		this.exportName = exportName;
		this.property = property;
	}

	serialize(context) {
		const { write } = context;
		write(this.range);
		write(this.exportName);
		write(this.property);
		super.serialize(context);
	}

	static deserialize(context) {
		const obj = new ExportsInfoDependency(
			context.read(),
			context.read(),
			context.read()
		);
		obj.deserialize(context);
		return obj;
	}
}

makeSerializable(
	ExportsInfoDependency,
	"webpack/lib/dependencies/ExportsInfoDependency"
);

ExportsInfoDependency.Template = class ExportsInfoDependencyTemplate extends (
	NullDependency.Template
) {
	/**
	 * @param {Dependency} dependency the dependency for which the template should be applied
	 * @param {ReplaceSource} source the current replace source which can be modified
	 * @param {DependencyTemplateContext} templateContext the context object
	 * @returns {void}
	 */
	apply(dependency, source, { module, moduleGraph, runtime }) {
		const dep = /** @type {ExportsInfoDependency} */ (dependency);

		const value = getProperty(
			moduleGraph,
			module,
			dep.exportName,
			dep.property,
			runtime
		);
		source.replace(
			dep.range[0],
			dep.range[1] - 1,
			value === undefined ? "undefined" : JSON.stringify(value)
		);
	}
};

module.exports = ExportsInfoDependency;
