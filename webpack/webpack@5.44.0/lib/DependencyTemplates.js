"use strict";

const createHash = require("./util/createHash");

// TODO:
// 
class DependencyTemplates {
	constructor() {
		// Map<DependencyConstructor, DependencyTemplate>
		this._map = new Map();
		// 
		this._hash = "31d6cfe0d16ae931b73c59d7e0c089c0";
	}

	get(dependency) {
		return this._map.get(dependency);
	}

	set(dependency, dependencyTemplate) {
		this._map.set(dependency, dependencyTemplate);
	}

	updateHash(part) {
		const hash = createHash("md4");
		hash.update(this._hash);
		hash.update(part);
		this._hash = /** @type {string} */ (hash.digest("hex"));
	}

	getHash() {
		return this._hash;
	}

	clone() {
		const newInstance = new DependencyTemplates();
		newInstance._map = new Map(this._map);
		newInstance._hash = this._hash;
		return newInstance;
	}
}

module.exports = DependencyTemplates;
