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
 * 模块图模块
 * 作用:
 * 以 模块 为核心 描述模块间的相互引用关系
 * 1. 当前模块 与 被它引用的 子模块 间的相互引用关系
 * 2. 当前模块 与 引用它的 父模块 间的相互引用关系
 * 在 ModuleGraph 中 通过 Module 找到对应的 ModuleGraphModule
 */
class ModuleGraphModule {
	constructor() {
		// 描述 当前模块 与 引用当前模块的父模块 间的相互引用关系
		// 引用 当前模块 的 ModuleGraphConnection
		// Set<ModuleGraphConnection>
		this.incomingConnections = new SortableSet();
		// 描述 当前模块 与 当前模块引用的 子模块 间的相互引用关系
		// 当前模块 引用的 ModuleGraphConnection
		// Set<ModuleGraphConnection>
		this.outgoingConnections = undefined;
		// 父模块
		// 当前模块 是由哪些模块引入的 称引入当前模块为父模块(issuer)
		this.issuer = undefined;
		// 该模块中副作用信息
		// Array<String | Fn>
		this.optimizationBailout = [];
		// 导出信息
		// exports<ExportsInfo>
		this.exports = new ExportsInfo();
		// Number
		this.preOrderIndex = null;
		// Number
		this.postOrderIndex = null;
		// 深度
		this.depth = null;
		// 性能分析 ModuleProfile
		this.profile = undefined;
		// 标识: 当前模块是异步模块
		this.async = false;
	}
}

/**
 * 当调用 ModuleGraph 的方法时
 * 如果 参数 是 Depedency 那返回值 肯定与 ModuleGraphConnection 相关
 * 如果 参数 是 Module    那返回值 肯定与 ModuleGraphModule 相关
 */

/**
 * 模块图出现的原因:
 * 单个模块 与 依赖 之间是复杂的 一对多关系
 * 单个依赖 与 模块 之间也是复杂的 一对多关系
 * 多个模块 与 多个依赖 之间是复杂的 多对多关系
 */

/**
 * 模块图
 * 作用:
 * 以 模块 为核心 描述模块的引用关系
 * 描述 模块Module 与 依赖Dependency 的引用关系
 * 描述 模块Module 与 模块Module 的引用关系
 */
class ModuleGraph {
	constructor() {
		// 当前依赖 与 引用当前依赖的模块 的引用关系
		// Map<Dependency, ModuleGraphConnection>
		this._dependencyMap = new Map();
		// 当前模块 与 引用当前模块的模块 的引用关系
		// Map<Module, ModuleGraphModule>
		this._moduleMap = new Map();
		// 全局搜索未发现使用
		// Map<Module, Set<ModuleGraphConnection>>
		this._originMap = new Map();
		// 元信息
		// 存储当前模块中被替换的信息
		// Map<Any, Object>
		this._metaMap = new Map();

		// 缓存
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

	// 根据 Module 来返回对应的 ModuleGraphModule
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

	// 设置依赖的父Module 和 父DependenciesBlock
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
	 * 构建当前模块的引用关系
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

	// 更新 ModuleGraphConnection 中 Dependency 与 Module 关联关系
	// 更新 ModuleGraphModule 中 Module 与 Module 的关联关系
	updateModule(dependency, module) {
		const connection = this._dependencyMap.get(dependency);
		if (connection.module === module) return;
		const newConnection = connection.clone();
		newConnection.module = module;
		this._dependencyMap.set(dependency, newConnection);
		// 旧连接 失活
		connection.setActive(false);
		const originMgm = this._getModuleGraphModule(connection.originModule);
		originMgm.outgoingConnections.add(newConnection);
		const targetMgm = this._getModuleGraphModule(module);
		targetMgm.incomingConnections.add(newConnection);
	}

	// 移除 Dependency 与 Module 的关联关系 和 Module 和 Module 的关联关系
	// 1. 移除 ModuleGraphConnection 中 Dependency 与 Module 的关联关系
	// 2. 移除 ModuleGraphModule 中 Dependency.module 与 Module 的关联关系
	// 3. 移除 ModuleGraphModule 中 Dependency.originModule 与 Module 的关联关系
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

	// 复制 旧ModuleGraphModule 属性到 新ModuleGraphModule 属性 
	cloneModuleAttributes(sourceModule, targetModule) {
		const oldMgm = this._getModuleGraphModule(sourceModule);
		const newMgm = this._getModuleGraphModule(targetModule);
		newMgm.postOrderIndex = oldMgm.postOrderIndex;
		newMgm.preOrderIndex = oldMgm.preOrderIndex;
		newMgm.depth = oldMgm.depth;
		newMgm.exports = oldMgm.exports;
		newMgm.async = oldMgm.async;
	}

	// 重置 ModuleGraphModule 属性
	removeModuleAttributes(module) {
		const mgm = this._getModuleGraphModule(module);
		mgm.postOrderIndex = null;
		mgm.preOrderIndex = null;
		mgm.depth = null;
		mgm.async = false;
	}

	// 重置所有的 ModuleGraphModule 属性
	removeAllModuleAttributes() {
		for (const mgm of this._moduleMap.values()) {
			mgm.postOrderIndex = null;
			mgm.preOrderIndex = null;
			mgm.depth = null;
			mgm.async = false;
		}
	}

	// 将 旧ModuleGraphModule.outgoingConnections 和 旧ModuleGraphModule.outgoingConnections 
	// 通过过滤器过滤后 
	// 移动到 新ModuleGraphModule.incomingConnections 和 新ModuleGraphModule.incomingConnections 
	moveModuleConnections(oldModule, newModule, filterConnection) {
		if (oldModule === newModule) return;
		const oldMgm = this._getModuleGraphModule(oldModule);
		const newMgm = this._getModuleGraphModule(newModule);
		// 将 旧ModuleGraphModule.outgoingConnections 通过过滤器过滤后 移动到 新ModuleGraphModule.outgoingConnections
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
		// 将 旧ModuleGraphModule.incomingConnections 通过过滤器过滤后 移动到 新ModuleGraphModule.incomingConnections
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

	// 将 旧ModuleGraphModule.outgoingConnections 和 旧ModuleGraphModule.outgoingConnections 
	// 通过过滤器过滤后 
	// 移动到 新ModuleGraphModule.incomingConnections 和 新ModuleGraphModule.incomingConnections
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

	// 添加额外的解释
	addExtraReason(module, explanation) {
		const connections = this._getModuleGraphModule(module).incomingConnections;
		connections.add(new ModuleGraphConnection(null, null, module, explanation));
	}

	// 返回 moduleGraphModule.resolvedModule
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

	// 返回 moduleGraphModule.module
	getModule(dependency) {
		// 根据 Dependency 找到对应的 ModuleGraphConnection
		const connection = this._dependencyMap.get(dependency);
		// 返回 ModuleGraphConnection.module
		return connection !== undefined ? connection.module : null;
	}

	// 返回 moduleGraphModule.originModule
	getOrigin(dependency) {
		// 根据 Dependency 找到对应的 ModuleGraphConnection
		const connection = this._dependencyMap.get(dependency);
		// 返回 ModuleGraphConnection.originModule
		return connection !== undefined ? connection.originModule : null;
	}

	// 返回 moduleGraphModule.resolvedOriginModule
	getResolvedOrigin(dependency) {
		// 根据 Module 找到对应的 ModuleGraphConnection
		const connection = this._dependencyMap.get(dependency);
		return connection !== undefined ? connection.resolvedOriginModule : null;
	}

	// 返回 moduleGraphModule.incomingConnections
	getIncomingConnections(module) {
		const connections = this._getModuleGraphModule(module).incomingConnections;
		return connections;
	}

	// 返回 moduleGraphModule.outgoingConnections
	getOutgoingConnections(module) {
		// 根据 Module 找到对应的 ModuleGraphModule
		const connections = this._getModuleGraphModule(module).outgoingConnections;
		return connections === undefined ? EMPTY_SET : connections;
	}

	// 返回 moduleGraphModule.incomingConnections
	// Map<Module, ModuleGraphConnection[]> reasons why a module is included, in a map by source module
	getIncomingConnectionsByOriginModule(module) {
		const connections = this._getModuleGraphModule(module).incomingConnections;
		return connections.getFromUnorderedCache(getConnectionsByOriginModule);
	}

	// 返回 moduleGraphModule.profile
	getProfile(module) {
		// 根据 Module 返回对应的 ModuleGraphModule
		const mgm = this._getModuleGraphModule(module);
		return mgm.profile;
	}

	// 设置 moduleGraphModule.profile
	setProfile(module, profile) {
		// 根据 Module 返回对应的 ModuleGraphModule
		const mgm = this._getModuleGraphModule(module);
		mgm.profile = profile;
	}

	// 返回 moduleGraphModule.issuer
	getIssuer(module) {
		const mgm = this._getModuleGraphModule(module);
		return mgm.issuer;
	}

	// 设置 moduleGraphModule.issuer
	setIssuer(module, issuer) {
		const mgm = this._getModuleGraphModule(module);
		mgm.issuer = issuer;
	}

	// 设置 moduleGraphModule.issuer
	setIssuerIfUnset(module, issuer) {
		// 根据 Module 找到对应的 ModuleGraphModule
		const mgm = this._getModuleGraphModule(module);
		// 如果 ModuleGraphModule.issuer 之前未设置 则设置
		if (mgm.issuer === undefined) mgm.issuer = issuer;
	}

	// 当前模块副作用
	// 返回 moduleGraphModule.optimizationBailout
	getOptimizationBailout(module) {
		const mgm = this._getModuleGraphModule(module);
		return mgm.optimizationBailout;
	}

	// 
	getProvidedExports(module) {
		const mgm = this._getModuleGraphModule(module);
		return mgm.exports.getProvidedExports();
	}

	// 当前模块是否导出某标识符
	isExportProvided(module, exportName) {
		const mgm = this._getModuleGraphModule(module);
		const result = mgm.exports.isExportProvided(exportName);
		return result === undefined ? null : result;
	}

	// 返回 moduleGraphModule.exports
	getExportsInfo(module) {
		const mgm = this._getModuleGraphModule(module);
		return mgm.exports;
	}
	
	// 返回 moduleGraphModule.exports.[某个属性]
	getExportInfo(module, exportName) {
		const mgm = this._getModuleGraphModule(module);
		return mgm.exports.getExportInfo(exportName);
	}

	// 返回 moduleGraphModule.exports.[某个属性] 该属性是只读的 不允许修改
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

	// 返回 moduleGraphModule.preOrderIndex
	getPreOrderIndex(module) {
		const mgm = this._getModuleGraphModule(module);
		return mgm.preOrderIndex;
	}

	// 返回 moduleGraphModule.postOrderIndex
	getPostOrderIndex(module) {
		const mgm = this._getModuleGraphModule(module);
		return mgm.postOrderIndex;
	}

	// 设置 moduleGraphModule.preOrderIndex
	setPreOrderIndex(module, index) {
		const mgm = this._getModuleGraphModule(module);
		mgm.preOrderIndex = index;
	}

	// 返回 是否成功设置 moduleGraphModule.preOrderIndex
	setPreOrderIndexIfUnset(module, index) {
		const mgm = this._getModuleGraphModule(module);
		if (mgm.preOrderIndex === null) {
			mgm.preOrderIndex = index;
			return true;
		}
		return false;
	}

	// 设置 moduleGraphModule.postOrderIndex
	setPostOrderIndex(module, index) {
		const mgm = this._getModuleGraphModule(module);
		mgm.postOrderIndex = index;
	}

	// 返回 是否成功设置 moduleGraphModule.postOrderIndex
	setPostOrderIndexIfUnset(module, index) {
		const mgm = this._getModuleGraphModule(module);
		if (mgm.postOrderIndex === null) {
			mgm.postOrderIndex = index;
			return true;
		}
		return false;
	}

	// 返回 moduleGraphModule.depth
	getDepth(module) {
		const mgm = this._getModuleGraphModule(module);
		return mgm.depth;
	}

	// 设置 moduleGraphModule.depth
	setDepth(module, depth) {
		const mgm = this._getModuleGraphModule(module);
		mgm.depth = depth;
	}

	// 是否成功设置 moduleGraphModule.depth
	// ModuleGraphModule.depth 如果低于预期 则设置 
	setDepthIfLower(module, depth) {
		const mgm = this._getModuleGraphModule(module);
		if (mgm.depth === null || mgm.depth > depth) {
			mgm.depth = depth;
			return true;
		}
		return false;
	}

	// 当前 moduleGraphModule 是否是异步
	isAsync(module) {
		const mgm = this._getModuleGraphModule(module);
		return mgm.async;
	}

	// 设置 moduleGraphModule.async
	setAsync(module) {
		const mgm = this._getModuleGraphModule(module);
		mgm.async = true;
	}

	// 返回 元数据
	getMeta(thing) {
		let meta = this._metaMap.get(thing);
		if (meta === undefined) {
			meta = Object.create(null);
			this._metaMap.set(thing, meta);
		}
		return meta;
	}

	// 返回 元数据
	getMetaIfExisting(thing) {
		return this._metaMap.get(thing);
	}

	// 冻结
	freeze() {
		this._cache = new WeakTupleMap();
	}

	// 解冻
	unfreeze() {
		this._cache = undefined;
	}

	// 缓存 fn 计算后的值
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

// Map<string, (module: Module) => ModuleGraph>
const deprecateMap = new Map();

module.exports = ModuleGraph;
module.exports.ModuleGraphConnection = ModuleGraphConnection;
