var LoaderLoadingError = require("./LoaderLoadingError");
var url;

// 通过cjs或者esm的方式加载loader
module.exports = function loadLoader(loader, callback) {
	if(loader.type === "module") {
		// 1. 以esm的方式加载loader
		try {
			if(url === undefined) url = require("url");
			var loaderUrl = url.pathToFileURL(loader.path);
			// es6动态加载
			var modulePromise = eval("import(" + JSON.stringify(loaderUrl.toString()) + ")");
			modulePromise.then(function(module) {
				handleResult(loader, module, callback);
			}, callback);
			return;
		} catch(e) {
			callback(e);
		}
	} else {
		try {
			// 2. 通过cjs的方式加载loader
			var module = require(loader.path);
		} catch(e) {
			// it is possible for node to choke on a require if the FD descriptor
			// limit has been reached. give it a chance to recover.
			if(e instanceof Error && e.code === "EMFILE") {
				var retry = loadLoader.bind(null, loader, callback);
				if(typeof setImmediate === "function") {
					// node >= 0.9.0
					return setImmediate(retry);
				} else {
					// node < 0.9.0
					return process.nextTick(retry);
				}
			}
			return callback(e);
		}
		return handleResult(loader, module, callback);
	}
};

/**
 * 将加载loader的结果绑定loader上
 * 绑定 loader.normal loader.pitch loader.raw
 */
function handleResult(loader, module, callback) {
	// 该module是以es6或者cjs加载返回的结果
	if(typeof module !== "function" && typeof module !== "object") {
		return callback(new LoaderLoadingError(
			"Module '" + loader.path + "' is not a loader (export function or es6 module)"
		));
	}
	// 将 raw-data 处理的函数 手动绑定到 loader.normal
	loader.normal = typeof module === "function" ? module : module.default;
	loader.pitch = module.pitch;
	loader.raw = module.raw;
	// 保证loader.noraml和loader.pitch字段必须是函数
	if(typeof loader.normal !== "function" && typeof loader.pitch !== "function") {
		return callback(new LoaderLoadingError(
			"Module '" + loader.path + "' is not a loader (must have normal or pitch function)"
		));
	}
	callback();
}
