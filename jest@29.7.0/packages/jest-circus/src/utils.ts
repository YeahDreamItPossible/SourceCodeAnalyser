import * as path from 'path';
import co from 'co';
import dedent from 'dedent';
import isGeneratorFn from 'is-generator-fn';
import slash = require('slash');
import StackUtils = require('stack-utils');
import type {AssertionResult, Status} from '@jest/test-result';
import type {Circus, Global} from '@jest/types';
import {
  ErrorWithStack,
  convertDescriptorToString,
  formatTime,
  invariant,
  isPromise,
} from 'jest-util';
import {format as prettyFormat} from 'pretty-format';
import {ROOT_DESCRIBE_BLOCK_NAME, getState} from './state';

const stackUtils = new StackUtils({cwd: 'A path that does not exist'});

const jestEachBuildDir = slash(path.dirname(require.resolve('jest-each')));

function takesDoneCallback(fn: Circus.AsyncFn): fn is Global.DoneTakingTestFn {
  return fn.length > 0;
}

function isGeneratorFunction(
  fn: Global.PromiseReturningTestFn | Global.GeneratorReturningTestFn,
): fn is Global.GeneratorReturningTestFn {
  return isGeneratorFn(fn);
}

// 描述块模板对象
export const makeDescribe = (
  name: Circus.BlockName,
  parent?: Circus.DescribeBlock,
  mode?: Circus.BlockMode,
): Circus.DescribeBlock => {
  let _mode = mode;
  if (parent && !mode) {
    // If not set explicitly, inherit from the parent describe.
    _mode = parent.mode;
  }

  return {
    type: 'describeBlock', // 
    children: [], // 测试文件队列
    hooks: [], // 钩子队列(beforeAll, beforeEach, ...)
    mode: _mode, // 
    name: convertDescriptorToString(name),
    parent,
    tests: [], // 测试文件队列(test ...)
  };
};

// 测试用例模板对象
export const makeTest = (
  fn: Circus.TestFn,
  mode: Circus.TestMode,
  concurrent: boolean,
  name: Circus.TestName,
  parent: Circus.DescribeBlock,
  timeout: number | undefined,
  asyncError: Circus.Exception,
  failing: boolean,
): Circus.TestEntry => ({
  type: 'test',
  asyncError,
  concurrent, // 同时运行
  duration: null,
  errors: [], // 错误
  failing,
  fn, // 函数
  invocations: 0, // 当前单测文件被调用次数
  mode,
  name: convertDescriptorToString(name),
  numPassingAsserts: 0,
  parent, // 当前测试用例
  retryReasons: [],
  seenDone: false,
  startedAt: null, // 开始运行时间
  status: null, // 状态(skip || todo || )
  timeout, // 耗时
});

// 判断该描述块中是否有要运行的测试用例
const hasEnabledTest = (describeBlock: Circus.DescribeBlock): boolean => {
  const {hasFocusedTests, testNamePattern} = getState();
  return describeBlock.children.some(child =>
    child.type === 'describeBlock'
      ? hasEnabledTest(child)
      : !(
          child.mode === 'skip' ||
          (hasFocusedTests && child.mode !== 'only') ||
          (testNamePattern && !testNamePattern.test(getTestID(child)))
        ),
  );
};

// 描述块钩子
type DescribeHooks = {
  beforeAll: Array<Circus.Hook>;
  afterAll: Array<Circus.Hook>;
};

// 返回 描述块中 的 beforeAll 和 afterAll 队列
export const getAllHooksForDescribe = (
  describe: Circus.DescribeBlock,
): DescribeHooks => {
  const result: DescribeHooks = {
    afterAll: [],
    beforeAll: [],
  };

  // 只有 描述块 中有要运行的 单测文件时
  if (hasEnabledTest(describe)) {
    for (const hook of describe.hooks) {
      switch (hook.type) {
        case 'beforeAll':
          result.beforeAll.push(hook);
          break;
        case 'afterAll':
          result.afterAll.push(hook);
          break;
      }
    }
  }

  return result;
};

// 测试用例钩子
type TestHooks = {
  beforeEach: Array<Circus.Hook>;
  afterEach: Array<Circus.Hook>;
};

// 返回 beforeEach 和 afterEach 队列
export const getEachHooksForTest = (test: Circus.TestEntry): TestHooks => {
  const result: TestHooks = {afterEach: [], beforeEach: []};
  if (test.concurrent) {
    return result;
  }

  let block: Circus.DescribeBlock | undefined | null = test.parent;

  do {
    const beforeEachForCurrentBlock = [];
    for (const hook of block.hooks) {
      switch (hook.type) {
        case 'beforeEach':
          beforeEachForCurrentBlock.push(hook);
          break;
        case 'afterEach':
          result.afterEach.push(hook);
          break;
      }
    }
    // beforeEach 钩子是从上到下执行的，与我们遍历它的方式相反
    result.beforeEach = [...beforeEachForCurrentBlock, ...result.beforeEach];
  } while ((block = block.parent));
  return result;
};

// 判断该描述块中是否有测试用例
export const describeBlockHasTests = (
  describe: Circus.DescribeBlock,
): boolean =>
  describe.children.some(
    child => child.type === 'test' || describeBlockHasTests(child),
  );

// 超时信息
const _makeTimeoutMessage = (
  timeout: number,
  isHook: boolean,
  takesDoneCallback: boolean,
) =>
  `Exceeded timeout of ${formatTime(timeout)} for a ${
    isHook ? 'hook' : 'test'
  }${
    takesDoneCallback ? ' while waiting for `done()` to be called' : ''
  }.\nAdd a timeout value to this test to increase the timeout, if this is a long-running test. See https://jestjs.io/docs/api#testname-fn-timeout.`;

const {setTimeout, clearTimeout} = globalThis;

function checkIsError(error: unknown): error is Error {
  return !!(error && (error as Error).message && (error as Error).stack);
}

// 执行
export const callAsyncCircusFn = (
  testOrHook: Circus.TestEntry | Circus.Hook,
  testContext: Circus.TestContext,
  {isHook, timeout}: {isHook: boolean; timeout: number},
): Promise<unknown> => {
  let timeoutID: NodeJS.Timeout;
  let completed = false;

  const {fn, asyncError} = testOrHook;
  const doneCallback = takesDoneCallback(fn);

  return new Promise<void>((resolve, reject) => {
    timeoutID = setTimeout(
      () => reject(_makeTimeoutMessage(timeout, isHook, doneCallback)),
      timeout,
    );

    // If this fn accepts `done` callback we return a promise that fulfills as
    // soon as `done` called.
    if (doneCallback) {
      let returnedValue: unknown = undefined;

      const done = (reason?: Error | string): void => {
        // We need to keep a stack here before the promise tick
        const errorAtDone = new ErrorWithStack(undefined, done);

        if (!completed && testOrHook.seenDone) {
          errorAtDone.message =
            'Expected done to be called once, but it was called multiple times.';

          if (reason) {
            errorAtDone.message += ` Reason: ${prettyFormat(reason, {
              maxDepth: 3,
            })}`;
          }
          reject(errorAtDone);
          throw errorAtDone;
        } else {
          testOrHook.seenDone = true;
        }

        // Use `Promise.resolve` to allow the event loop to go a single tick in case `done` is called synchronously
        Promise.resolve().then(() => {
          if (returnedValue !== undefined) {
            asyncError.message = dedent`
      Test functions cannot both take a 'done' callback and return something. Either use a 'done' callback, or return a promise.
      Returned value: ${prettyFormat(returnedValue, {maxDepth: 3})}
      `;
            return reject(asyncError);
          }

          let errorAsErrorObject: Error;
          if (checkIsError(reason)) {
            errorAsErrorObject = reason;
          } else {
            errorAsErrorObject = errorAtDone;
            errorAtDone.message = `Failed: ${prettyFormat(reason, {
              maxDepth: 3,
            })}`;
          }

          // Consider always throwing, regardless if `reason` is set or not
          if (completed && reason) {
            errorAsErrorObject.message = `Caught error after test environment was torn down\n\n${errorAsErrorObject.message}`;

            throw errorAsErrorObject;
          }

          return reason ? reject(errorAsErrorObject) : resolve();
        });
      };

      returnedValue = fn.call(testContext, done);

      return;
    }

    let returnedValue: Global.TestReturnValue;
    if (isGeneratorFunction(fn)) {
      returnedValue = co.wrap(fn).call({});
    } else {
      try {
        returnedValue = fn.call(testContext);
      } catch (error) {
        reject(error);
        return;
      }
    }

    if (isPromise(returnedValue)) {
      returnedValue.then(() => resolve(), reject);
      return;
    }

    if (!isHook && returnedValue !== undefined) {
      reject(
        new Error(
          dedent`
      test functions can only return Promise or undefined.
      Returned value: ${prettyFormat(returnedValue, {maxDepth: 3})}
      `,
        ),
      );
      return;
    }

    // Otherwise this test is synchronous, and if it didn't throw it means
    // it passed.
    resolve();
  })
    .then(() => {
      completed = true;
      // If timeout is not cleared/unrefed the node process won't exit until
      // it's resolved.
      timeoutID.unref?.();
      clearTimeout(timeoutID);
    })
    .catch(error => {
      completed = true;
      timeoutID.unref?.();
      clearTimeout(timeoutID);
      throw error;
    });
};

export const getTestDuration = (test: Circus.TestEntry): number | null => {
  const {startedAt} = test;
  return typeof startedAt === 'number' ? Date.now() - startedAt : null;
};

// 返回 描述块 的运行结果
export const makeRunResult = (
  describeBlock: Circus.DescribeBlock,
  unhandledErrors: Array<Error>,
): Circus.RunResult => ({
  testResults: makeTestResults(describeBlock),
  unhandledErrors: unhandledErrors.map(_getError).map(getErrorStack),
});

const getTestNamesPath = (test: Circus.TestEntry): Circus.TestNamesPath => {
  const titles = [];
  let parent: Circus.TestEntry | Circus.DescribeBlock | undefined = test;
  do {
    titles.unshift(parent.name);
  } while ((parent = parent.parent));

  return titles;
};

// 返回 单个单测文件 的执行结果
export const makeSingleTestResult = (
  test: Circus.TestEntry,
): Circus.TestResult => {
  const {includeTestLocationInResult} = getState();

  const {status} = test;
  invariant(status, 'Status should be present after tests are run.');

  const testPath = getTestNamesPath(test);

  let location = null;
  if (includeTestLocationInResult) {
    const stackLines = test.asyncError.stack.split('\n');
    const stackLine = stackLines[1];
    let parsedLine = stackUtils.parseLine(stackLine);
    if (parsedLine?.file?.startsWith(jestEachBuildDir)) {
      const stackLine = stackLines[4];
      parsedLine = stackUtils.parseLine(stackLine);
    }
    if (
      parsedLine &&
      typeof parsedLine.column === 'number' &&
      typeof parsedLine.line === 'number'
    ) {
      location = {
        column: parsedLine.column,
        line: parsedLine.line,
      };
    }
  }

  const errorsDetailed = test.errors.map(_getError);

  return {
    duration: test.duration,
    errors: errorsDetailed.map(getErrorStack),
    errorsDetailed,
    invocations: test.invocations,
    location,
    numPassingAsserts: test.numPassingAsserts,
    retryReasons: test.retryReasons.map(_getError).map(getErrorStack),
    status,
    testPath: Array.from(testPath),
  };
};

// 返回 描述块 中的执行结果
const makeTestResults = (
  describeBlock: Circus.DescribeBlock,
): Circus.TestResults => {
  const testResults: Circus.TestResults = [];

  for (const child of describeBlock.children) {
    switch (child.type) {
      case 'describeBlock': {
        testResults.push(...makeTestResults(child));
        break;
      }
      case 'test': {
        testResults.push(makeSingleTestResult(child));
        break;
      }
    }
  }

  return testResults;
};

// Return a string that identifies the test (concat of parent describe block
// names + test title)
export const getTestID = (test: Circus.TestEntry): string => {
  const testNamesPath = getTestNamesPath(test);
  testNamesPath.shift(); // remove TOP_DESCRIBE_BLOCK_NAME
  return testNamesPath.join(' ');
};

const _getError = (
  errors?: Circus.Exception | [Circus.Exception | undefined, Circus.Exception],
): Error => {
  let error;
  let asyncError;

  if (Array.isArray(errors)) {
    error = errors[0];
    asyncError = errors[1];
  } else {
    error = errors;
    asyncError = new Error();
  }

  if (error && (typeof error.stack === 'string' || error.message)) {
    return error;
  }

  asyncError.message = `thrown: ${prettyFormat(error, {maxDepth: 3})}`;

  return asyncError;
};

const getErrorStack = (error: Error): string =>
  typeof error.stack === 'string' ? error.stack : error.message;

export const addErrorToEachTestUnderDescribe = (
  describeBlock: Circus.DescribeBlock,
  error: Circus.Exception,
  asyncError: Circus.Exception,
): void => {
  for (const child of describeBlock.children) {
    switch (child.type) {
      case 'describeBlock':
        addErrorToEachTestUnderDescribe(child, error, asyncError);
        break;
      case 'test':
        child.errors.push([error, asyncError]);
        break;
    }
  }
};

type TestDescription = {
  ancestorTitles: Array<string>;
  fullName: string;
  title: string;
};

const resolveTestCaseStartInfo = (
  testNamesPath: Circus.TestNamesPath,
): TestDescription => {
  const ancestorTitles = testNamesPath.filter(
    name => name !== ROOT_DESCRIBE_BLOCK_NAME,
  );
  const fullName = ancestorTitles.join(' ');
  const title = testNamesPath[testNamesPath.length - 1];
  // remove title
  ancestorTitles.pop();
  return {
    ancestorTitles,
    fullName,
    title,
  };
};

export const parseSingleTestResult = (
  testResult: Circus.TestResult,
): AssertionResult => {
  let status: Status;
  if (testResult.status === 'skip') {
    status = 'pending';
  } else if (testResult.status === 'todo') {
    status = 'todo';
  } else if (testResult.errors.length > 0) {
    status = 'failed';
  } else {
    status = 'passed';
  }

  const {ancestorTitles, fullName, title} = resolveTestCaseStartInfo(
    testResult.testPath,
  );

  return {
    ancestorTitles,
    duration: testResult.duration,
    failureDetails: testResult.errorsDetailed,
    failureMessages: Array.from(testResult.errors),
    fullName,
    invocations: testResult.invocations,
    location: testResult.location,
    numPassingAsserts: testResult.numPassingAsserts,
    retryReasons: Array.from(testResult.retryReasons),
    status,
    title,
  };
};

export const createTestCaseStartInfo = (
  test: Circus.TestEntry,
): Circus.TestCaseStartInfo => {
  const testPath = getTestNamesPath(test);
  const {ancestorTitles, fullName, title} = resolveTestCaseStartInfo(testPath);

  return {
    ancestorTitles,
    fullName,
    mode: test.mode,
    startedAt: test.startedAt,
    title,
  };
};
