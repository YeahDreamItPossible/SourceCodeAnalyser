"use strict";

const AsyncDependenciesBlock = require("../AsyncDependenciesBlock");
const makeSerializable = require("../util/makeSerializable");

// CommonJS 依赖依赖块(异步依赖)
// 通过 webpack特有的 require.ensure 语法 引用的模块 
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
