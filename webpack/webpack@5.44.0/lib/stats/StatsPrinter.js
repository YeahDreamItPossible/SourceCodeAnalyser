"use strict";

const { HookMap, SyncWaterfallHook, SyncBailHook } = require("tapable");

// TODO:
// 统计打印 ??
// 将 统计信息 按照类别 打印出来 ??
class StatsPrinter {
	constructor() {
		this.hooks = Object.freeze({
			// HookMap<SyncBailHook<[string[], StatsPrinterContext], true>>
			sortElements: new HookMap(
				() => new SyncBailHook(["elements", "context"])
			),
			// HookMap<SyncBailHook<[PrintedElement[], StatsPrinterContext], string>>
			printElements: new HookMap(
				() => new SyncBailHook(["printedElements", "context"])
			),
			// HookMap<SyncBailHook<[any[], StatsPrinterContext], true>>
			sortItems: new HookMap(() => new SyncBailHook(["items", "context"])),
			// HookMap<SyncBailHook<[any, StatsPrinterContext], string>>
			getItemName: new HookMap(() => new SyncBailHook(["item", "context"])),
			// HookMap<SyncBailHook<[string[], StatsPrinterContext], string>>
			printItems: new HookMap(
				() => new SyncBailHook(["printedItems", "context"])
			),
			// HookMap<SyncBailHook<[{}, StatsPrinterContext], string>>
			print: new HookMap(() => new SyncBailHook(["object", "context"])),
			// HookMap<SyncWaterfallHook<[string, StatsPrinterContext]>>
			result: new HookMap(() => new SyncWaterfallHook(["result", "context"]))
		});
		// Map<HookMap<Hook>, Map<string, Hook[]>>
		this._levelHookCache = new Map();
		// 标识: 
		this._inPrint = false;
	}

	// 返回 statsPrinter.hooks 中 特定类型 所有匹配的的hooks
	_getAllLevelHooks(hookMap, type) {
		let cache = (
			this._levelHookCache.get(hookMap)
		);
		if (cache === undefined) {
			cache = new Map();
			this._levelHookCache.set(hookMap, cache);
		}
		const cacheEntry = cache.get(type);
		if (cacheEntry !== undefined) {
			return cacheEntry;
		}
		// T[]
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

	// 运行
	_forEachLevel(hookMap, type, fn) {
		for (const hook of this._getAllLevelHooks(hookMap, type)) {
			const result = fn(hook);
			if (result !== undefined) return result;
		}
	}

	// 执行 属性路径中所匹配的hooks
	// 并将 返回值 作为下个hook的参数
	_forEachLevelWaterfall(hookMap, type, data, fn) {
		for (const hook of this._getAllLevelHooks(hookMap, type)) {
			data = fn(hook, data);
		}
		return data;
	}

	
	// 开始打印
	print(type, object, baseContext) {
		if (this._inPrint) {
			return this._print(type, object, baseContext);
		} else {
			try {
				this._inPrint = true;
				return this._print(type, object, baseContext);
			} finally {
				this._levelHookCache.clear();
				this._inPrint = false;
			}
		}
	}

	// 打印
	_print(type, object, baseContext) {
		const context = {
			...baseContext,
			type,
			[type]: object
		};

		let printResult = this._forEachLevel(this.hooks.print, type, hook =>
			hook.call(object, context)
		);
		if (printResult === undefined) {
			if (Array.isArray(object)) {
				const sortedItems = object.slice();
				this._forEachLevel(this.hooks.sortItems, type, h =>
					h.call(sortedItems, context)
				);
				const printedItems = sortedItems.map((item, i) => {
					const itemContext = {
						...context,
						_index: i
					};
					const itemName = this._forEachLevel(
						this.hooks.getItemName,
						`${type}[]`,
						h => h.call(item, itemContext)
					);
					if (itemName) itemContext[itemName] = item;
					return this.print(
						itemName ? `${type}[].${itemName}` : `${type}[]`,
						item,
						itemContext
					);
				});
				printResult = this._forEachLevel(this.hooks.printItems, type, h =>
					h.call(printedItems, context)
				);
				if (printResult === undefined) {
					const result = printedItems.filter(Boolean);
					if (result.length > 0) printResult = result.join("\n");
				}
			} else if (object !== null && typeof object === "object") {
				const elements = Object.keys(object).filter(
					key => object[key] !== undefined
				);
				this._forEachLevel(this.hooks.sortElements, type, h =>
					h.call(elements, context)
				);
				const printedElements = elements.map(element => {
					const content = this.print(`${type}.${element}`, object[element], {
						...context,
						_parent: object,
						_element: element,
						[element]: object[element]
					});
					return { element, content };
				});
				printResult = this._forEachLevel(this.hooks.printElements, type, h =>
					h.call(printedElements, context)
				);
				if (printResult === undefined) {
					const result = printedElements.map(e => e.content).filter(Boolean);
					if (result.length > 0) printResult = result.join("\n");
				}
			}
		}

		return this._forEachLevelWaterfall(
			this.hooks.result,
			type,
			printResult,
			(h, r) => h.call(r, context)
		);
	}
}
module.exports = StatsPrinter;
