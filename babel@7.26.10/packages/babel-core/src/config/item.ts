import type { Handler } from "gensync";
import type { PluginTarget, PluginOptions } from "./validation/options.ts";

import path from "path";
import { createDescriptor } from "./config-descriptors.ts";

import type { UnloadedDescriptor } from "./config-descriptors.ts";

// 从描述符创建配置项
export function createItemFromDescriptor<API>(
  desc: UnloadedDescriptor<API>,
): ConfigItem<API> {
  return new ConfigItem(desc);
}

// 创建配置项
export function* createConfigItem<API>(
  value:
    | PluginTarget
    | [PluginTarget, PluginOptions]
    | [PluginTarget, PluginOptions, string | void],
  {
    dirname = ".",
    type,
  }: {
    dirname?: string;
    type?: "preset" | "plugin";
  } = {},
): Handler<ConfigItem<API>> {
  // 创建描述符
  const descriptor = yield* createDescriptor(value, path.resolve(dirname), {
    type,
    alias: "programmatic item",
  });

  // 从描述符创建配置项
  return createItemFromDescriptor(descriptor);
}

// 配置项的唯一标识符号
const CONFIG_ITEM_BRAND = Symbol.for("@babel/core@7 - ConfigItem");

// 获取配置项的描述符
export function getItemDescriptor<API>(
  item: unknown,
): UnloadedDescriptor<API> | void {
  if ((item as any)?.[CONFIG_ITEM_BRAND]) {
    return (item as ConfigItem<API>)._descriptor;
  }

  return undefined;
}

export type { ConfigItem };

// 配置项
class ConfigItem<API> {
  // 描述符
  _descriptor: UnloadedDescriptor<API>;

  // 标识
  [CONFIG_ITEM_BRAND] = true;
  
  // 解析值
  value: object | Function;

  /**
   * 传递给项的选项（如果有）
   * 修改此属性将导致未定义的行为
   * "false"表示此项已被禁用
   */
  options: object | void | false;

  //  此项选项的相对目录
  dirname: string;

  // 插件名
  name: string | void;

  // 加载项的文件的元数据
  file: {
    // 请求的路径，例如"@babel/env"
    request: string;
    // 文件的解析绝对路径
    resolved: string;
  } | void;

  constructor(descriptor: UnloadedDescriptor<API>) {
    this._descriptor = descriptor;
    Object.defineProperty(this, "_descriptor", { enumerable: false });

    Object.defineProperty(this, CONFIG_ITEM_BRAND, { enumerable: false });

    // 初始化公共属性
    this.value = this._descriptor.value;
    this.options = this._descriptor.options;
    this.dirname = this._descriptor.dirname;
    this.name = this._descriptor.name;
    this.file = this._descriptor.file
      ? {
          request: this._descriptor.file.request,
          resolved: this._descriptor.file.resolved,
        }
      : undefined;

    Object.freeze(this);
  }
}

Object.freeze(ConfigItem.prototype);
