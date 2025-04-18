import type {Circus} from '@jest/types';
import eventHandler from './eventHandler';
import formatNodeAssertErrors from './formatNodeAssertErrors';
import {STATE_SYM} from './types';
import {makeDescribe} from './utils';

const eventHandlers: Array<Circus.EventHandler> = [
  eventHandler,
  formatNodeAssertErrors,
];

export const ROOT_DESCRIBE_BLOCK_NAME = 'ROOT_DESCRIBE_BLOCK';

// 创建 状态
const createState = (): Circus.State => {
  const ROOT_DESCRIBE_BLOCK = makeDescribe(ROOT_DESCRIBE_BLOCK_NAME);
  return {
    currentDescribeBlock: ROOT_DESCRIBE_BLOCK, // 当前描述块
    currentlyRunningTest: null, // 当前运行的单测文件
    expand: undefined,
    hasFocusedTests: false, // 标识： 是否有要运行的描述块 或者 单测文件
    hasStarted: false, // 标识：是否正在运行单测文件
    includeTestLocationInResult: false, // 
    maxConcurrency: 5, // 同时运行单测文件的数量
    parentProcess: null, // 父处理器
    rootDescribeBlock: ROOT_DESCRIBE_BLOCK, // 根描述块
    seed: 0,
    testNamePattern: null, // 
    testTimeout: 5000, // 测试的默认超时
    unhandledErrors: [], // 等待处理的错误
  };
};

// 重置 状态
export const resetState = (): void => {
  global[STATE_SYM] = createState();
};

resetState();

// 获取 状态
export const getState = (): Circus.State => global[STATE_SYM];
// 设置 状态
export const setState = (state: Circus.State): Circus.State =>
  (global[STATE_SYM] = state);

// 派发
export const dispatch = async (event: Circus.AsyncEvent): Promise<void> => {
  for (const handler of eventHandlers) {
    await handler(event, getState());
  }
};

// 同步派发
export const dispatchSync = (event: Circus.SyncEvent): void => {
  for (const handler of eventHandlers) {
    handler(event, getState());
  }
};

// 添加 事件处理器
export const addEventHandler = (handler: Circus.EventHandler): void => {
  eventHandlers.push(handler);
};
