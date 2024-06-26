"use strict";

const AsyncDependenciesBlock = require("../AsyncDependenciesBlock");
const makeSerializable = require("../util/makeSerializable");

// 
class RequireEnsureDependenciesBlock extends AsyncDependenciesBlock {
	constructor(chunkName, loc) {
		super(chunkName, loc, null);
	}
}

makeSerializable(
	RequireEnsureDependenciesBlock,
	"webpack/lib/dependencies/RequireEnsureDependenciesBlock"
);

module.exports = RequireEnsureDependenciesBlock;
