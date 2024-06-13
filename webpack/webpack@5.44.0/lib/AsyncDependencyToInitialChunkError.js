"use strict";

const WebpackError = require("./WebpackError");

// 异步依赖初始块错误
class AsyncDependencyToInitialChunkError extends WebpackError {
	constructor(chunkName, module, loc) {
		super(
			`It's not allowed to load an initial chunk on demand. The chunk name "${chunkName}" is already used by an entrypoint.`
		);

		this.name = "AsyncDependencyToInitialChunkError";
		this.module = module;
		this.loc = loc;
	}
}

module.exports = AsyncDependencyToInitialChunkError;
