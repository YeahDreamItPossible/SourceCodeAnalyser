import chalk = require('chalk');
import * as fs from 'graceful-fs';
import sourcemapSupport = require('source-map-support');
import {
  BufferedConsole,
  CustomConsole,
  LogMessage,
  LogType,
  NullConsole,
  getConsoleOutput,
} from '@jest/console';
import type {JestEnvironment} from '@jest/environment';
import type {TestFileEvent, TestResult} from '@jest/test-result';
import {createScriptTransformer} from '@jest/transform';
import type {Config} from '@jest/types';
import * as docblock from 'jest-docblock';
import LeakDetector from 'jest-leak-detector';
import {formatExecError} from 'jest-message-util';
import Resolver, {resolveTestEnvironment} from 'jest-resolve';
import type RuntimeClass from 'jest-runtime';
import {ErrorWithStack, interopRequireDefault, setGlobal} from 'jest-util';
import type {TestFramework, TestRunnerContext} from './types';

type RunTestInternalResult = {
  leakDetector: LeakDetector | null;
  result: TestResult;
};

function freezeConsole(
  testConsole: BufferedConsole | CustomConsole | NullConsole,
  config: Config.ProjectConfig,
) {
  // @ts-expect-error: `_log` is `private` - we should figure out some proper API here
  testConsole._log = function fakeConsolePush(
    _type: LogType,
    message: LogMessage,
  ) {
    const error = new ErrorWithStack(
      `${chalk.red(
        `${chalk.bold(
          'Cannot log after tests are done.',
        )} Did you forget to wait for something async in your test?`,
      )}\nAttempted to log "${message}".`,
      fakeConsolePush,
    );

    const formattedError = formatExecError(
      error,
      config,
      {noStackTrace: false},
      undefined,
      true,
    );

    process.stderr.write(`\n${formattedError}\n`);
    process.exitCode = 1;
  };
}

// 将“runTest”的核心保留为一个单独的函数（如“runTestInternal”）是能够检测内存泄漏的关键。
// 由于所有变量都是局部变量函数，
// 当“runTestInternal”完成执行时，
// 它们都可以释放，
// 除非有其他东西在泄漏它们（这就是为什么我们可以检测到泄漏！）。
// 如果我们将所有代码放在一个函数中，
// 我们应该手动取消所有用于验证是否存在不可维护的泄漏和错误的参考易感。
// 这就是为什么“runTestInternal”不能内联在“runTest”中的原因。
async function runTestInternal(
  path: string,
  globalConfig: Config.GlobalConfig,
  projectConfig: Config.ProjectConfig,
  resolver: Resolver,
  context: TestRunnerContext,
  sendMessageToJest?: TestFileEvent,
): Promise<RunTestInternalResult> {
  // 读取源文件
  const testSource = fs.readFileSync(path, 'utf8');
  const docblockPragmas = docblock.parse(docblock.extract(testSource));
  const customEnvironment = docblockPragmas['jest-environment'];

  let testEnvironment = projectConfig.testEnvironment;

  if (customEnvironment) {
    if (Array.isArray(customEnvironment)) {
      throw new Error(
        `You can only define a single test environment through docblocks, got "${customEnvironment.join(
          ', ',
        )}"`,
      );
    }
    testEnvironment = resolveTestEnvironment({
      ...projectConfig,
      requireResolveFunction: require.resolve,
      testEnvironment: customEnvironment,
    });
  }

  const cacheFS = new Map([[path, testSource]]);
  // 获取 代码转换器
  const transformer = await createScriptTransformer(projectConfig, cacheFS);

  // 获取 运行环境类
  const TestEnvironment: typeof JestEnvironment =
    await transformer.requireAndTranspileModule(testEnvironment);
  // 获取 单测框架
  const testFramework: TestFramework =
    await transformer.requireAndTranspileModule(
      process.env.JEST_JASMINE === '1'
        ? require.resolve('jest-jasmine2')
        : projectConfig.testRunner,
    );
  // 获取 运行时类
  const Runtime: typeof RuntimeClass = interopRequireDefault(
    projectConfig.runtime
      ? require(projectConfig.runtime)
      : require('jest-runtime'),
  ).default;

  const consoleOut = globalConfig.useStderr ? process.stderr : process.stdout;
  const consoleFormatter = (type: LogType, message: LogMessage) =>
    getConsoleOutput(
      // 4 = the console call is buried 4 stack frames deep
      BufferedConsole.write([], type, message, 4),
      projectConfig,
      globalConfig,
    );

  let testConsole;
  if (globalConfig.silent) {
    testConsole = new NullConsole(consoleOut, consoleOut, consoleFormatter);
  } else if (globalConfig.verbose) {
    testConsole = new CustomConsole(consoleOut, consoleOut, consoleFormatter);
  } else {
    testConsole = new BufferedConsole();
  }

  let extraTestEnvironmentOptions;

  const docblockEnvironmentOptions =
    docblockPragmas['jest-environment-options'];

  if (typeof docblockEnvironmentOptions === 'string') {
    extraTestEnvironmentOptions = JSON.parse(docblockEnvironmentOptions);
  }

  // 创建 运行环境 的实例
  const environment = new TestEnvironment(
    {
      globalConfig,
      projectConfig: extraTestEnvironmentOptions
        ? {
            ...projectConfig,
            testEnvironmentOptions: {
              ...projectConfig.testEnvironmentOptions,
              ...extraTestEnvironmentOptions,
            },
          }
        : projectConfig,
    },
    {
      console: testConsole,
      docblockPragmas,
      testPath: path,
    },
  );

  if (typeof environment.getVmContext !== 'function') {
    console.error(
      `Test environment found at "${testEnvironment}" does not export a "getVmContext" method, which is mandatory from Jest 27. This method is a replacement for "runScript".`,
    );
    process.exit(1);
  }

  const leakDetector = projectConfig.detectLeaks
    ? new LeakDetector(environment)
    : null;

  setGlobal(environment.global, 'console', testConsole);

  // 创建 运行时 的实例
  const runtime = new Runtime(
    projectConfig,
    environment,
    resolver,
    transformer,
    cacheFS,
    {
      changedFiles: context.changedFiles,
      collectCoverage: globalConfig.collectCoverage,
      collectCoverageFrom: globalConfig.collectCoverageFrom,
      coverageProvider: globalConfig.coverageProvider,
      sourcesRelatedToTestsInChangedFiles:
        context.sourcesRelatedToTestsInChangedFiles,
    },
    path,
    globalConfig,
  );

  let isTornDown = false;

  const tearDownEnv = async () => {
    if (!isTornDown) {
      runtime.teardown();
      await environment.teardown();
      isTornDown = true;
    }
  };

  const start = Date.now();

  // 执行 setupFiles 文件
  // 每个 单测文件执行 前都会执行所有的 setupFiles 文件
  for (const path of projectConfig.setupFiles) {
    const esm = runtime.unstable_shouldLoadAsEsm(path);

    if (esm) {
      await runtime.unstable_importModule(path);
    } else {
      const setupFile = runtime.requireModule(path);
      if (typeof setupFile === 'function') {
        await setupFile();
      }
    }
  }

  const sourcemapOptions: sourcemapSupport.Options = {
    environment: 'node',
    handleUncaughtExceptions: false,
    retrieveSourceMap: source => {
      const sourceMapSource = runtime.getSourceMaps()?.get(source);

      if (sourceMapSource) {
        try {
          return {
            map: JSON.parse(fs.readFileSync(sourceMapSource, 'utf8')),
            url: source,
          };
        } catch {}
      }
      return null;
    },
  };

  // For tests
  runtime
    .requireInternalModule<typeof import('source-map-support')>(
      require.resolve('source-map-support'),
    )
    .install(sourcemapOptions);

  // For runtime errors
  sourcemapSupport.install(sourcemapOptions);

  if (
    environment.global &&
    environment.global.process &&
    environment.global.process.exit
  ) {
    const realExit = environment.global.process.exit;

    environment.global.process.exit = function exit(...args: Array<any>) {
      const error = new ErrorWithStack(
        `process.exit called with "${args.join(', ')}"`,
        exit,
      );

      const formattedError = formatExecError(
        error,
        projectConfig,
        {noStackTrace: false},
        undefined,
        true,
      );

      process.stderr.write(formattedError);

      return realExit(...args);
    };
  }

  // if we don't have `getVmContext` on the env skip coverage
  const collectV8Coverage =
    globalConfig.collectCoverage &&
    globalConfig.coverageProvider === 'v8' &&
    typeof environment.getVmContext === 'function';

  // Node's error-message stack size is limited at 10, but it's pretty useful
  // to see more than that when a test fails.
  Error.stackTraceLimit = 100;
  try {
    await environment.setup();

    let result: TestResult;

    try {
      if (collectV8Coverage) {
        await runtime.collectV8Coverage();
      }
      result = await testFramework(
        globalConfig,
        projectConfig,
        environment,
        runtime,
        path,
        sendMessageToJest,
      );
    } catch (err: any) {
      // Access stack before uninstalling sourcemaps
      err.stack;

      throw err;
    } finally {
      if (collectV8Coverage) {
        await runtime.stopCollectingV8Coverage();
      }
    }

    freezeConsole(testConsole, projectConfig);

    const testCount =
      result.numPassingTests +
      result.numFailingTests +
      result.numPendingTests +
      result.numTodoTests;

    const end = Date.now();
    const testRuntime = end - start;
    result.perfStats = {
      end,
      runtime: testRuntime,
      slow: testRuntime / 1000 > projectConfig.slowTestThreshold,
      start,
    };
    result.testFilePath = path;
    result.console = testConsole.getBuffer();
    result.skipped = testCount === result.numPendingTests;
    result.displayName = projectConfig.displayName;

    const coverage = runtime.getAllCoverageInfoCopy();
    if (coverage) {
      const coverageKeys = Object.keys(coverage);
      if (coverageKeys.length) {
        result.coverage = coverage;
      }
    }

    if (collectV8Coverage) {
      const v8Coverage = runtime.getAllV8CoverageInfoCopy();
      if (v8Coverage && v8Coverage.length > 0) {
        result.v8Coverage = v8Coverage;
      }
    }

    if (globalConfig.logHeapUsage) {
      // @ts-expect-error - doesn't exist on globalThis
      globalThis.gc?.();

      result.memoryUsage = process.memoryUsage().heapUsed;
    }

    await tearDownEnv();

    // Delay the resolution to allow log messages to be output.
    return await new Promise(resolve => {
      setImmediate(() => resolve({leakDetector, result}));
    });
  } finally {
    await tearDownEnv();

    sourcemapSupport.resetRetrieveHandlers();
  }
}

// 运行单测
export default async function runTest(
  path: string,
  globalConfig: Config.GlobalConfig,
  config: Config.ProjectConfig,
  resolver: Resolver,
  context: TestRunnerContext,
  sendMessageToJest?: TestFileEvent,
): Promise<TestResult> {
  const {leakDetector, result} = await runTestInternal(
    path,
    globalConfig,
    config,
    resolver,
    context,
    sendMessageToJest,
  );

  if (leakDetector) {
    // We wanna allow a tiny but time to pass to allow last-minute cleanup
    await new Promise(resolve => setTimeout(resolve, 100));

    // Resolve leak detector, outside the "runTestInternal" closure.
    result.leaks = await leakDetector.isLeaking();
  } else {
    result.leaks = false;
  }

  return result;
}
