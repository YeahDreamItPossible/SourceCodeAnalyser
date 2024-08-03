"use strict";

const AsyncDependenciesBlock = require("../AsyncDependenciesBlock");
const makeSerializable = require("../util/makeSerializable");

// AMD 异步依赖块
// 作用:
// 
class AMDRequireDependenciesBlock extends AsyncDependenciesBlock {
	constructor(loc, request) {
		super(null, loc, request);
	}
}

makeSerializable(
	AMDRequireDependenciesBlock,
	"webpack/lib/dependencies/AMDRequireDependenciesBlock"
);

module.exports = AMDRequireDependenciesBlock;
