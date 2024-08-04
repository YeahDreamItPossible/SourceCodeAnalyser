"use strict";

const Factory = require("enhanced-resolve").ResolverFactory;
const { HookMap, SyncHook, SyncWaterfallHook } = require("tapable");
const {
	cachedCleverMerge,
	removeOperations,
	resolveByProperty
} = require("./util/cleverMerge");

const EMPTY_RESOLVE_OPTIONS = {};

// 
const convertToResolveOptions = resolveOptionsWithDepType => {
	const { dependencyType, plugins, ...remaining } = resolveOptionsWithDepType;

	// check type compat
	// Partial<ResolveOptions>
	const partialOptions = {
		...remaining,
		plugins:
			plugins && (
				plugins.filter(item => item !== "...")
			)
	};

	if (!partialOptions.fileSystem) {
		throw new Error(
			"fileSystem is missing in resolveOptions, but it's required for enhanced-resolve"
		);
	}
	// These weird types validate that we checked all non-optional properties
	// Partial<ResolveOptions> & Pick<ResolveOptions, "fileSystem"> 
	const options = (partialOptions);

	return removeOperations(
		resolveByProperty(options, "byDependency", dependencyType)
	);
};

/**
 * 路径解析器分类:
 * 标准路径解析器 NormalResolver
 * 上下文路径解析器 ContextResolver
 * 加载器路径解析器 LoaderResolver
 */

/**
 * 路径解析器作用:
 * 将 资源请求路径 转换成 特定的路径
 * 
 * 标准路径解析器: 
 * 将 模块请求路径 转换成 绝对路径 (通过绝对或相对路径解析模块)
 * 
 * 上下文路径解析器: 
 * 在给定的上下文中解析模块
 * 
 * 加载器路径解析器: 
 * 解析 webpack loader
 */

// 路径解析器工厂:
// 作用:
// 根据 特定的类型(ResolverType) 返回特定的 路径解析器(Resolver)
module.exports = class ResolverFactory {
	constructor() {
		this.hooks = Object.freeze({
			// 合并 resolve.options 并返回合并后的 resolve.options
			resolveOptions: new HookMap(
				() => new SyncWaterfallHook(["resolveOptions"])
			),
			// 
			resolver: new HookMap(
				() => new SyncHook(["resolver", "resolveOptions", "userResolveOptions"])
			)
		});
		// 存储 不同类型的 不同 ResolveOptions 的 Resovler
		// Map<String, Object>
		this.cache = new Map();
	}

	/**
	 * 根据 类型(Type) 返回对应的路径解析器(Resovler)
	 * type: context || normal || loader
	 */ 
	get(type, resolveOptions = EMPTY_RESOLVE_OPTIONS) {
		let typedCaches = this.cache.get(type);
		if (!typedCaches) {
			typedCaches = {
				direct: new WeakMap(),
				stringified: new Map()
			};
			this.cache.set(type, typedCaches);
		}
		// 先根据 ResovleOptions 来返回对应的 Resolver
		const cachedResolver = typedCaches.direct.get(resolveOptions);
		if (cachedResolver) {
			return cachedResolver;
		}
		// 序列化 ResolveOptions
		const ident = JSON.stringify(resolveOptions);
		// 再根据 序列化后的 ResolveOptions 来返回对应的 Resolver
		const resolver = typedCaches.stringified.get(ident);
		if (resolver) {
			typedCaches.direct.set(resolveOptions, resolver);
			return resolver;
		}
		// ResolveOptions 和 序列化后的 ResolveOptions 指向同一个 Resolver
		const newResolver = this._create(type, resolveOptions);
		typedCaches.direct.set(resolveOptions, newResolver);
		typedCaches.stringified.set(ident, newResolver);
		return newResolver;
	}

	/**
	 * 创建 特定类型 的 路径解析器
	 * 底层仍然是通过 ResolverFactory.createResolver(resolveOptions)
	 * 1. 合并 resolveOptions (hooks.resolveOptions.for(type).call('...'))
	 * 2. 创建 Resolver
	 * 3. hooks.resolver.for(type).call('...'))
	 */
	_create(type, resolveOptionsWithDepType) {
		// ResolveOptionsWithDependencyType
		const originalResolveOptions = { ...resolveOptionsWithDepType };

		// 对于 normal 和 context 类型 将 resolveOptionsWithDepType 和 Webpack.options.resolve 属性合并
		// 对于 loader 类型 将 resolveOptionsWithDepType 和 Webpack.options.resolveLoader 属性合并
		const resolveOptions = convertToResolveOptions(
			this.hooks.resolveOptions.for(type).call(resolveOptionsWithDepType)
		);
		// ResolverWithOptions 
		const resolver = ( Factory.createResolver(resolveOptions) );
		if (!resolver) {
			throw new Error("No resolver created");
		}
		// WeakMap<Partial<ResolveOptionsWithDependencyType>, ResolverWithOptions>
		const childCache = new WeakMap();
		resolver.withOptions = options => {
			const cacheEntry = childCache.get(options);
			if (cacheEntry !== undefined) return cacheEntry;
			const mergedOptions = cachedCleverMerge(originalResolveOptions, options);
			const resolver = this.get(type, mergedOptions);
			childCache.set(options, resolver);
			return resolver;
		};
		this.hooks.resolver
			.for(type)
			.call(resolver, resolveOptions, originalResolveOptions);
		return resolver;
	}
};
