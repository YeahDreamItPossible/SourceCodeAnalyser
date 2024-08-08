var fs = require("fs");
var readFile = fs.readFile.bind(fs);
var loadLoader = require("./loadLoader");

function utf8BufferToString(buf) {
	var str = buf.toString("utf-8");
	if(str.charCodeAt(0) === 0xFEFF) {
		return str.substr(1);
	} else {
		return str;
	}
}

const PATH_QUERY_FRAGMENT_REGEXP = /^((?:\0.|[^?#\0])*)(\?(?:\0.|[^#\0])*)?(#.*)?$/;

/**
 * @param {string} str the path with query and fragment
 * @returns {{ path: string, query: string, fragment: string }} parsed parts
 */
function parsePathQueryFragment(str) {
	var match = PATH_QUERY_FRAGMENT_REGEXP.exec(str);
	return {
		path: match[1].replace(/\0(.)/g, "$1"),
		query: match[2] ? match[2].replace(/\0(.)/g, "$1") : "",
		fragment: match[3] || ""
	};
}

function dirname(path) {
	if(path === "/") return "/";
	var i = path.lastIndexOf("/");
	var j = path.lastIndexOf("\\");
	var i2 = path.indexOf("/");
	var j2 = path.indexOf("\\");
	var idx = i > j ? i : j;
	var idx2 = i > j ? i2 : j2;
	if(idx < 0) return path;
	if(idx === idx2) return path.substr(0, idx + 1);
	return path.substr(0, idx);
}

// loader数据类型标准化
function createLoaderObject(loader) {
	var obj = {
		path: null,
		query: null,
		fragment: null,
		options: null,
		ident: null,
		normal: null, // loader函数
		pitch: null, // pitch函数
		raw: null,  // raw
		data: null,
		pitchExecuted: false,
		normalExecuted: false
	};
	Object.defineProperty(obj, "request", {
		enumerable: true,
		get: function() {
			return obj.path.replace(/#/g, "\0#") + obj.query.replace(/#/g, "\0#") + obj.fragment;
		},
		set: function(value) {
			if(typeof value === "string") {
				var splittedRequest = parsePathQueryFragment(value);
				obj.path = splittedRequest.path;
				obj.query = splittedRequest.query;
				obj.fragment = splittedRequest.fragment;
				obj.options = undefined;
				obj.ident = undefined;
			} else {
				if(!value.loader)
					throw new Error("request should be a string or object with loader and options (" + JSON.stringify(value) + ")");
				obj.path = value.loader;
				obj.fragment = value.fragment || "";
				obj.type = value.type;
				obj.options = value.options;
				obj.ident = value.ident;
				if(obj.options === null)
					obj.query = "";
				else if(obj.options === undefined)
					obj.query = "";
				else if(typeof obj.options === "string")
					obj.query = "?" + obj.options;
				else if(obj.ident)
					obj.query = "??" + obj.ident;
				else if(typeof obj.options === "object" && obj.options.ident)
					obj.query = "??" + obj.options.ident;
				else
					obj.query = "?" + JSON.stringify(obj.options);
			}
		}
	});
	obj.request = loader;
	if(Object.preventExtensions) {
		Object.preventExtensions(obj);
	}
	return obj;
}

/**
 * 以同步或者异步的方式运行fn(loader.pitch || loader.normal)
 * 并将fn的运行结果作为参数传递到callback 
 */
function runSyncOrAsync(fn, context, args, callback) {
	// 标识: fn运行过程是同步运行
	var isSync = true;
	// 标识: fn是否已经被运行
	var isDone = false;
	// 标识: fn运行是否有报错
	var isError = false; // internal error
	var reportedError = false;

	/**
	 * 在loader运行时 
	 * 重载loaderContext.async和loaderContext.callback
	 * 是为了获取当前loader运行的方式(同步or异步)
	 * 即: 当运行loader时 如果调用loaderContext.async或者loaderContext.callback时
	 * 会动态标记当前loader 处理类型为 isSync = false
	 */
	context.async = function async() {
		if(isDone) {
			if(reportedError) return; // ignore
			throw new Error("async(): The callback was already called.");
		}
		// 标识当前loader运行的方式是异步的
		isSync = false;
		return innerCallback;
	};
	var innerCallback = context.callback = function() {
		if(isDone) {
			if(reportedError) return; // ignore
			throw new Error("callback(): The callback was already called.");
		}
		// 标识当前fn已经被运行
		isDone = true;
		// 标识当前loader运行的方式是异步的
		isSync = false;
		try {
			callback.apply(null, arguments);
		} catch(e) {
			isError = true;
			throw e;
		}
	};
	try {
		var result = (function LOADER_EXECUTION() {
			// 调用 loader.normal || loader.pitch
			return fn.apply(context, args);
		}());

		// 以同步的方式调用loader
		if(isSync) {
			isDone = true;
			if(result === undefined)
				return callback();
			if(result && typeof result === "object" && typeof result.then === "function") {
				return result.then(function(r) {
					callback(null, r);
				}, callback);
			}
			return callback(null, result);
		}
	} catch(e) {
		if(isError) throw e;
		if(isDone) {
			// loader is already "done", so we cannot use the callback function
			// for better debugging we print the error on the console
			if(typeof e === "object" && e.stack) console.error(e.stack);
			else console.error(e);
			return;
		}
		isDone = true;
		reportedError = true;
		callback(e);
	}
}

// 转换 loader.normal 返回值
function convertArgs(args, raw) {
	if(!raw && Buffer.isBuffer(args[0]))
		args[0] = utf8BufferToString(args[0]);
	else if(raw && typeof args[0] === "string")
		args[0] = Buffer.from(args[0], "utf-8");
}

// 迭代 准备阶段时的 加载器 
// 如果某个 loader.pitch 函数有返回值时 准备阶段 结束(开始执行阶段)
// loader.pitch 主要是通过读取 loaderContext.remainingReques t和 loaderContext.previousRequest 来修改 loaderContext.data
function iteratePitchingLoaders(options, loaderContext, callback) {
	// 当 索引超出加载器的长度 时 准备阶段 结束 开始执行阶段
	if(loaderContext.loaderIndex >= loaderContext.loaders.length)
		return processResource(options, loaderContext, callback);

	var currentLoaderObject = loaderContext.loaders[loaderContext.loaderIndex];

	// 如果 当前loader.pitch 已经被运行 则继续下一个加载器
	if(currentLoaderObject.pitchExecuted) {
		loaderContext.loaderIndex++;
		return iteratePitchingLoaders(options, loaderContext, callback);
	}

	// 加载 加载器 并运行 loader.pitch
	loadLoader(currentLoaderObject, function(err) {
		if(err) {
			loaderContext.cacheable(false);
			return callback(err);
		}
		var fn = currentLoaderObject.pitch;

		// 标识: 标识当前 loader.pitch 已经被运行
		currentLoaderObject.pitchExecuted = true;
		// 如果当前 loader.pitch 不存在时 则直接迭代下一个加载器
		if(!fn) return iteratePitchingLoaders(options, loaderContext, callback);

		runSyncOrAsync(
			fn,
			loaderContext, 
			[loaderContext.remainingRequest, loaderContext.previousRequest, currentLoaderObject.data = {}],
			function(err) {
				if(err) return callback(err);
				var args = Array.prototype.slice.call(arguments, 1);
				
				// 筛选
				var hasArg = args.some(function(value) {
					return value !== undefined;
				});

				if(hasArg) {
					// 当 loader.pitch 函数有返回值时 准备阶段 结束(开始执行阶段)
					loaderContext.loaderIndex--;
					iterateNormalLoaders(options, loaderContext, args, callback);
				} else {
					// 继续下一个加载器
					iteratePitchingLoaders(options, loaderContext, callback);
				}
			}
		);
	});
}

function processResource(options, loaderContext, callback) {
	// 重设loaderContext.loaderIndex 指向最后一个loader 
	loaderContext.loaderIndex = loaderContext.loaders.length - 1;

	var resourcePath = loaderContext.resourcePath;
	if(resourcePath) {
		// 根据资源路径加载对应的资源
		options.processResource(loaderContext, resourcePath, function(err, buffer) {
			if(err) return callback(err);
			// 该buffer是根据资源路径加载后的资源
			options.resourceBuffer = buffer;
			iterateNormalLoaders(options, loaderContext, [buffer], callback);
		});
	} else {
		iterateNormalLoaders(options, loaderContext, [null], callback);
	}
}

// 迭代 执行阶段时的 加载器 
function iterateNormalLoaders(options, loaderContext, args, callback) {
	if(loaderContext.loaderIndex < 0)
		return callback(null, args);

	var currentLoaderObject = loaderContext.loaders[loaderContext.loaderIndex];

	// 如果 当前loader.normal 已经被运行 则继续下一个加载器
	if(currentLoaderObject.normalExecuted) {
		loaderContext.loaderIndex--;
		return iterateNormalLoaders(options, loaderContext, args, callback);
	}

	var fn = currentLoaderObject.normal;
	// 标识: 标识 当前loader.normal 已经被运行
	currentLoaderObject.normalExecuted = true;
	// 如果当前 loader.normal 不存在时 则直接迭代下一个加载器
	if(!fn) {
		return iterateNormalLoaders(options, loaderContext, args, callback);
	}

	// loader.normal 返回值默认是 Buffer
	// loader.raw = true时 会强制将该返回值转换成 String
	convertArgs(args, currentLoaderObject.raw);

	runSyncOrAsync(fn, loaderContext, args, function(err) {
		if(err) return callback(err);

		var args = Array.prototype.slice.call(arguments, 1);
		// 默认将 上一个loader.noraml的返回值 传递个 下一个loader.normal
		iterateNormalLoaders(options, loaderContext, args, callback);
	});
}

// 根据资源路径来获取context
exports.getContext = function getContext(resource) {
	var path = parsePathQueryFragment(resource).path;
	return dirname(path);
};

/**
 * 加载器属性描述:
 * loader.normal:
 * 指向loader函数
 * loader.pitch:
 * 通过读取 loaderContext.remainingReques t和 loaderContext.previousRequest 来修改 loaderContext.data
 * 如果某个 loader.pitch 函数有返回值时 准备阶段 结束(开始执行阶段)
 * 并将 返回值 作为 loader.normal 的参数
 * loader.raw:
 * 表示是需要将loader.normal返回值 从 Buffer 转换成 String
 */

/**
 * 单个 加载器 整个运行周期分为 加载阶段 和 准备阶段 和 执行阶段
 * 
 * 1. 加载阶段
 * 在 加载阶段 中
 * 优先以 cjs 的方式(require)加载 加载器 因为该加载方式是 同步 的
 * 其次以 esm 的方式(dynamic import)加载 加载器 因为该加载方式是 异步 的 
 * 
 * 2. 准备阶段(pitch)
 * 按照 从左到右 的顺序 依次 运行每个 loader.pitch 
 * 如果某个 loader.pitch 有返回值时 准备阶段结束 开始执行阶段
 * 
 * 3. 执行阶段(normal)
 * 按照 从右到左 的顺序 依次 执行每个 loader.normal
 * 每次运行 loader.normal 时 会将 上一个loader.normal的返回值 作为 下一个loader.normal 的参数
 */

/**
 * 加载器的执行顺序:
 * 在 准备阶段 时 是按照 从左到右 依次执行
 * 在 执行阶段 是 是按照 从左到左 依次执行
 */


// 运行所有的loaders
exports.runLoaders = function runLoaders(options, callback) {
	// read options
	var resource = options.resource || "";
	var loaders = options.loaders || [];
	var loaderContext = options.context || {};
	var processResource = options.processResource || ((readResource, context, resource, callback) => {
		context.addDependency(resource);
		readResource(resource, callback);
	}).bind(null, options.readResource || readFile);

	//
	var splittedResource = resource && parsePathQueryFragment(resource);
	var resourcePath = splittedResource ? splittedResource.path : undefined;
	var resourceQuery = splittedResource ? splittedResource.query : undefined;
	var resourceFragment = splittedResource ? splittedResource.fragment : undefined;
	var contextDirectory = resourcePath ? dirname(resourcePath) : null;

	/**
	 * execution state
	 * 设置是否可缓存标志的状态
	 * 默认情况下，loader 的处理结果会被标记为可缓存
	 */
	var requestCacheable = true;
	var fileDependencies = [];
	var contextDependencies = [];
	var missingDependencies = [];

	// loaders: [{ loader: String, options: Object, ident: String }]
	// loader数据类型标准化
	loaders = loaders.map(createLoaderObject);

	// 扩展 loaderContext
	loaderContext.context = contextDirectory;
	// 索引
	loaderContext.loaderIndex = 0;
	loaderContext.loaders = loaders;
	loaderContext.resourcePath = resourcePath;
	loaderContext.resourceQuery = resourceQuery;
	loaderContext.resourceFragment = resourceFragment;
	loaderContext.async = null;
	loaderContext.callback = null;
	// 默认情况下，loader 的处理结果会被标记为可缓存
	// 调用这个方法然后传入 false，可以关闭 loader 处理结果的缓存能力
	loaderContext.cacheable = function cacheable(flag) {
		if(flag === false) {
			requestCacheable = false;
		}
	};
	loaderContext.dependency = loaderContext.addDependency = function addDependency(file) {
		fileDependencies.push(file);
	};
	loaderContext.addContextDependency = function addContextDependency(context) {
		contextDependencies.push(context);
	};
	loaderContext.addMissingDependency = function addMissingDependency(context) {
		missingDependencies.push(context);
	};
	loaderContext.getDependencies = function getDependencies() {
		return fileDependencies.slice();
	};
	loaderContext.getContextDependencies = function getContextDependencies() {
		return contextDependencies.slice();
	};
	loaderContext.getMissingDependencies = function getMissingDependencies() {
		return missingDependencies.slice();
	};
	loaderContext.clearDependencies = function clearDependencies() {
		fileDependencies.length = 0;
		contextDependencies.length = 0;
		missingDependencies.length = 0;
		requestCacheable = true;
	};
	/**
	 * 资源路径
	 * request 中的资源部分，包括 query 参数
	 * 如: /abc/resource.js?rrr
	 */
	Object.defineProperty(loaderContext, "resource", {
		enumerable: true,
		get: function() {
			if(loaderContext.resourcePath === undefined)
				return undefined;
			return loaderContext.resourcePath.replace(/#/g, "\0#") + loaderContext.resourceQuery.replace(/#/g, "\0#") + loaderContext.resourceFragment;
		},
		set: function(value) {
			var splittedResource = value && parsePathQueryFragment(value);
			loaderContext.resourcePath = splittedResource ? splittedResource.path : undefined;
			loaderContext.resourceQuery = splittedResource ? splittedResource.query : undefined;
			loaderContext.resourceFragment = splittedResource ? splittedResource.fragment : undefined;
		}
	});
	/**
	 * 被解析后的资源路径(包括loader路径和资源路径)
	 * 如: '/abc/loader1.js?xyz!/abc/node_modules/loader2/index.js!/abc/resource.js?rrr'
	 */
	Object.defineProperty(loaderContext, "request", {
		enumerable: true,
		get: function() {
			return loaderContext.loaders.map(function(o) {
				return o.request;
			}).concat(loaderContext.resource || "").join("!");
		}
	});
	// 被解析后的资源路径(包括loader路径和资源路径)
	// 但是该资源路径不包括已经被解析的loader路径
	Object.defineProperty(loaderContext, "remainingRequest", {
		enumerable: true,
		get: function() {
			if(loaderContext.loaderIndex >= loaderContext.loaders.length - 1 && !loaderContext.resource)
				return "";
			return loaderContext.loaders.slice(loaderContext.loaderIndex + 1).map(function(o) {
				return o.request;
			}).concat(loaderContext.resource || "").join("!");
		}
	});
	// 
	Object.defineProperty(loaderContext, "currentRequest", {
		enumerable: true,
		get: function() {
			return loaderContext.loaders.slice(loaderContext.loaderIndex).map(function(o) {
				return o.request;
			}).concat(loaderContext.resource || "").join("!");
		}
	});
	// 
	Object.defineProperty(loaderContext, "previousRequest", {
		enumerable: true,
		get: function() {
			return loaderContext.loaders.slice(0, loaderContext.loaderIndex).map(function(o) {
				return o.request;
			}).join("!");
		}
	});
	Object.defineProperty(loaderContext, "query", {
		enumerable: true,
		get: function() {
			var entry = loaderContext.loaders[loaderContext.loaderIndex];
			return entry.options && typeof entry.options === "object" ? entry.options : entry.query;
		}
	});
	// 
	Object.defineProperty(loaderContext, "data", {
		enumerable: true,
		get: function() {
			return loaderContext.loaders[loaderContext.loaderIndex].data;
		}
	});

	// 阻止loaderContext功能扩展
	if(Object.preventExtensions) {
		Object.preventExtensions(loaderContext);
	}

	var processOptions = {
		resourceBuffer: null,
		processResource: processResource
	};
	iteratePitchingLoaders(processOptions, loaderContext, function(err, result) {
		if(err) {
			return callback(err, {
				cacheable: requestCacheable,
				fileDependencies: fileDependencies,
				contextDependencies: contextDependencies,
				missingDependencies: missingDependencies
			});
		}
		// 当 loader 处理后的结果
		callback(null, {
			result: result,
			resourceBuffer: processOptions.resourceBuffer,
			cacheable: requestCacheable,
			fileDependencies: fileDependencies,
			contextDependencies: contextDependencies,
			missingDependencies: missingDependencies
		});
	});
};
