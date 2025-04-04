"use strict";

const ModuleDependency = require("./ModuleDependency");

// TODO:
// 
// 作用:
// 
class ModuleDependencyTemplateAsId extends ModuleDependency.Template {
	/**
	 * @param {Dependency} dependency the dependency for which the template should be applied
	 * @param {ReplaceSource} source the current replace source which can be modified
	 * @param {DependencyTemplateContext} templateContext the context object
	 * @returns {void}
	 */
	apply(dependency, source, { runtimeTemplate, moduleGraph, chunkGraph }) {
		const dep = /** @type {ModuleDependency} */ (dependency);
		if (!dep.range) return;
		const content = runtimeTemplate.moduleId({
			module: moduleGraph.getModule(dep),
			chunkGraph,
			request: dep.request,
			weak: dep.weak
		});
		source.replace(dep.range[0], dep.range[1] - 1, content);
	}
}

module.exports = ModuleDependencyTemplateAsId;
