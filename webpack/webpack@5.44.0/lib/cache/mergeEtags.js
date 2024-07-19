"use strict";

class MergedEtag {
	constructor(a, b) {
		this.a = a;
		this.b = b;
	}

	toString() {
		return `${this.a.toString()}|${this.b.toString()}`;
	}
}

const dualObjectMap = new WeakMap();
const objectStringMap = new WeakMap();

// 合并电子标签
const mergeEtags = (a, b) => {
	if (typeof a === "string") {
		if (typeof b === "string") {
			return `${a}|${b}`;
		} else {
			const temp = b;
			b = a;
			a = temp;
		}
	} else {
		if (typeof b !== "string") {
			// both a and b are objects
			let map = dualObjectMap.get(a);
			if (map === undefined) {
				dualObjectMap.set(a, (map = new WeakMap()));
			}
			const mergedEtag = map.get(b);
			if (mergedEtag === undefined) {
				const newMergedEtag = new MergedEtag(a, b);
				map.set(b, newMergedEtag);
				return newMergedEtag;
			} else {
				return mergedEtag;
			}
		}
	}
	// a is object, b is string
	let map = objectStringMap.get(a);
	if (map === undefined) {
		objectStringMap.set(a, (map = new Map()));
	}
	const mergedEtag = map.get(b);
	if (mergedEtag === undefined) {
		const newMergedEtag = new MergedEtag(a, b);
		map.set(b, newMergedEtag);
		return newMergedEtag;
	} else {
		return mergedEtag;
	}
};

module.exports = mergeEtags;
