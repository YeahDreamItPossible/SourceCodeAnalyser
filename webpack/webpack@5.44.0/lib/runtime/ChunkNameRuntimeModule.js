"use strict";

const RuntimeGlobals = require("../RuntimeGlobals");
const RuntimeModule = require("../RuntimeModule");

// 运行时模块之设置块名
// __webpack_require__.cn
// 作用:
//
class ChunkNameRuntimeModule extends RuntimeModule {
	constructor(chunkName) {
		super("chunkName");
		this.chunkName = chunkName;
	}

	// __webpack_require__.cn
	generate() {
		return `${RuntimeGlobals.chunkName} = ${JSON.stringify(this.chunkName)};`;
	}
}

module.exports = ChunkNameRuntimeModule;


// 生成代码示例:
(() => {
	__webpack_require__.cn = "app"
})()