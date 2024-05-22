"use strict";

const util = require("util");
const ExportsInfo = require("./ExportsInfo");
const ModuleGraphConnection = require("./ModuleGraphConnection");
const SortableSet = require("./util/SortableSet");
const WeakTupleMap = require("./util/WeakTupleMap");

/** @typedef {import("./DependenciesBlock")} DependenciesBlock */
/** @typedef {import("./Dependency")} Dependency */
/** @typedef {import("./ExportsInfo").ExportInfo} ExportInfo */
/** @typedef {import("./Module")} Module */
/** @typedef {import("./ModuleProfile")} ModuleProfile */
/** @typedef {import("./RequestShortener")} RequestShortener */
/** @typedef {import("./util/runtime").RuntimeSpec} RuntimeSpec */

/**
 * @callback OptimizationBailoutFunction
 * @param {RequestShortener} requestShortener
 * @returns {string}
 */

const EMPTY_SET = new Set();

/**
 * @param {SortableSet<ModuleGraphConnection>} set input
 * @returns {readonly Map<Module, readonly ModuleGraphConnection[]>} mapped by origin module
 */
const getConnectionsByOriginModule = set => {
	const map = new Map();
	/** @type {Module | 0} */
	let lastModule = 0;
	/** @type {ModuleGraphConnection[]} */
	let lastList = undefined;
	for (const connection of set) {
		const { originModule } = connection;
		if (lastModule === originModule) {
			lastList.push(connection);
		} else {
			lastModule = originModule;
			const list = map.get(originModule);
			if (list !== undefined) {
				lastList = list;
				list.push(connection);
			} else {
				const list = [connection];
				lastList = list;
				map.set(originModule, list);
			}
		}
	}
	return map;
};


/**
 * 描述模块间的引用关系
 * 当前Module 与 被它引用的子Modules
 * 当前Module 与 引用它的父Modules
 */
class ModuleGraphModule {
	constructor() {
		// 存放 ModuleGraphConnection
		// 引用 当前Module 的 ModuleGraphConnection
		this.incomingConnections = new SortableSet();

		// 存放 ModuleGraphConnection
		// 当前Module 引用的 ModuleGraphConnection
		this.outgoingConnections = undefined;

		// 父模块
		this.issuer = undefined;

		/** @type {(string | OptimizationBailoutFunction)[]} */
		this.optimizationBailout = [];
		// 导出信息
		// exports<ExportsInfo>
		this.exports = new ExportsInfo();

		//
		/** @type {number} */
		this.preOrderIndex = null;
		/** @type {number} */
		this.postOrderIndex = null;

		// 深度
		// depth<Number>
		this.depth = null;
		// 性能分析
		// profile<ModuleProfile>
		this.profile = undefined;
		// 标识: 当前模块是异步模块
		this.async = false;
	}
}

/**
 * 模块图
 * Module 与 Dependency 的引用关系
 * Module 与 Module 的引用关系
 */
class ModuleGraph {
	constructor() {
		// 记录入口dependency与module连接关系的信息
		/** @type {Map<Dependency, ModuleGraphConnection>} */
		this._dependencyMap = new Map();
		// 记录当前module被谁引用以及引用了谁
		/** @type {Map<Module, ModuleGraphModule>} */
		this._moduleMap = new Map();
		// 好像没啥卵用(全局搜索未发现使用)?!
		/** @type {Map<Module, Set<ModuleGraphConnection>>} */
		this._originMap = new Map();

		/** @type {Map<any, Object>} */
		this._metaMap = new Map();

		// Caching
		this._cacheModuleGraphModuleKey1 = undefined;
		this._cacheModuleGraphModuleValue1 = undefined;
		this._cacheModuleGraphModuleKey2 = undefined;
		this._cacheModuleGraphModuleValue2 = undefined;
		this._cacheModuleGraphDependencyKey = undefined;
		this._cacheModuleGraphDependencyValue = undefined;

		/** @type {WeakTupleMap<any[], any>} */
		this._cache = undefined;
	}

	// 根据 Module 来返回 ModuleGraphModule
	_getModuleGraphModule(module) {
		if (this._cacheModuleGraphModuleKey1 === module)
			return this._cacheModuleGraphModuleValue1;
		if (this._cacheModuleGraphModuleKey2 === module)
			return this._cacheModuleGraphModuleValue2;
		let mgm = this._moduleMap.get(module);
		if (mgm === undefined) {
			mgm = new ModuleGraphModule();
			this._moduleMap.set(module, mgm);
		}
		this._cacheModuleGraphModuleKey2 = this._cacheModuleGraphModuleKey1;
		this._cacheModuleGraphModuleValue2 = this._cacheModuleGraphModuleValue1;
		this._cacheModuleGraphModuleKey1 = module;
		this._cacheModuleGraphModuleValue1 = mgm;
		return mgm;
	}

	// 设置dependency的父module 和 父dependenciesBlock
	// Dependency._parentModule  
	// Dependency.__parentDependenciesBlock
	setParents(dependency, block, module) {
		dependency._parentDependenciesBlock = block;
		dependency._parentModule = module;
	}

	// 返回 Dependency._parentModule
	getParentModule(dependency) {
		return dependency._parentModule;
	}

	// 返回 Dependency._parentDependenciesBlock
	getParentBlock(dependency) {
		return dependency._parentDependenciesBlock;
	}

	/**
	 * 构建模块间的引用关系
	 * 1. 构建 Module 与 Dependency 的引用关系
	 * 2. 构建 Module 与 Module 的引用关系
	 */
	setResolvedModule(originModule, dependency, module) {
		const connection = new ModuleGraphConnection(
			originModule,
			dependency,
			module,
			undefined,
			dependency.weak,
			dependency.getCondition(this)
		);
		// Dependency => ModuleGraphConnection
		this._dependencyMap.set(dependency, connection);

		// Module => ModuleGraphModule
		const connections = this._getModuleGraphModule(module).incomingConnections;
		connections.add(connection);
		const mgm = this._getModuleGraphModule(originModule);
		if (mgm.outgoingConnections === undefined) {
			mgm.outgoingConnections = new Set();
		}

		mgm.outgoingConnections.add(connection);
	}

	/**
	 * @param {Dependency} dependency the referencing dependency
	 * @param {Module} module the referenced module
	 * @returns {void}
	 */
	// 更新缓存中的 Module
	// 更新 ModuleGraphConnection
	updateModule(dependency, module) {
		const connection = this._dependencyMap.get(dependency);
		if (connection.module === module) return;
		const newConnection = connection.clone();
		newConnection.module = module;
		this._dependencyMap.set(dependency, newConnection);
		connection.setActive(false);
		const originMgm = this._getModuleGraphModule(connection.originModule);
		originMgm.outgoingConnections.add(newConnection);
		const targetMgm = this._getModuleGraphModule(module);
		targetMgm.incomingConnections.add(newConnection);
	}

	// 根据 Dependency 移除对应 ModuleGraphConnection
	removeConnection(dependency) {
		// 根据 Dependency 找到对应的 ModuleGraphConnection
		const connection = this._dependencyMap.get(dependency);
		// 根据 Modulde 找到对应的 ModuleGraphModule
		const targetMgm = this._getModuleGraphModule(connection.module);
		// 移除 ModuleGraphModule 中的 Module
		targetMgm.incomingConnections.delete(connection);
		// 根据 Modulde 找到对应的 ModuleGraphModule
		const originMgm = this._getModuleGraphModule(connection.originModule);
		// 移除 ModuleGraphModule 中的 Module
		originMgm.outgoingConnections.delete(connection);
		// 根据 Dependency 移除对应 ModuleGraphConnection
		this._dependencyMap.delete(dependency);
	}
	
	// 给 ModuleGraphConnection 添加解释
	addExplanation(dependency, explanation) {
		// 根据 Dependency 找到对应 ModuleGraphConnection
		const connection = this._dependencyMap.get(dependency);
		// 给 ModuleGraphConnection 添加解释
		connection.addExplanation(explanation);
	}

	/**
	 * @param {Module} sourceModule the source module
	 * @param {Module} targetModule the target module
	 * @returns {void}
	 */
	cloneModuleAttributes(sourceModule, targetModule) {
		const oldMgm = this._getModuleGraphModule(sourceModule);
		const newMgm = this._getModuleGraphModule(targetModule);
		newMgm.postOrderIndex = oldMgm.postOrderIndex;
		newMgm.preOrderIndex = oldMgm.preOrderIndex;
		newMgm.depth = oldMgm.depth;
		newMgm.exports = oldMgm.exports;
		newMgm.async = oldMgm.async;
	}

	/**
	 * @param {Module} module the module
	 * @returns {void}
	 */
	removeModuleAttributes(module) {
		const mgm = this._getModuleGraphModule(module);
		mgm.postOrderIndex = null;
		mgm.preOrderIndex = null;
		mgm.depth = null;
		mgm.async = false;
	}

	/**
	 * @returns {void}
	 */
	removeAllModuleAttributes() {
		for (const mgm of this._moduleMap.values()) {
			mgm.postOrderIndex = null;
			mgm.preOrderIndex = null;
			mgm.depth = null;
			mgm.async = false;
		}
	}

	/**
	 * @param {Module} oldModule the old referencing module
	 * @param {Module} newModule the new referencing module
	 * @param {function(ModuleGraphConnection): boolean} filterConnection filter predicate for replacement
	 * @returns {void}
	 */
	moveModuleConnections(oldModule, newModule, filterConnection) {
		if (oldModule === newModule) return;
		const oldMgm = this._getModuleGraphModule(oldModule);
		const newMgm = this._getModuleGraphModule(newModule);
		// Outgoing connections
		const oldConnections = oldMgm.outgoingConnections;
		if (oldConnections !== undefined) {
			if (newMgm.outgoingConnections === undefined) {
				newMgm.outgoingConnections = new Set();
			}
			const newConnections = newMgm.outgoingConnections;
			for (const connection of oldConnections) {
				if (filterConnection(connection)) {
					connection.originModule = newModule;
					newConnections.add(connection);
					oldConnections.delete(connection);
				}
			}
		}
		// Incoming connections
		const oldConnections2 = oldMgm.incomingConnections;
		const newConnections2 = newMgm.incomingConnections;
		for (const connection of oldConnections2) {
			if (filterConnection(connection)) {
				connection.module = newModule;
				newConnections2.add(connection);
				oldConnections2.delete(connection);
			}
		}
	}

	/**
	 * @param {Module} oldModule the old referencing module
	 * @param {Module} newModule the new referencing module
	 * @param {function(ModuleGraphConnection): boolean} filterConnection filter predicate for replacement
	 * @returns {void}
	 */
	copyOutgoingModuleConnections(oldModule, newModule, filterConnection) {
		if (oldModule === newModule) return;
		const oldMgm = this._getModuleGraphModule(oldModule);
		const newMgm = this._getModuleGraphModule(newModule);
		// Outgoing connections
		const oldConnections = oldMgm.outgoingConnections;
		if (oldConnections !== undefined) {
			if (newMgm.outgoingConnections === undefined) {
				newMgm.outgoingConnections = new Set();
			}
			const newConnections = newMgm.outgoingConnections;
			for (const connection of oldConnections) {
				if (filterConnection(connection)) {
					const newConnection = connection.clone();
					newConnection.originModule = newModule;
					newConnections.add(newConnection);
					if (newConnection.module !== undefined) {
						const otherMgm = this._getModuleGraphModule(newConnection.module);
						otherMgm.incomingConnections.add(newConnection);
					}
				}
			}
		}
	}

	/**
	 * @param {Module} module the referenced module
	 * @param {string} explanation an explanation why it's referenced
	 * @returns {void}
	 */
	addExtraReason(module, explanation) {
		const connections = this._getModuleGraphModule(module).incomingConnections;
		connections.add(new ModuleGraphConnection(null, null, module, explanation));
	}

	// 返回 ModuleGraphConnection.resolvedModule
	getResolvedModule(dependency) {
		const connection = this._dependencyMap.get(dependency);
		return connection !== undefined ? connection.resolvedModule : null;
	}

	// 返回 ModuleGraphConnection
	getConnection(dependency) {
		// 根据 Dependency 找到对应的 ModuleGraphConnection
		const connection = this._dependencyMap.get(dependency);
		return connection;
	}

	// 返回 ModuleGraphConnection.module
	getModule(dependency) {
		// 根据 Dependency 找到对应的 ModuleGraphConnection
		const connection = this._dependencyMap.get(dependency);
		// 返回 ModuleGraphConnection.module
		return connection !== undefined ? connection.module : null;
	}

	// 返回 ModuleGraphConnection.originModule
	getOrigin(dependency) {
		// 根据 Dependency 找到对应的 ModuleGraphConnection
		const connection = this._dependencyMap.get(dependency);
		// 返回 ModuleGraphConnection.originModule
		return connection !== undefined ? connection.originModule : null;
	}

	// 返回 ModuleGraphConnection.resolvedOriginModule
	getResolvedOrigin(dependency) {
		// 根据 Module 找到对应的 ModuleGraphConnection
		const connection = this._dependencyMap.get(dependency);
		return connection !== undefined ? connection.resolvedOriginModule : null;
	}

	// 返回 ModuleGraphModule.incomingConnections
	getIncomingConnections(module) {
		const connections = this._getModuleGraphModule(module).incomingConnections;
		return connections;
	}

	// 返回 ModuleGraphModule.outgoingConnections
	getOutgoingConnections(module) {
		// 根据 Module 找到对应的 ModuleGraphModule
		const connections = this._getModuleGraphModule(module).outgoingConnections;
		return connections === undefined ? EMPTY_SET : connections;
	}

	/**
	 * @param {Module} module the module
	 * @returns {readonly Map<Module, readonly ModuleGraphConnection[]>} reasons why a module is included, in a map by source module
	 */
	getIncomingConnectionsByOriginModule(module) {
		const connections = this._getModuleGraphModule(module).incomingConnections;
		return connections.getFromUnorderedCache(getConnectionsByOriginModule);
	}

	// 返回 ModuleGraphModule.profile
	getProfile(module) {
		// 根据 Module 返回对应的 ModuleGraphModule
		const mgm = this._getModuleGraphModule(module);
		return mgm.profile;
	}

	// 设置 ModuleGraphModule.profile
	setProfile(module, profile) {
		// 根据 Module 返回对应的 ModuleGraphModule
		const mgm = this._getModuleGraphModule(module);
		mgm.profile = profile;
	}

	// 设置 ModuleGraphModule.issuer
	getIssuer(module) {
		const mgm = this._getModuleGraphModule(module);
		return mgm.issuer;
	}

	// 返回 ModuleGraphModule.issuer
	setIssuer(module, issuer) {
		const mgm = this._getModuleGraphModule(module);
		mgm.issuer = issuer;
	}

	// 如果 ModuleGraphModule.issuer 未被设置过 设置 ModuleGraphModule.issuer
	setIssuerIfUnset(module, issuer) {
		const mgm = this._getModuleGraphModule(module);
		if (mgm.issuer === undefined) mgm.issuer = issuer;
	}

	/**
	 * @param {Module} module the module
	 * @returns {(string | OptimizationBailoutFunction)[]} optimization bailouts
	 */
	getOptimizationBailout(module) {
		const mgm = this._getModuleGraphModule(module);
		return mgm.optimizationBailout;
	}

	/**
	 * @param {Module} module the module
	 * @returns {true | string[] | null} the provided exports
	 */
	getProvidedExports(module) {
		const mgm = this._getModuleGraphModule(module);
		return mgm.exports.getProvidedExports();
	}

	/**
	 * @param {Module} module the module
	 * @param {string | string[]} exportName a name of an export
	 * @returns {boolean | null} true, if the export is provided by the module.
	 * null, if it's unknown.
	 * false, if it's not provided.
	 */
	isExportProvided(module, exportName) {
		const mgm = this._getModuleGraphModule(module);
		const result = mgm.exports.isExportProvided(exportName);
		return result === undefined ? null : result;
	}

	// 返回 ModuleGraphModule.exports
	getExportsInfo(module) {
		const mgm = this._getModuleGraphModule(module);
		return mgm.exports;
	}
	
	// 返回 ModuleGraphModule.exports.[某个属性]
	getExportInfo(module, exportName) {
		const mgm = this._getModuleGraphModule(module);
		return mgm.exports.getExportInfo(exportName);
	}

	/**
	 * @param {Module} module the module
	 * @param {string} exportName the export
	 * @returns {ExportInfo} info about the export (do not modify)
	 */
	getReadOnlyExportInfo(module, exportName) {
		const mgm = this._getModuleGraphModule(module);
		return mgm.exports.getReadOnlyExportInfo(exportName);
	}

	/**
	 * @param {Module} module the module
	 * @param {RuntimeSpec} runtime the runtime
	 * @returns {false | true | SortableSet<string> | null} the used exports
	 * false: module is not used at all.
	 * true: the module namespace/object export is used.
	 * SortableSet<string>: these export names are used.
	 * empty SortableSet<string>: module is used but no export.
	 * null: unknown, worst case should be assumed.
	 */
	getUsedExports(module, runtime) {
		const mgm = this._getModuleGraphModule(module);
		return mgm.exports.getUsedExports(runtime);
	}

	/**
	 * @param {Module} module the module
	 * @returns {number} the index of the module
	 */
	getPreOrderIndex(module) {
		const mgm = this._getModuleGraphModule(module);
		return mgm.preOrderIndex;
	}

	/**
	 * @param {Module} module the module
	 * @returns {number} the index of the module
	 */
	getPostOrderIndex(module) {
		const mgm = this._getModuleGraphModule(module);
		return mgm.postOrderIndex;
	}

	/**
	 * @param {Module} module the module
	 * @param {number} index the index of the module
	 * @returns {void}
	 */
	setPreOrderIndex(module, index) {
		const mgm = this._getModuleGraphModule(module);
		mgm.preOrderIndex = index;
	}

	/**
	 * @param {Module} module the module
	 * @param {number} index the index of the module
	 * @returns {boolean} true, if the index was set
	 */
	setPreOrderIndexIfUnset(module, index) {
		const mgm = this._getModuleGraphModule(module);
		if (mgm.preOrderIndex === null) {
			mgm.preOrderIndex = index;
			return true;
		}
		return false;
	}

	/**
	 * @param {Module} module the module
	 * @param {number} index the index of the module
	 * @returns {void}
	 */
	setPostOrderIndex(module, index) {
		const mgm = this._getModuleGraphModule(module);
		mgm.postOrderIndex = index;
	}

	/**
	 * @param {Module} module the module
	 * @param {number} index the index of the module
	 * @returns {boolean} true, if the index was set
	 */
	setPostOrderIndexIfUnset(module, index) {
		const mgm = this._getModuleGraphModule(module);
		if (mgm.postOrderIndex === null) {
			mgm.postOrderIndex = index;
			return true;
		}
		return false;
	}

	// 返回 ModuleGraphModule.depth
	getDepth(module) {
		const mgm = this._getModuleGraphModule(module);
		return mgm.depth;
	}

	// 设置 ModuleGraphModule.depth
	setDepth(module, depth) {
		const mgm = this._getModuleGraphModule(module);
		mgm.depth = depth;
	}

	// 是否成功设置 ModuleGraphModule.depth
	// ModuleGraphModule.depth 如果低于预期 则设置 
	setDepthIfLower(module, depth) {
		const mgm = this._getModuleGraphModule(module);
		if (mgm.depth === null || mgm.depth > depth) {
			mgm.depth = depth;
			return true;
		}
		return false;
	}

	// 当前 ModuModuleGraphModulele 是否是异步
	isAsync(module) {
		const mgm = this._getModuleGraphModule(module);
		return mgm.async;
	}

	// 设置 ModuleGraphModule.async
	setAsync(module) {
		const mgm = this._getModuleGraphModule(module);
		mgm.async = true;
	}

	/**
	 * @param {any} thing any thing
	 * @returns {Object} metadata
	 */
	getMeta(thing) {
		let meta = this._metaMap.get(thing);
		if (meta === undefined) {
			meta = Object.create(null);
			this._metaMap.set(thing, meta);
		}
		return meta;
	}

	/**
	 * @param {any} thing any thing
	 * @returns {Object} metadata
	 */
	getMetaIfExisting(thing) {
		return this._metaMap.get(thing);
	}

	freeze() {
		this._cache = new WeakTupleMap();
	}

	unfreeze() {
		this._cache = undefined;
	}

	/**
	 * @template {any[]} T
	 * @template V
	 * @param {(moduleGraph: ModuleGraph, ...args: T) => V} fn computer
	 * @param {T} args arguments
	 * @returns {V} computed value or cached
	 */
	cached(fn, ...args) {
		if (this._cache === undefined) return fn(this, ...args);
		return this._cache.provide(fn, ...args, () => fn(this, ...args));
	}

	// 返回 Module 对应的 ModuleGraph
	static getModuleGraphForModule(module, deprecateMessage, deprecationCode) {
		const fn = deprecateMap.get(deprecateMessage);
		if (fn) return fn(module);
		const newFn = util.deprecate(
			/**
			 * @param {Module} module the module
			 * @returns {ModuleGraph} the module graph
			 */
			module => {
				const moduleGraph = moduleGraphForModuleMap.get(module);
				if (!moduleGraph)
					throw new Error(
						deprecateMessage +
							"There was no ModuleGraph assigned to the Module for backward-compat (Use the new API)"
					);
				return moduleGraph;
			},
			deprecateMessage + ": Use new ModuleGraph API",
			deprecationCode
		);
		deprecateMap.set(deprecateMessage, newFn);
		return newFn(module);
	}

	// 根据 Module 来缓存对应的 ModuleGraph
	// moduleGraphForModuleMap: WeakMap<Module, ModuleGraph>
	static setModuleGraphForModule(module, moduleGraph) {
		moduleGraphForModuleMap.set(module, moduleGraph);
	}

	// 移除缓存的 ModuleGraph
	static clearModuleGraphForModule(module) {
		moduleGraphForModuleMap.delete(module);
	}
}

// WeakMap<Module, ModuleGraph>
const moduleGraphForModuleMap = new WeakMap();

// TODO remove in webpack 6
/** @type {Map<string, (module: Module) => ModuleGraph>} */
const deprecateMap = new Map();

module.exports = ModuleGraph;
module.exports.ModuleGraphConnection = ModuleGraphConnection;
