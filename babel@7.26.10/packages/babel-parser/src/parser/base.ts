import type { OptionFlags, Options } from "../options.ts";
import type State from "../tokenizer/state.ts";
import type { PluginsMap } from "./index.ts";
import type ScopeHandler from "../util/scope.ts";
import type ExpressionScopeHandler from "../util/expression-scope.ts";
import type ClassScopeHandler from "../util/class-scope.ts";
import type ProductionParameterHandler from "../util/production-parameter.ts";
import type {
  ParserPluginWithOptions,
  PluginConfig,
  PluginOptions,
} from "../typings.ts";
import type * as N from "../types.ts";

// 基础分析器
// 主要是 位置偏移 和 插件获取
export default class BaseParser {
  // Properties set by constructor in index.js
  // 
  declare options: Options;
  // 
  declare optionFlags: OptionFlags;
  // 
  declare inModule: boolean;
  // 
  declare scope: ScopeHandler<any>;
  // 
  declare classScope: ClassScopeHandler;
  // 
  declare prodParam: ProductionParameterHandler;
  // 
  declare expressionScope: ExpressionScopeHandler;
  // 插件
  declare plugins: PluginsMap;
  // 文件名
  declare filename: string | undefined | null;
  // 开始索引
  declare startIndex: number;
  // Names of exports store. `default` is stored as a name for both
  // `export default foo;` and `export { foo as default };`.
  declare exportedIdentifiers: Set<string>;
  // 
  sawUnambiguousESM: boolean = false;
  // 
  ambiguousScriptDifferentAst: boolean = false;

  // Initialized by Tokenizer
  // 状态
  declare state: State;
  // input and length are not in state as they are constant and we do
  // not want to ever copy them, which happens if state gets cloned
  // 输入
  declare input: string;
  // 输入长度
  declare length: number;
  // 注释节点集合
  declare comments: Array<N.Comment>;

  // 输入位置转偏移位置
  sourceToOffsetPos(sourcePos: number) {
    return sourcePos + this.startIndex;
  }

  // 偏移位置转输入位置
  offsetToSourcePos(offsetPos: number) {
    return offsetPos - this.startIndex;
  }

  // 是否有插件
  // 此方法接受字符串（插件名称）或数组对
  // （插件名称和选项对象）。如果给出了选项对象，
  // 然后非递归地检查每个值是否与该值一致
  // 插件的实际选项值。
  hasPlugin(pluginConfig: PluginConfig): boolean {
    if (typeof pluginConfig === "string") {
      return this.plugins.has(pluginConfig);
    } else {
      const [pluginName, pluginOptions] = pluginConfig;
      if (!this.hasPlugin(pluginName)) {
        return false;
      }
      const actualOptions = this.plugins.get(pluginName);
      for (const key of Object.keys(
        pluginOptions,
      ) as (keyof typeof pluginOptions)[]) {
        if (actualOptions?.[key] !== pluginOptions[key]) {
          return false;
        }
      }
      return true;
    }
  }

  // 获取某个插件选项
  getPluginOption<
    PluginName extends ParserPluginWithOptions[0],
    OptionName extends keyof PluginOptions<PluginName>,
  >(plugin: PluginName, name: OptionName) {
    return (this.plugins.get(plugin) as null | PluginOptions<PluginName>)?.[
      name
    ];
  }
}
