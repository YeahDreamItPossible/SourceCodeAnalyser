"use strict";

const Dependency = require("../Dependency");
const DependencyTemplate = require("../DependencyTemplate");

class NullDependency extends Dependency {
	get type() {
		return "null";
	}
}

NullDependency.Template = class NullDependencyTemplate extends (
	DependencyTemplate
) {
	apply(dependency, source, templateContext) {}
};

module.exports = NullDependency;
