import {Context, createContext, runInContext} from 'vm';
import type {
  EnvironmentContext,
  JestEnvironment,
  JestEnvironmentConfig,
} from '@jest/environment';
import {LegacyFakeTimers, ModernFakeTimers} from '@jest/fake-timers';
import type {Global} from '@jest/types';
import {ModuleMocker} from 'jest-mock';
import {installCommonGlobals} from 'jest-util';

type Timer = {
  id: number;
  ref: () => Timer;
  unref: () => Timer;
};

// 以下全局变量不想使用
// 原因：
// 要么已废弃, 要么手动设置
const denyList = new Set([
  'GLOBAL',
  'root',
  'global',
  'globalThis',
  'Buffer',
  'ArrayBuffer',
  'Uint8Array',
  'jest-symbol-do-not-touch',
]);

type GlobalProperties = Array<keyof typeof globalThis>;

const nodeGlobals = new Map(
  (Object.getOwnPropertyNames(globalThis) as GlobalProperties)
    .filter(global => !denyList.has(global as string))
    .map(nodeGlobalsKey => {
      const descriptor = Object.getOwnPropertyDescriptor(
        globalThis,
        nodeGlobalsKey,
      );

      if (!descriptor) {
        throw new Error(
          `No property descriptor for ${nodeGlobalsKey}, this is a bug in Jest.`,
        );
      }

      return [nodeGlobalsKey, descriptor];
    }),
);

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

// Node环境
export default class NodeEnvironment implements JestEnvironment<Timer> {
  context: Context | null;
  fakeTimers: LegacyFakeTimers<Timer> | null;
  fakeTimersModern: ModernFakeTimers | null;
  global: Global.Global;
  moduleMocker: ModuleMocker | null;
  customExportConditions = ['node', 'node-addons'];
  private _configuredExportConditions?: Array<string>;

  constructor(config: JestEnvironmentConfig, _context: EnvironmentContext) {
    const {projectConfig} = config;
    this.context = createContext();
    // 当前运行环境的全局对象
    const global = runInContext(
      'this',
      Object.assign(this.context, projectConfig.testEnvironmentOptions),
    ) as Global.Global;
    this.global = global;

    const contextGlobals = new Set(
      Object.getOwnPropertyNames(global) as GlobalProperties,
    );
    for (const [nodeGlobalsKey, descriptor] of nodeGlobals) {
      if (!contextGlobals.has(nodeGlobalsKey)) {
        if (descriptor.configurable) {
          Object.defineProperty(global, nodeGlobalsKey, {
            configurable: true,
            enumerable: descriptor.enumerable,
            get() {
              const value = globalThis[nodeGlobalsKey];

              // override lazy getter
              Object.defineProperty(global, nodeGlobalsKey, {
                configurable: true,
                enumerable: descriptor.enumerable,
                value,
                writable: true,
              });

              return value;
            },
            set(value: unknown) {
              // override lazy getter
              Object.defineProperty(global, nodeGlobalsKey, {
                configurable: true,
                enumerable: descriptor.enumerable,
                value,
                writable: true,
              });
            },
          });
        } else if ('value' in descriptor) {
          Object.defineProperty(global, nodeGlobalsKey, {
            configurable: false,
            enumerable: descriptor.enumerable,
            value: descriptor.value,
            writable: descriptor.writable,
          });
        } else {
          Object.defineProperty(global, nodeGlobalsKey, {
            configurable: false,
            enumerable: descriptor.enumerable,
            get: descriptor.get,
            set: descriptor.set,
          });
        }
      }
    }

    global.global = global;
    global.Buffer = Buffer;
    global.ArrayBuffer = ArrayBuffer;
    global.Uint8Array = Uint8Array;

    installCommonGlobals(global, projectConfig.globals);

    // Node的错误消息堆栈默认大小限制在10，
    // 但当测试失败时，看到更多是非常有用的。
    global.Error.stackTraceLimit = 100;

    if ('customExportConditions' in projectConfig.testEnvironmentOptions) {
      const {customExportConditions} = projectConfig.testEnvironmentOptions;
      if (
        Array.isArray(customExportConditions) &&
        customExportConditions.every(isString)
      ) {
        this._configuredExportConditions = customExportConditions;
      } else {
        throw new Error(
          'Custom export conditions specified but they are not an array of strings',
        );
      }
    }

    // 模块模拟器
    this.moduleMocker = new ModuleMocker(global);

    const timerIdToRef = (id: number) => ({
      id,
      ref() {
        return this;
      },
      unref() {
        return this;
      },
    });
    const timerRefToId = (timer: Timer): number | undefined => timer?.id;
    // 模拟定时器
    // 模拟旧版定时器
    this.fakeTimers = new LegacyFakeTimers({
      config: projectConfig,
      global,
      moduleMocker: this.moduleMocker,
      timerConfig: {
        idToRef: timerIdToRef,
        refToId: timerRefToId,
      },
    });
    // 模拟现代定时器
    this.fakeTimersModern = new ModernFakeTimers({
      config: projectConfig,
      global,
    });
  }

  // 启动
  async setup(): Promise<void> {}

  // 拆卸
  async teardown(): Promise<void> {
    if (this.fakeTimers) {
      this.fakeTimers.dispose();
    }
    if (this.fakeTimersModern) {
      this.fakeTimersModern.dispose();
    }
    this.context = null;
    this.fakeTimers = null;
    this.fakeTimersModern = null;
  }

  exportConditions(): Array<string> {
    return this._configuredExportConditions ?? this.customExportConditions;
  }

  // 返回虚拟机上下文
  getVmContext(): Context | null {
    return this.context;
  }
}

export const TestEnvironment = NodeEnvironment;
