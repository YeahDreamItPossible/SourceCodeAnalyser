"use strict";

const { AsyncSeriesBailHook, AsyncSeriesHook, SyncHook } = require("tapable");
const createInnerContext = require("./createInnerContext");
const { parseIdentifier } = require("./util/identifier");
const {
	normalize,
	cachedJoin: join,
	getType,
	PathType
} = require("./util/path");

/**
 * @typedef {Object} FileSystemStats
 * @property {function(): boolean} isDirectory
 * @property {function(): boolean} isFile
 */

/**
 * @typedef {Object} FileSystemDirent
 * @property {Buffer | string} name
 * @property {function(): boolean} isDirectory
 * @property {function(): boolean} isFile
 */

/**
 * @typedef {Object} PossibleFileSystemError
 * @property {string=} code
 * @property {number=} errno
 * @property {string=} path
 * @property {string=} syscall
 */

/**
 * @template T
 * @callback FileSystemCallback
 * @param {PossibleFileSystemError & Error | null | undefined} err
 * @param {T=} result
 */

/**
 * @typedef {Object} FileSystem
 * @property {(function(string, FileSystemCallback<Buffer | string>): void) & function(string, object, FileSystemCallback<Buffer | string>): void} readFile
 * @property {(function(string, FileSystemCallback<(Buffer | string)[] | FileSystemDirent[]>): void) & function(string, object, FileSystemCallback<(Buffer | string)[] | FileSystemDirent[]>): void} readdir
 * @property {((function(string, FileSystemCallback<object>): void) & function(string, object, FileSystemCallback<object>): void)=} readJson
 * @property {(function(string, FileSystemCallback<Buffer | string>): void) & function(string, object, FileSystemCallback<Buffer | string>): void} readlink
 * @property {(function(string, FileSystemCallback<FileSystemStats>): void) & function(string, object, FileSystemCallback<Buffer | string>): void=} lstat
 * @property {(function(string, FileSystemCallback<FileSystemStats>): void) & function(string, object, FileSystemCallback<Buffer | string>): void} stat
 */

/**
 * @typedef {Object} SyncFileSystem
 * @property {function(string, object=): Buffer | string} readFileSync
 * @property {function(string, object=): (Buffer | string)[] | FileSystemDirent[]} readdirSync
 * @property {(function(string, object=): object)=} readJsonSync
 * @property {function(string, object=): Buffer | string} readlinkSync
 * @property {function(string, object=): FileSystemStats=} lstatSync
 * @property {function(string, object=): FileSystemStats} statSync
 */

/**
 * @typedef {Object} ParsedIdentifier
 * @property {string} request
 * @property {string} query
 * @property {string} fragment
 * @property {boolean} directory
 * @property {boolean} module
 * @property {boolean} file
 * @property {boolean} internal
 */

/**
 * @typedef {Object} BaseResolveRequest
 * @property {string | false} path
 * @property {string=} descriptionFilePath
 * @property {string=} descriptionFileRoot
 * @property {object=} descriptionFileData
 * @property {string=} relativePath
 * @property {boolean=} ignoreSymlinks
 * @property {boolean=} fullySpecified
 */

/** @typedef {BaseResolveRequest & Partial<ParsedIdentifier>} ResolveRequest */

/**
 * String with special formatting
 * @typedef {string} StackEntry
 */

/** @template T @typedef {{ add: (T) => void }} WriteOnlySet */

/**
 * Resolve context
 * @typedef {Object} ResolveContext
 * @property {WriteOnlySet<string>=} contextDependencies
 * @property {WriteOnlySet<string>=} fileDependencies files that was found on file system
 * @property {WriteOnlySet<string>=} missingDependencies dependencies that was not found on file system
 * @property {Set<StackEntry>=} stack set of hooks' calls. For instance, `resolve → parsedResolve → describedResolve`,
 * @property {(function(string): void)=} log log function
 */

/** @typedef {AsyncSeriesBailHook<[ResolveRequest, ResolveContext], ResolveRequest | null>} ResolveStepHook */


/**
 * 将(短横线连接的)字符串转换成小驼峰
 * 示例: hello-world => helloWorld 
 */
function toCamelCase(str) {
	return str.replace(/-([a-z])/g, str => str.substr(1).toUpperCase());
}

class Resolver {
	/**
	 * @param {ResolveStepHook} hook hook
	 * @param {ResolveRequest} request request
	 * @returns {StackEntry} stack entry
	 */
	static createStackEntry(hook, request) {
		return (
			hook.name +
			": (" +
			request.path +
			") " +
			(request.request || "") +
			(request.query || "") +
			(request.fragment || "") +
			(request.directory ? " directory" : "") +
			(request.module ? " module" : "")
		);
	}

	constructor(fileSystem, options) {
		this.fileSystem = fileSystem;
		this.options = options;
		this.hooks = {
			// 每执行一个插件都会调用
			/** @type {SyncHook<[ResolveStepHook, ResolveRequest], void>} */
			resolveStep: new SyncHook(["hook", "request"], "resolveStep"),
			// 没有找到具体文件或目录
			/** @type {SyncHook<[ResolveRequest, Error]>} */
			noResolve: new SyncHook(["request", "error"], "noResolve"),
			// 开始解析
			/** @type {ResolveStepHook} */
			resolve: new AsyncSeriesBailHook(
				["request", "resolveContext"],
				"resolve"
			),
			// 解析完成
			/** @type {AsyncSeriesHook<[ResolveRequest, ResolveContext]>} */
			result: new AsyncSeriesHook(["result", "resolveContext"], "result")
		};
	}

	// 根据 HookName 返回对应的 Hook
	// 如果 HookName 不存在 则创建 AsyncSeriesBailHook 的实例并返回
	ensureHook(name) {
		if (typeof name !== "string") {
			return name;
		}
		name = toCamelCase(name);
		if (/^before/.test(name)) {
			return /** @type {ResolveStepHook} */ (this.ensureHook(
				name[6].toLowerCase() + name.substr(7)
			).withOptions({
				stage: -10
			}));
		}
		if (/^after/.test(name)) {
			return /** @type {ResolveStepHook} */ (this.ensureHook(
				name[5].toLowerCase() + name.substr(6)
			).withOptions({
				stage: 10
			}));
		}
		const hook = this.hooks[name];
		if (!hook) {
			return (this.hooks[name] = new AsyncSeriesBailHook(
				["request", "resolveContext"],
				name
			));
		}
		return hook;
	}

	/**
	 * @param {string | ResolveStepHook} name hook name or hook itself
	 * @returns {ResolveStepHook} the hook
	 */
	// 根据 HookName 或者 Hook 返回对应的 Hook
	getHook(name) {
		if (typeof name !== "string") {
			return name;
		}
		name = toCamelCase(name);
		if (/^before/.test(name)) {
			return /** @type {ResolveStepHook} */ (this.getHook(
				name[6].toLowerCase() + name.substr(7)
			).withOptions({
				stage: -10
			}));
		}
		if (/^after/.test(name)) {
			return /** @type {ResolveStepHook} */ (this.getHook(
				name[5].toLowerCase() + name.substr(6)
			).withOptions({
				stage: 10
			}));
		}
		const hook = this.hooks[name];
		if (!hook) {
			throw new Error(`Hook ${name} doesn't exist`);
		}
		return hook;
	}

	/**
	 * @param {object} context context information object
	 * @param {string} path context path
	 * @param {string} request request string
	 * @returns {string | false} result
	 */
	resolveSync(context, path, request) {
		/** @type {Error | null | undefined} */
		let err = undefined;
		/** @type {string | false | undefined} */
		let result = undefined;
		let sync = false;
		this.resolve(context, path, request, {}, (e, r) => {
			err = e;
			result = r;
			sync = true;
		});
		if (!sync) {
			throw new Error(
				"Cannot 'resolveSync' because the fileSystem is not sync. Use 'resolve'!"
			);
		}
		if (err) throw err;
		if (result === undefined) throw new Error("No result");
		return result;
	}

	/**
	 * @param {object} context context information object
	 * @param {string} path context path
	 * @param {string} request request string
	 * @param {ResolveContext} resolveContext resolve context
	 * @param {function(Error | null, (string|false)=, ResolveRequest=): void} callback callback function
	 * @returns {void}
	 */
	// 根据 上下文 和 路径 返回绝对路径
	resolve(context, path, request, resolveContext, callback) {
		if (!context || typeof context !== "object")
			return callback(new Error("context argument is not an object"));
		if (typeof path !== "string")
			return callback(new Error("path argument is not a string"));
		if (typeof request !== "string")
			return callback(new Error("path argument is not a string"));
		if (!resolveContext)
			return callback(new Error("resolveContext argument is not set"));

		const obj = {
			context: context,
			path: path,
			request: request
		};

		const message = `resolve '${request}' in '${path}'`;

		const finishResolved = result => {
			return callback(
				null,
				result.path === false
					? false
					: `${result.path.replace(/#/g, "\0#")}${
							result.query ? result.query.replace(/#/g, "\0#") : ""
					  }${result.fragment || ""}`,
				result
			);
		};

		const finishWithoutResolve = log => {
			/**
			 * @type {Error & {details?: string}}
			 */
			const error = new Error("Can't " + message);
			error.details = log.join("\n");
			this.hooks.noResolve.call(obj, error);
			return callback(error);
		};

		if (resolveContext.log) {
			// We need log anyway to capture it in case of an error
			const parentLog = resolveContext.log;
			const log = [];
			return this.doResolve(
				this.hooks.resolve,
				obj,
				message,
				{
					log: msg => {
						parentLog(msg);
						log.push(msg);
					},
					fileDependencies: resolveContext.fileDependencies,
					contextDependencies: resolveContext.contextDependencies,
					missingDependencies: resolveContext.missingDependencies,
					stack: resolveContext.stack
				},
				(err, result) => {
					if (err) return callback(err);

					if (result) return finishResolved(result);

					return finishWithoutResolve(log);
				}
			);
		} else {
			// Try to resolve assuming there is no error
			// We don't log stuff in this case
			return this.doResolve(
				this.hooks.resolve,
				obj,
				message,
				{
					log: undefined,
					fileDependencies: resolveContext.fileDependencies,
					contextDependencies: resolveContext.contextDependencies,
					missingDependencies: resolveContext.missingDependencies,
					stack: resolveContext.stack
				},
				(err, result) => {
					if (err) return callback(err);

					if (result) return finishResolved(result);

					// log is missing for the error details
					// so we redo the resolving for the log info
					// this is more expensive to the success case
					// is assumed by default

					const log = [];

					return this.doResolve(
						this.hooks.resolve,
						obj,
						message,
						{
							log: msg => log.push(msg),
							stack: resolveContext.stack
						},
						(err, result) => {
							if (err) return callback(err);

							return finishWithoutResolve(log);
						}
					);
				}
			);
		}
	}

	doResolve(hook, request, message, resolveContext, callback) {
		const stackEntry = Resolver.createStackEntry(hook, request);

		let newStack;
		if (resolveContext.stack) {
			newStack = new Set(resolveContext.stack);
			if (resolveContext.stack.has(stackEntry)) {
				/**
				 * Prevent recursion
				 * @type {Error & {recursion?: boolean}}
				 */
				const recursionError = new Error(
					"Recursion in resolving\nStack:\n  " +
						Array.from(newStack).join("\n  ")
				);
				recursionError.recursion = true;
				if (resolveContext.log)
					resolveContext.log("abort resolving because of recursion");
				return callback(recursionError);
			}
			newStack.add(stackEntry);
		} else {
			newStack = new Set([stackEntry]);
		}

		// 空调用
		this.hooks.resolveStep.call(hook, request);

		if (hook.isUsed()) {
			const innerContext = createInnerContext(
				{
					log: resolveContext.log,
					fileDependencies: resolveContext.fileDependencies,
					contextDependencies: resolveContext.contextDependencies,
					missingDependencies: resolveContext.missingDependencies,
					stack: newStack
				},
				message
			);

			// ParsePlugin
			// 主要调用resolver.parse
			// DescriptionFilePlugin
			//
			return hook.callAsync(request, innerContext, (err, result) => {
				if (err) return callback(err);
				if (result) return callback(null, result);
				callback();
			});
		} else {
			callback();
		}
	}

	/**
	 * @param {string} identifier identifier
	 * @returns {ParsedIdentifier} parsed identifier
	 */
	// 根据 路径 返回解析后的
	parse(identifier) {
		const part = {
			request: "",
			query: "",
			fragment: "",
			module: false,
			directory: false,
			file: false,
			internal: false
		};

		const parsedIdentifier = parseIdentifier(identifier);

		if (!parsedIdentifier) return part;

		[part.request, part.query, part.fragment] = parsedIdentifier;

		if (part.request.length > 0) {
			part.internal = this.isPrivate(identifier);
			part.module = this.isModule(part.request);
			part.directory = this.isDirectory(part.request);
			if (part.directory) {
				part.request = part.request.substr(0, part.request.length - 1);
			}
		}

		return part;
	}

	// 断言: 是否是模块
	isModule(path) {
		return getType(path) === PathType.Normal;
	}

	// 断言: 是否是代码片段
	isPrivate(path) {
		return getType(path) === PathType.Internal;
	}

	// 断言: 是否是目录
	isDirectory(path) {
		return path.endsWith("/");
	}

	// 连接路径
	join(path, request) {
		return join(path, request);
	}

	// 标准化路径
	normalize(path) {
		return normalize(path);
	}
}

module.exports = Resolver;
