import colors from "picocolors";
import type { Logger } from "./logger";
import type { ResolvedConfig, ResolvedEnvironmentOptions } from "./config";
import type { Plugin } from "./plugin";

const environmentColors = [
  colors.blue,
  colors.magenta,
  colors.green,
  colors.gray,
];

export function getDefaultResolvedEnvironmentOptions(
  config: ResolvedConfig
): ResolvedEnvironmentOptions {
  return {
    define: config.define,
    resolve: config.resolve,
    consumer: "server",
    webCompatible: false,
    dev: config.dev,
    build: config.build,
  };
}

// 局部环境
// 作用:
// 提供环境名, 环境配置, 环境选项
export class PartialEnvironment {
  name: string;
  // 顶层配置
  getTopLevelConfig(): ResolvedConfig {
    return this._topLevelConfig;
  }

  config: ResolvedConfig & ResolvedEnvironmentOptions;

  /**
   * @deprecated use environment.config instead
   **/
  get options(): ResolvedEnvironmentOptions {
    return this._options;
  }

  logger: Logger;

  _options: ResolvedEnvironmentOptions;

  _topLevelConfig: ResolvedConfig;

  constructor(
    name: string,
    topLevelConfig: ResolvedConfig,
    options: ResolvedEnvironmentOptions = topLevelConfig.environments[name]
  ) {
    if (!/^[\w$]+$/.test(name)) {
      throw new Error(
        `Invalid environment name "${name}". Environment names must only contain alphanumeric characters and "$", "_".`
      );
    }
    // 环境名
    this.name = name;
    // 配置
    this._topLevelConfig = topLevelConfig;
    // 环境选项
    this._options = options;
    // 代理
    this.config = new Proxy(
      options as ResolvedConfig & ResolvedEnvironmentOptions,
      {
        get: (target, prop: keyof ResolvedConfig) => {
          if (prop === "logger") {
            return this.logger;
          }
          if (prop in target) {
            return this._options[prop as keyof ResolvedEnvironmentOptions];
          }
          return this._topLevelConfig[prop];
        },
      }
    );
    const environment = colors.dim(`(${this.name})`);
    const colorIndex =
      [...this.name].reduce((acc, c) => acc + c.charCodeAt(0), 0) %
      environmentColors.length;
    const infoColor = environmentColors[colorIndex || 0];
    // 日志
    this.logger = {
      get hasWarned() {
        return topLevelConfig.logger.hasWarned;
      },
      info(msg, opts) {
        return topLevelConfig.logger.info(msg, {
          ...opts,
          environment: infoColor(environment),
        });
      },
      warn(msg, opts) {
        return topLevelConfig.logger.warn(msg, {
          ...opts,
          environment: colors.yellow(environment),
        });
      },
      warnOnce(msg, opts) {
        return topLevelConfig.logger.warnOnce(msg, {
          ...opts,
          environment: colors.yellow(environment),
        });
      },
      error(msg, opts) {
        return topLevelConfig.logger.error(msg, {
          ...opts,
          environment: colors.red(environment),
        });
      },
      clearScreen(type) {
        return topLevelConfig.logger.clearScreen(type);
      },
      hasErrorLogged(error) {
        return topLevelConfig.logger.hasErrorLogged(error);
      },
    };
  }
}

// 基础环境
// 作用:
// 插件系统
export class BaseEnvironment extends PartialEnvironment {
  // 插件系统
  get plugins(): Plugin[] {
    if (!this._plugins)
      throw new Error(
        `${this.name} environment.plugins called before initialized`
      );
    return this._plugins;
  }

  _plugins: Plugin[] | undefined;

  _initiated: boolean = false;

  constructor(
    name: string,
    config: ResolvedConfig,
    options: ResolvedEnvironmentOptions = config.environments[name]
  ) {
    super(name, config, options);
  }
}

// 未知环境
// 作用:
// 当环境不存在时, 使用未知环境
export class UnknownEnvironment extends BaseEnvironment {
  mode = "unknown" as const;
}
