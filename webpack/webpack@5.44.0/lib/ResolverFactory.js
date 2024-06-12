"use strict";

const Factory = require("enhanced-resolve").ResolverFactory;
const { HookMap, SyncHook, SyncWaterfallHook } = require("tapable");
const {
	cachedCleverMerge,
	removeOperations,
	resolveByProperty
} = require("./util/cleverMerge");

const EMPTY_RESOLVE_OPTIONS = {};

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

// 解析器工厂
module.exports = class ResolverFactory {
	constructor() {
		this.hooks = Object.freeze({
			// HookMap<SyncWaterfallHook<[ResolveOptionsWithDependencyType]>>
			resolveOptions: new HookMap(
				() => new SyncWaterfallHook(["resolveOptions"])
			),
			// HookMap<SyncHook<[Resolver, ResolveOptions, ResolveOptionsWithDependencyType]>>
			resolver: new HookMap(
				() => new SyncHook(["resolver", "resolveOptions", "userResolveOptions"])
			)
		});
		// 存储 不同类型的 不同 ResolveOptions 的 Resovler
		// Map<String, Object>
		this.cache = new Map();
	}

	/**
	 * 根据 类型Type 返回对应的 Resovler Resovler
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
	 * 创建 特定类型Type 的 Resolver
	 * 底层仍然是通过ResolverFactory.createResolver(resolveOptions)
	 * normal || context || loader
	 */
	_create(type, resolveOptionsWithDepType) {
		// ResolveOptionsWithDependencyType
		const originalResolveOptions = { ...resolveOptionsWithDepType };

		// 对于 normal 和 context 类型 将 resolveOptionsWithDepType 和 Webpack.Config.resolve 属性合并
		// 对于 loader 类型 将 resolveOptionsWithDepType 和 Webpack.Config.resolveLoader 属性合并
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
