"use strict";

const { HookMap, SyncBailHook, SyncWaterfallHook } = require("tapable");
const { concatComparators, keepOriginalOrder } = require("../util/comparators");
const smartGrouping = require("../util/smartGrouping");

// 统计工厂()
class StatsFactory {
	constructor() {
		this.hooks = Object.freeze({
			// {HookMap<SyncBailHook<[Object, any, StatsFactoryContext]>>
			extract: new HookMap(
				() => new SyncBailHook(["object", "data", "context"])
			),
			// {HookMap<SyncBailHook<[any, StatsFactoryContext, number, number]>>
			filter: new HookMap(
				() => new SyncBailHook(["item", "context", "index", "unfilteredIndex"])
			),
			// {HookMap<SyncBailHook<[(function(any, any): number)[], StatsFactoryContext]>>
			sort: new HookMap(() => new SyncBailHook(["comparators", "context"])),
			// {HookMap<SyncBailHook<[any, StatsFactoryContext, number, number]>>
			filterSorted: new HookMap(
				() => new SyncBailHook(["item", "context", "index", "unfilteredIndex"])
			),
			// {HookMap<SyncBailHook<[GroupConfig[], StatsFactoryContext]>>
			groupResults: new HookMap(
				() => new SyncBailHook(["groupConfigs", "context"])
			),
			// {HookMap<SyncBailHook<[(function(any, any): number)[], StatsFactoryContext]>>
			sortResults: new HookMap(
				() => new SyncBailHook(["comparators", "context"])
			),
			// {HookMap<SyncBailHook<[any, StatsFactoryContext, number, number]>>
			filterResults: new HookMap(
				() => new SyncBailHook(["item", "context", "index", "unfilteredIndex"])
			),
			// 合并
			// {HookMap<SyncBailHook<[any[], StatsFactoryContext]>>
			merge: new HookMap(() => new SyncBailHook(["items", "context"])),
			// {HookMap<SyncBailHook<[any[], StatsFactoryContext]>>
			result: new HookMap(() => new SyncWaterfallHook(["result", "context"])),
			// 
			// {HookMap<SyncBailHook<[any, StatsFactoryContext]>>
			getItemName: new HookMap(() => new SyncBailHook(["item", "context"])),
			// {HookMap<SyncBailHook<[any, StatsFactoryContext]>>
			getItemFactory: new HookMap(() => new SyncBailHook(["item", "context"]))
		});
		const hooks = this.hooks;
		// Object<String, Map>
		this._caches = ({});
		for (const key of Object.keys(hooks)) {
			this._caches[key] = new Map();
		}
		// 标识: 标识当前正在统计中
		this._inCreate = false;
	}

	// 返回 statsFactory.hooks 中 特定类型 所有匹配的的hooks
	// 该特定类型值得是 属性路径
	// 示例: compilation.assets[].asset
	_getAllLevelHooks(hookMap, cache, type) {
		const cacheEntry = cache.get(type);
		if (cacheEntry !== undefined) {
			return cacheEntry;
		}
		const hooks = [];
		const typeParts = type.split(".");
		for (let i = 0; i < typeParts.length; i++) {
			const hook = hookMap.get(typeParts.slice(i).join("."));
			if (hook) {
				hooks.push(hook);
			}
		}
		cache.set(type, hooks);
		return hooks;
	}

	// 执行 属性路径中所匹配的hooks
	_forEachLevel(hookMap, cache, type, fn) {
		for (const hook of this._getAllLevelHooks(hookMap, cache, type)) {
			const result = fn(hook);
			if (result !== undefined) return result;
		}
	}

	// 执行 属性路径中所匹配的hooks
	// 并将 返回值 作为下个hook的参数
	_forEachLevelWaterfall(hookMap, cache, type, data, fn) {
		for (const hook of this._getAllLevelHooks(hookMap, cache, type)) {
			data = fn(hook, data);
		}
		return data;
	}

	// 过滤
	_forEachLevelFilter(hookMap, cache, type, items, fn, forceClone) {
		const hooks = this._getAllLevelHooks(hookMap, cache, type);
		if (hooks.length === 0) return forceClone ? items.slice() : items;
		let i = 0;
		return items.filter((item, idx) => {
			for (const hook of hooks) {
				const r = fn(hook, item, idx, i);
				if (r !== undefined) {
					if (r) i++;
					return r;
				}
			}
			i++;
			return true;
		});
	}

	// 开始构建
	create(type, data, baseContext) {
		if (this._inCreate) {
			return this._create(type, data, baseContext);
		} else {
			try {
				this._inCreate = true;
				return this._create(type, data, baseContext);
			} finally {
				for (const key of Object.keys(this._caches)) this._caches[key].clear();
				this._inCreate = false;
			}
		}
	}

	// 构建
	_create(type, data, baseContext) {
		const context = {
			...baseContext,
			type,
			[type]: data
		};
		if (Array.isArray(data)) {
			// this.hooks.filter
			const items = this._forEachLevelFilter(
				this.hooks.filter,
				this._caches.filter,
				type,
				data,
				(h, r, idx, i) => h.call(r, context, idx, i),
				true
			);

			// sort items
			const comparators = [];
			// this.hooks.sort
			this._forEachLevel(this.hooks.sort, this._caches.sort, type, h =>
				h.call(comparators, context)
			);
			if (comparators.length > 0) {
				items.sort(
					// @ts-expect-error number of arguments is correct
					concatComparators(...comparators, keepOriginalOrder(items))
				);
			}

			// this.hooks.filterSorted
			const items2 = this._forEachLevelFilter(
				this.hooks.filterSorted,
				this._caches.filterSorted,
				type,
				items,
				(h, r, idx, i) => h.call(r, context, idx, i),
				false
			);

			// for each item
			let resultItems = items2.map((item, i) => {
				const itemContext = {
					...context,
					_index: i
				};

				// run getItemName
				const itemName = this._forEachLevel(
					this.hooks.getItemName,
					this._caches.getItemName,
					`${type}[]`,
					h => h.call(item, itemContext)
				);
				if (itemName) itemContext[itemName] = item;
				const innerType = itemName ? `${type}[].${itemName}` : `${type}[]`;

				// run getItemFactory
				const itemFactory =
					this._forEachLevel(
						this.hooks.getItemFactory,
						this._caches.getItemFactory,
						innerType,
						h => h.call(item, itemContext)
					) || this;

				// run item factory
				return itemFactory.create(innerType, item, itemContext);
			});

			// this.hooks.sortResults
			const comparators2 = [];
			this._forEachLevel(
				this.hooks.sortResults,
				this._caches.sortResults,
				type,
				h => h.call(comparators2, context)
			);
			if (comparators2.length > 0) {
				resultItems.sort(
					// @ts-expect-error number of arguments is correct
					concatComparators(...comparators2, keepOriginalOrder(resultItems))
				);
			}

			// this.hooks.groupResults
			const groupConfigs = [];
			this._forEachLevel(
				this.hooks.groupResults,
				this._caches.groupResults,
				type,
				h => h.call(groupConfigs, context)
			);
			if (groupConfigs.length > 0) {
				resultItems = smartGrouping(resultItems, groupConfigs);
			}

			// this.hooks.filterResults
			const finalResultItems = this._forEachLevelFilter(
				this.hooks.filterResults,
				this._caches.filterResults,
				type,
				resultItems,
				(h, r, idx, i) => h.call(r, context, idx, i),
				false
			);

			// this.hooks.merge
			let result = this._forEachLevel(
				this.hooks.merge,
				this._caches.merge,
				type,
				h => h.call(finalResultItems, context)
			);
			if (result === undefined) result = finalResultItems;

			// this.hooks.result
			return this._forEachLevelWaterfall(
				this.hooks.result,
				this._caches.result,
				type,
				result,
				(h, r) => h.call(r, context)
			);
		} else {
			const object = {};

			// 调用 this.hooks.extract 钩子
			this._forEachLevel(this.hooks.extract, this._caches.extract, type, h =>
				h.call(object, data, context)
			);

			// 空调用  直接返回object
			// 调用 this.hooks.result 钩子
			return this._forEachLevelWaterfall(
				this.hooks.result,
				this._caches.result,
				type,
				object,
				(h, r) => h.call(r, context)
			);
		}
	}
}
module.exports = StatsFactory;
