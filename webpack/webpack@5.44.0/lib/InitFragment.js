"use strict";

const { ConcatSource } = require("webpack-sources");

// 
const extractFragmentIndex = (fragment, index) => [fragment, index];

// 排序
const sortFragmentWithIndex = ([a, i], [b, j]) => {
	const stageCmp = a.stage - b.stage;
	if (stageCmp !== 0) return stageCmp;
	const positionCmp = a.position - b.position;
	if (positionCmp !== 0) return positionCmp;
	return i - j;
};

// 初始化代码片段
class InitFragment {
	constructor(content, stage, position, key, endContent) {
		// 内容
		// String | Source
		this.content = content;
		// 阶段
		this.stage = stage;
		// 位置
		this.position = position;
		// 唯一Key
		this.key = key;
		// 结束内容
		this.endContent = endContent;
	}

	getContent(context) {
		return this.content;
	}

	getEndContent(context) {
		return this.endContent;
	}

	// 返回 Source
	static addToSource(source, initFragments, context) {
		if (initFragments.length > 0) {
			// Sort fragments by position. If 2 fragments have the same position,
			// use their index.
			const sortedFragments = initFragments
				.map(extractFragmentIndex)
				.sort(sortFragmentWithIndex);

			// Deduplicate fragments. If a fragment has no key, it is always included.
			const keyedFragments = new Map();
			for (const [fragment] of sortedFragments) {
				if (typeof fragment.mergeAll === "function") {
					if (!fragment.key) {
						throw new Error(
							`InitFragment with mergeAll function must have a valid key: ${fragment.constructor.name}`
						);
					}
					const oldValue = keyedFragments.get(fragment.key);
					if (oldValue === undefined) {
						keyedFragments.set(fragment.key, fragment);
					} else if (Array.isArray(oldValue)) {
						oldValue.push(fragment);
					} else {
						keyedFragments.set(fragment.key, [oldValue, fragment]);
					}
					continue;
				} else if (typeof fragment.merge === "function") {
					const oldValue = keyedFragments.get(fragment.key);
					if (oldValue !== undefined) {
						keyedFragments.set(fragment.key, fragment.merge(oldValue));
						continue;
					}
				}
				keyedFragments.set(fragment.key || Symbol(), fragment);
			}

			const concatSource = new ConcatSource();
			const endContents = [];
			for (let fragment of keyedFragments.values()) {
				if (Array.isArray(fragment)) {
					fragment = fragment[0].mergeAll(fragment);
				}
				concatSource.add(fragment.getContent(context));
				const endContent = fragment.getEndContent(context);
				if (endContent) {
					endContents.push(endContent);
				}
			}

			concatSource.add(source);
			for (const content of endContents.reverse()) {
				concatSource.add(content);
			}
			return concatSource;
		} else {
			return source;
		}
	}
}

InitFragment.prototype.merge = undefined;

InitFragment.STAGE_CONSTANTS = 10;
InitFragment.STAGE_ASYNC_BOUNDARY = 20;
InitFragment.STAGE_HARMONY_EXPORTS = 30;
InitFragment.STAGE_HARMONY_IMPORTS = 40;
InitFragment.STAGE_PROVIDES = 50;
InitFragment.STAGE_ASYNC_DEPENDENCIES = 60;
InitFragment.STAGE_ASYNC_HARMONY_IMPORTS = 70;

module.exports = InitFragment;
