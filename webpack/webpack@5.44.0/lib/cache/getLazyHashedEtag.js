"use strict";

const createHash = require("../util/createHash");

class LazyHashedEtag {
	constructor(obj) {
		this._obj = obj;
		this._hash = undefined;
	}

	toString() {
		if (this._hash === undefined) {
			const hash = createHash("md4");
			this._obj.updateHash(hash);
			this._hash = /** @type {string} */ (hash.digest("base64"));
		}
		return this._hash;
	}
}

// WeakMap<HashableObject, LazyHashedEtag>
const map = new WeakMap();

const getter = obj => {
	const hash = map.get(obj);
	if (hash !== undefined) return hash;
	const newHash = new LazyHashedEtag(obj);
	map.set(obj, newHash);
	return newHash;
};

module.exports = getter;
