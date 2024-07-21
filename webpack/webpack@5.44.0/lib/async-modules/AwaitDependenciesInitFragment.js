"use strict";

const InitFragment = require("../InitFragment");
const RuntimeGlobals = require("../RuntimeGlobals");
const Template = require("../Template");

// Await依赖初始化代码片段
// 作用:
// 
class AwaitDependenciesInitFragment extends InitFragment {
	/**
	 * @param {Set<string>} promises the promises that should be awaited
	 */
	constructor(promises) {
		super(
			undefined,
			InitFragment.STAGE_ASYNC_DEPENDENCIES,
			0,
			"await-dependencies"
		);
		this.promises = promises;
	}

	merge(other) {
		const promises = new Set(this.promises);
		for (const p of other.promises) {
			promises.add(p);
		}
		return new AwaitDependenciesInitFragment(promises);
	}

	getContent({ runtimeRequirements }) {
		runtimeRequirements.add(RuntimeGlobals.module);
		const promises = this.promises;
		if (promises.size === 0) {
			return "";
		}
		if (promises.size === 1) {
			for (const p of promises) {
				return Template.asString([
					`var __webpack_async_dependencies__ = __webpack_handle_async_dependencies__([${p}]);`,
					`${p} = (__webpack_async_dependencies__.then ? await __webpack_async_dependencies__ : __webpack_async_dependencies__)[0];`,
					""
				]);
			}
		}
		const sepPromises = Array.from(promises).join(", ");
		// TODO check if destructuring is supported
		return Template.asString([
			`var __webpack_async_dependencies__ = __webpack_handle_async_dependencies__([${sepPromises}]);`,
			`([${sepPromises}] = __webpack_async_dependencies__.then ? await __webpack_async_dependencies__ : __webpack_async_dependencies__);`,
			""
		]);
	}
}

module.exports = AwaitDependenciesInitFragment;
