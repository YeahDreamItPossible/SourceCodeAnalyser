"use strict";

const makeSerializable = require("../util/makeSerializable");
const NullDependency = require("./NullDependency");

// TODO:
// CommonJS 相关
class RuntimeRequirementsDependency extends NullDependency {
	/**
	 * @param {string[]} runtimeRequirements runtime requirements
	 */
	constructor(runtimeRequirements) {
		super();
		this.runtimeRequirements = new Set(runtimeRequirements);
	}

	updateHash(hash, context) {
		hash.update(Array.from(this.runtimeRequirements).join() + "");
	}

	serialize(context) {
		const { write } = context;
		write(this.runtimeRequirements);
		super.serialize(context);
	}

	deserialize(context) {
		const { read } = context;
		this.runtimeRequirements = read();
		super.deserialize(context);
	}
}

makeSerializable(
	RuntimeRequirementsDependency,
	"webpack/lib/dependencies/RuntimeRequirementsDependency"
);

RuntimeRequirementsDependency.Template = class RuntimeRequirementsDependencyTemplate extends (
	NullDependency.Template
) {
	apply(dependency, source, { runtimeRequirements }) {
		const dep = /** @type {RuntimeRequirementsDependency} */ (dependency);
		for (const req of dep.runtimeRequirements) {
			runtimeRequirements.add(req);
		}
	}
};

module.exports = RuntimeRequirementsDependency;
