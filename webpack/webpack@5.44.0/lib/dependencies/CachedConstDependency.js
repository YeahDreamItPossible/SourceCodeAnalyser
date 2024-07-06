"use strict";

const DependencyTemplate = require("../DependencyTemplate");
const InitFragment = require("../InitFragment");
const makeSerializable = require("../util/makeSerializable");
const NullDependency = require("./NullDependency");

// TODO:
// 缓存的常量依赖
class CachedConstDependency extends NullDependency {
	constructor(expression, range, identifier) {
		super();
		// 
		this.expression = expression;
		this.range = range;
		this.identifier = identifier;
	}

	/**
	 * Update the hash
	 * @param {Hash} hash hash to be updated
	 * @param {UpdateHashContext} context context
	 * @returns {void}
	 */
	updateHash(hash, context) {
		hash.update(this.identifier + "");
		hash.update(this.range + "");
		hash.update(this.expression + "");
	}

	serialize(context) {
		const { write } = context;

		write(this.expression);
		write(this.range);
		write(this.identifier);

		super.serialize(context);
	}

	deserialize(context) {
		const { read } = context;

		this.expression = read();
		this.range = read();
		this.identifier = read();

		super.deserialize(context);
	}
}

makeSerializable(
	CachedConstDependency,
	"webpack/lib/dependencies/CachedConstDependency"
);

CachedConstDependency.Template = class CachedConstDependencyTemplate extends (
	DependencyTemplate
) {
	/**
	 * @param {Dependency} dependency the dependency for which the template should be applied
	 * @param {ReplaceSource} source the current replace source which can be modified
	 * @param {DependencyTemplateContext} templateContext the context object
	 * @returns {void}
	 */
	apply(
		dependency,
		source,
		{ runtimeTemplate, dependencyTemplates, initFragments }
	) {
		const dep = /** @type {CachedConstDependency} */ (dependency);

		initFragments.push(
			new InitFragment(
				`var ${dep.identifier} = ${dep.expression};\n`,
				InitFragment.STAGE_CONSTANTS,
				0,
				`const ${dep.identifier}`
			)
		);

		if (typeof dep.range === "number") {
			source.insert(dep.range, dep.identifier);

			return;
		}

		source.replace(dep.range[0], dep.range[1] - 1, dep.identifier);
	}
};

module.exports = CachedConstDependency;
