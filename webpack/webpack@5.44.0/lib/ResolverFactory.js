"use strict";

const Factory = require("enhanced-resolve").ResolverFactory;
const { HookMap, SyncHook, SyncWaterfallHook } = require("tapable");
const {
	cachedCleverMerge,
	removeOperations,
	resolveByProperty
} = require("./util/cleverMerge");

/** @typedef {import("enhanced-resolve").ResolveOptions} ResolveOptions */
/** @typedef {import("enhanced-resolve").Resolver} Resolver */
/** @typedef {import("../declarations/WebpackOptions").ResolveOptions} WebpackResolveOptions */
/** @typedef {import("../declarations/WebpackOptions").ResolvePluginInstance} ResolvePluginInstance */

/** @typedef {WebpackResolveOptions & {dependencyType?: string, resolveToContext?: boolean }} ResolveOptionsWithDependencyType */
/**
 * @typedef {Object} WithOptions
 * @property {function(Partial<ResolveOptionsWithDependencyType>): ResolverWithOptions} withOptions create a resolver with additional/different options
 */

/** @typedef {Resolver & WithOptions} ResolverWithOptions */

// need to be hoisted on module level for caching identity
const EMPTY_RESOLVE_OPTIONS = {};

/**
 * @param {ResolveOptionsWithDependencyType} resolveOptionsWithDepType enhanced options
 * @returns {ResolveOptions} merged options
 */
const convertToResolveOptions = resolveOptionsWithDepType => {
	const { dependencyType, plugins, ...remaining } = resolveOptionsWithDepType;

	// check type compat
	/** @type {Partial<ResolveOptions>} */
	const partialOptions = {
		...remaining,
		plugins:
			plugins &&
			/** @type {ResolvePluginInstance[]} */ (
				plugins.filter(item => item !== "...")
			)
	};

	if (!partialOptions.fileSystem) {
		throw new Error(
			"fileSystem is missing in resolveOptions, but it's required for enhanced-resolve"
		);
	}
	// These weird types validate that we checked all non-optional properties
	const options =
		/** @type {Partial<ResolveOptions> & Pick<ResolveOptions, "fileSystem">} */ (
			partialOptions
		);

	return removeOperations(
		resolveByProperty(options, "byDependency", dependencyType)
	);
};

/**
 * @typedef {Object} ResolverCache
 * @property {WeakMap<Object, ResolverWithOptions>} direct
 * @property {Map<string, ResolverWithOptions>} stringified
 */

module.exports = class ResolverFactory {
	constructor() {
		this.hooks = Object.freeze({
			/** @type {HookMap<SyncWaterfallHook<[ResolveOptionsWithDependencyType]>>} */
			resolveOptions: new HookMap(
				() => new SyncWaterfallHook(["resolveOptions"])
			),
			/** @type {HookMap<SyncHook<[Resolver, ResolveOptions, ResolveOptionsWithDependencyType]>>} */
			resolver: new HookMap(
				() => new SyncHook(["resolver", "resolveOptions", "userResolveOptions"])
			)
		});
		// Map<string, ResolverCache>
		// Map<Type, Object<direct: WeakMap<ResolveOptions, Resolver>, stringified: Map<ResolveOptionsString, Resolver>>>
		this.cache = new Map();
	}

	/**
	 * 根据 特定类型Type 返回对应的 resolver 并缓存该resolver
	 * context type => ContextModuleFactory
	 * normal type  => NormalModuleFactory
	 * loader type  => 
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
		const cachedResolver = typedCaches.direct.get(resolveOptions);
		if (cachedResolver) {
			return cachedResolver;
		}
		const ident = JSON.stringify(resolveOptions);
		const resolver = typedCaches.stringified.get(ident);
		if (resolver) {
			typedCaches.direct.set(resolveOptions, resolver);
			return resolver;
		}
		const newResolver = this._create(type, resolveOptions);
		typedCaches.direct.set(resolveOptions, newResolver);
		typedCaches.stringified.set(ident, newResolver);
		return newResolver;
	}

	/**
	 * 创建特定类型Type的resolver
	 * 底层仍然是通过ResolverFactory.createResolver(resolveOptions)
	 * normal || context || loader
	 */
	_create(type, resolveOptionsWithDepType) {
		/** @type {ResolveOptionsWithDependencyType} */
		const originalResolveOptions = { ...resolveOptionsWithDepType };

		const resolveOptions = convertToResolveOptions(
			// 将 resolveOptionsWithDepType 和 Webpack.Config.resolve 属性合并
			this.hooks.resolveOptions.for(type).call(resolveOptionsWithDepType)
		);
		const resolver = /** @type {ResolverWithOptions} */ (
			Factory.createResolver(resolveOptions)
		);
		if (!resolver) {
			throw new Error("No resolver created");
		}
		/** @type {WeakMap<Partial<ResolveOptionsWithDependencyType>, ResolverWithOptions>} */
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
