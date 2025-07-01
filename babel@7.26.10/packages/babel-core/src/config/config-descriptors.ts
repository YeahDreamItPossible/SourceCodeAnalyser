import gensync, { type Handler } from "gensync";
import { once } from "../gensync-utils/functional.ts";

import { loadPlugin, loadPreset } from "./files/index.ts";

import { getItemDescriptor } from "./item.ts";

import {
  makeWeakCacheSync,
  makeStrongCacheSync,
  makeStrongCache,
} from "./caching.ts";
import type { CacheConfigurator } from "./caching.ts";

import type {
  ValidatedOptions,
  PluginList,
  PluginItem,
} from "./validation/options.ts";

import { resolveBrowserslistConfigFile } from "./resolve-targets.ts";
import type { PluginAPI, PresetAPI } from "./helpers/config-api.ts";

/**
 * 表示配置对象和延迟加载描述符的函数
 * 这样我们不会加载插件/预设，除非选项对象最终适用
 */
export type OptionsAndDescriptors = {
  // 选项
  options: ValidatedOptions;
  // 插件描述符加载函数
  plugins: () => Handler<Array<UnloadedDescriptor<PluginAPI>>>;
  // 预设描述符加载函数
  presets: () => Handler<Array<UnloadedDescriptor<PresetAPI>>>;
};

/**
 * 表示配置对象中特定位置的插件或预设
 * 此时这些已被解析为特定对象或函数，但尚未执行以调用带选项的函数
 */
export interface UnloadedDescriptor<API, Options = object | undefined | false> {
  // 名
  name: string | undefined;
  // 值
  value: object | ((api: API, options: Options, dirname: string) => unknown);
  // 选项
  options: Options;
  // 目录名
  dirname: string;
  // 别名
  alias: string;
  // 是否拥有自己的处理流程
  ownPass?: boolean;
  // 文件信息
  file?: {
    // 请求路径
    request: string;
    // 解析后的路径
    resolved: string;
  };
}

// 比较函数
// 比较两个描述符是否相等
function isEqualDescriptor<API>(
  a: UnloadedDescriptor<API>,
  b: UnloadedDescriptor<API>,
): boolean {
  return (
    a.name === b.name &&
    a.value === b.value &&
    a.options === b.options &&
    a.dirname === b.dirname &&
    a.alias === b.alias &&
    a.ownPass === b.ownPass &&
    a.file?.request === b.file?.request &&
    a.file?.resolved === b.file?.resolved
  );
}

// 文件类型
export type ValidatedFile = {
  // 文件路径
  filepath: string;
  // 目录路径
  dirname: string;
  // 选项
  options: ValidatedOptions;
};

// 包装函数
// 将 值 包装成 函数
function* handlerOf<T>(value: T): Handler<T> {
  return value;
}

// 切换是否使用 浏览器列表配置源，
// 包括搜索任何 browserslist 文件或引用 package.json 中的 browserslist 键。
// 这对于使用 browserslist 配置文件的项目很有用，这些文件不会用 Babel 编译
// 处理 浏览器列表配置文件
function optionsWithResolvedBrowserslistConfigFile(
  options: ValidatedOptions,
  dirname: string,
): ValidatedOptions {
  // 浏览器列表配置源
  if (typeof options.browserslistConfigFile === "string") {
    options.browserslistConfigFile = resolveBrowserslistConfigFile(
      options.browserslistConfigFile,
      dirname,
    );
  }
  return options;
}

/**
 * 从给定选项对象创建一组描述符，基于插件/预设数组本身的标识保留描述符标识
 */
// 创建 缓存的描述符
export function createCachedDescriptors(
  dirname: string,
  options: ValidatedOptions,
  alias: string,
): OptionsAndDescriptors {
  const { plugins, presets, passPerPreset } = options;
  return {
    options: optionsWithResolvedBrowserslistConfigFile(options, dirname),
    plugins: plugins
      ? () =>
          // @ts-expect-error todo(flow->ts) ts complains about incorrect arguments
          // eslint-disable-next-line @typescript-eslint/no-use-before-define
          createCachedPluginDescriptors(plugins, dirname)(alias)
      : () => handlerOf([]),
    presets: presets
      ? () =>
          // @ts-expect-error todo(flow->ts) ts complains about incorrect arguments
          // eslint-disable-next-line @typescript-eslint/no-use-before-define
          createCachedPresetDescriptors(presets, dirname)(alias)(
            !!passPerPreset,
          )
      : () => handlerOf([]),
  };
}

/**
 * 从给定选项对象创建一组描述符，具有一致的标识但不基于任何特定标识进行缓存
 */
// 创建 非缓存的描述符
export function createUncachedDescriptors(
  dirname: string,
  options: ValidatedOptions,
  alias: string,
): OptionsAndDescriptors {
  return {
    options: optionsWithResolvedBrowserslistConfigFile(options, dirname),
    // The returned result here is cached to represent a config object in
    // memory, so we build and memoize the descriptors to ensure the same
    // values are returned consistently.
    plugins: once(() =>
      createPluginDescriptors(options.plugins || [], dirname, alias),
    ),
    presets: once(() =>
      createPresetDescriptors(
        options.presets || [],
        dirname,
        alias,
        !!options.passPerPreset,
      ),
    ),
  };
}

// 
const PRESET_DESCRIPTOR_CACHE = new WeakMap();
const createCachedPresetDescriptors = makeWeakCacheSync(
  (items: PluginList, cache: CacheConfigurator<string>) => {
    const dirname = cache.using(dir => dir);
    return makeStrongCacheSync((alias: string) =>
      makeStrongCache(function* (
        passPerPreset: boolean,
      ): Handler<Array<UnloadedDescriptor<PresetAPI>>> {
        const descriptors = yield* createPresetDescriptors(
          items,
          dirname,
          alias,
          passPerPreset,
        );
        return descriptors.map(
          // Items are cached using the overall preset array identity when
          // possibly, but individual descriptors are also cached if a match
          // can be found in the previously-used descriptor lists.
          desc => loadCachedDescriptor(PRESET_DESCRIPTOR_CACHE, desc),
        );
      }),
    );
  },
);

// 插件描述符缓存
const PLUGIN_DESCRIPTOR_CACHE = new WeakMap();
const createCachedPluginDescriptors = makeWeakCacheSync(
  (items: PluginList, cache: CacheConfigurator<string>) => {
    const dirname = cache.using(dir => dir);
    return makeStrongCache(function* (
      alias: string,
    ): Handler<Array<UnloadedDescriptor<PluginAPI>>> {
      const descriptors = yield* createPluginDescriptors(items, dirname, alias);
      return descriptors.map(
        // Items are cached using the overall plugin array identity when
        // possibly, but individual descriptors are also cached if a match
        // can be found in the previously-used descriptor lists.
        desc => loadCachedDescriptor(PLUGIN_DESCRIPTOR_CACHE, desc),
      );
    });
  },
);

// 默认选项
const DEFAULT_OPTIONS = {};

// 给定缓存和描述符，从缓存返回匹配的描述符，
// 否则返回输入描述符并将其添加到缓存中
function loadCachedDescriptor<API>(
  cache: WeakMap<
    object | Function,
    WeakMap<object, Array<UnloadedDescriptor<API>>>
  >,
  desc: UnloadedDescriptor<API>,
) {
  const { value, options = DEFAULT_OPTIONS } = desc;
  if (options === false) return desc;

  let cacheByOptions = cache.get(value);
  if (!cacheByOptions) {
    cacheByOptions = new WeakMap();
    cache.set(value, cacheByOptions);
  }

  let possibilities = cacheByOptions.get(options);
  if (!possibilities) {
    possibilities = [];
    cacheByOptions.set(options, possibilities);
  }

  if (!possibilities.includes(desc)) {
    const matches = possibilities.filter(possibility =>
      isEqualDescriptor(possibility, desc),
    );
    if (matches.length > 0) {
      return matches[0];
    }

    possibilities.push(desc);
  }

  return desc;
}

// 创建 预设描述符
function* createPresetDescriptors(
  items: PluginList,
  dirname: string,
  alias: string,
  passPerPreset: boolean,
): Handler<Array<UnloadedDescriptor<PresetAPI>>> {
  return yield* createDescriptors(
    "preset",
    items,
    dirname,
    alias,
    passPerPreset,
  );
}

// 创建 插件描述符
function* createPluginDescriptors(
  items: PluginList,
  dirname: string,
  alias: string,
): Handler<Array<UnloadedDescriptor<PluginAPI>>> {
  return yield* createDescriptors("plugin", items, dirname, alias);
}

// 批量创建 描述符
function* createDescriptors<API>(
  type: "plugin" | "preset",
  items: PluginList,
  dirname: string,
  alias: string,
  ownPass?: boolean,
): Handler<Array<UnloadedDescriptor<API>>> {
  const descriptors = yield* gensync.all(
    items.map((item, index) =>
      createDescriptor(item, dirname, {
        type,
        alias: `${alias}$${index}`,
        ownPass: !!ownPass,
      }),
    ),
  );

  assertNoDuplicates(descriptors);

  return descriptors;
}

// 创建 描述符
// 给定一个插件/预设项，将其解析为标准格式
export function* createDescriptor<API>(
  pair: PluginItem,
  dirname: string,
  {
    type,
    alias,
    ownPass,
  }: {
    type?: "plugin" | "preset";
    alias: string;
    ownPass?: boolean;
  },
): Handler<UnloadedDescriptor<API>> {
  const desc = getItemDescriptor(pair);
  if (desc) {
    return desc;
  }

  // 插件名
  let name;
  // 插件选项
  let options;
  // 插件值
  let value: any = pair;
  // 插件
  if (Array.isArray(value)) {
    if (value.length === 3) {
      [value, options, name] = value;
    } else {
      [value, options] = value;
    }
  }

  let file = undefined;
  let filepath = null;
  if (typeof value === "string") {
    if (typeof type !== "string") {
      throw new Error(
        "To resolve a string-based item, the type of item must be given",
      );
    }
    const resolver = type === "plugin" ? loadPlugin : loadPreset;
    const request = value;

    ({ filepath, value } = yield* resolver(value, dirname));

    file = {
      request, // 插件请求路径
      resolved: filepath, // 解析后的插件路径(绝对路径)
    };
  }

  if (!value) {
    throw new Error(`Unexpected falsy value: ${String(value)}`);
  }

  if (typeof value === "object" && value.__esModule) {
    if (value.default) {
      value = value.default;
    } else {
      throw new Error("Must export a default export when using ES6 modules.");
    }
  }

  if (typeof value !== "object" && typeof value !== "function") {
    throw new Error(
      `Unsupported format: ${typeof value}. Expected an object or a function.`,
    );
  }

  if (filepath !== null && typeof value === "object" && value) {
    // We allow object values for plugins/presets nested directly within a
    // config object, because it can be useful to define them in nested
    // configuration contexts.
    throw new Error(
      `Plugin/Preset files are not allowed to export objects, only functions. In ${filepath}`,
    );
  }

  return {
    name, // 插件名
    alias: filepath || alias, // 别名
    value, // 插件值, 必须是函数
    options, // 插件选项
    dirname, // 目录路径
    ownPass, // 是否拥有自己的处理流程
    file, // 文件信息
  };
}

// 无重复
function assertNoDuplicates<API>(items: Array<UnloadedDescriptor<API>>): void {
  const map = new Map();

  for (const item of items) {
    if (typeof item.value !== "function") continue;

    let nameMap = map.get(item.value);
    if (!nameMap) {
      nameMap = new Set();
      map.set(item.value, nameMap);
    }

    if (nameMap.has(item.name)) {
      const conflicts = items.filter(i => i.value === item.value);
      throw new Error(
        [
          `Duplicate plugin/preset detected.`,
          `If you'd like to use two separate instances of a plugin,`,
          `they need separate names, e.g.`,
          ``,
          `  plugins: [`,
          `    ['some-plugin', {}],`,
          `    ['some-plugin', {}, 'some unique name'],`,
          `  ]`,
          ``,
          `Duplicates detected are:`,
          `${JSON.stringify(conflicts, null, 2)}`,
        ].join("\n"),
      );
    }

    nameMap.add(item.name);
  }
}
