import {performance} from 'perf_hooks';
import chalk = require('chalk');
import exit = require('exit');
import * as fs from 'graceful-fs';
import {CustomConsole} from '@jest/console';
import type {AggregatedResult, TestContext} from '@jest/test-result';
import type {Config} from '@jest/types';
import type {ChangedFilesPromise} from 'jest-changed-files';
import {readConfigs} from 'jest-config';
import type {IHasteMap} from 'jest-haste-map';
import Runtime from 'jest-runtime';
import {createDirectory, pluralize, preRunMessage} from 'jest-util';
import {TestWatcher} from 'jest-watcher';
import {formatHandleErrors} from '../collectHandles';
import getChangedFilesPromise from '../getChangedFilesPromise';
import getConfigsOfProjectsToRun from '../getConfigsOfProjectsToRun';
import getProjectNamesMissingWarning from '../getProjectNamesMissingWarning';
import getSelectProjectsMessage from '../getSelectProjectsMessage';
import createContext from '../lib/createContext';
import handleDeprecationWarnings from '../lib/handleDeprecationWarnings';
import logDebugMessages from '../lib/logDebugMessages';
import runJest from '../runJest';
import type {Filter} from '../types';
import watch from '../watch';

const {print: preRunMessagePrint} = preRunMessage;

type OnCompleteCallback = (results: AggregatedResult) => void | undefined;

// 运行命令行
export async function runCLI(
  argv: Config.Argv,
  projects: Array<string>,
): Promise<{
  results: AggregatedResult;
  globalConfig: Config.GlobalConfig;
}> {
  performance.mark('jest/runCLI:start');
  let results: AggregatedResult | undefined;

  // If we output a JSON object, we can't write anything to stdout, since
  // it'll break the JSON structure and it won't be valid.
  const outputStream =
    argv.json || argv.useStderr ? process.stderr : process.stdout;

  // 从 命令行参数 和 项目地址 中读取 配置对象
  const {globalConfig, configs, hasDeprecationWarnings} = await readConfigs(
    argv,
    projects,
  );

  // 解析 命令行参数
  if (argv.debug) {
    logDebugMessages(globalConfig, configs, outputStream);
  }

  if (argv.showConfig) {
    logDebugMessages(globalConfig, configs, process.stdout);
    exit(0);
  }

  if (argv.clearCache) {
    // stick in a Set to dedupe the deletions
    new Set(configs.map(config => config.cacheDirectory)).forEach(
      cacheDirectory => {
        fs.rmSync(cacheDirectory, {force: true, recursive: true});
        process.stdout.write(`Cleared ${cacheDirectory}\n`);
      },
    );

    exit(0);
  }

  // 从 命令行选项中 筛选 项目配置
  const configsOfProjectsToRun = getConfigsOfProjectsToRun(configs, {
    ignoreProjects: argv.ignoreProjects, // 忽略指定项目的测试
    selectProjects: argv.selectProjects, // 运行指定项目的测试
  });
  if (argv.selectProjects || argv.ignoreProjects) {
    const namesMissingWarning = getProjectNamesMissingWarning(configs, {
      ignoreProjects: argv.ignoreProjects,
      selectProjects: argv.selectProjects,
    });
    if (namesMissingWarning) {
      outputStream.write(namesMissingWarning);
    }
    outputStream.write(
      getSelectProjectsMessage(configsOfProjectsToRun, {
        ignoreProjects: argv.ignoreProjects,
        selectProjects: argv.selectProjects,
      }),
    );
  }

  await _run10000(
    globalConfig,
    configsOfProjectsToRun,
    hasDeprecationWarnings,
    outputStream,
    r => {
      results = r;
    },
  );

  if (argv.watch || argv.watchAll) {
    // If in watch mode, return the promise that will never resolve.
    // If the watch mode is interrupted, watch should handle the process
    // shutdown.
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    return new Promise(() => {});
  }

  if (!results) {
    throw new Error(
      'AggregatedResult must be present after test run is complete',
    );
  }

  const {openHandles} = results;

  if (openHandles && openHandles.length) {
    const formatted = formatHandleErrors(openHandles, configs[0]);

    const openHandlesString = pluralize('open handle', formatted.length, 's');

    const message =
      chalk.red(
        `\nJest has detected the following ${openHandlesString} potentially keeping Jest from exiting:\n\n`,
      ) + formatted.join('\n\n');

    console.error(message);
  }

  performance.mark('jest/runCLI:end');
  return {globalConfig, results};
}

// 
const buildContextsAndHasteMaps = async (
  configs: Array<Config.ProjectConfig>,
  globalConfig: Config.GlobalConfig,
  outputStream: NodeJS.WriteStream,
) => {
  const hasteMapInstances = Array(configs.length);
  const contexts = await Promise.all(
    configs.map(async (config, index) => {
      createDirectory(config.cacheDirectory);
      const hasteMapInstance = await Runtime.createHasteMap(config, {
        console: new CustomConsole(outputStream, outputStream),
        maxWorkers: Math.max(
          1,
          Math.floor(globalConfig.maxWorkers / configs.length),
        ),
        resetCache: !config.cache,
        watch: globalConfig.watch || globalConfig.watchAll,
        watchman: globalConfig.watchman,
        workerThreads: globalConfig.workerThreads,
      });
      hasteMapInstances[index] = hasteMapInstance;
      return createContext(config, await hasteMapInstance.build());
    }),
  );

  return {contexts, hasteMapInstances};
};

// 
const _run10000 = async (
  globalConfig: Config.GlobalConfig,
  configs: Array<Config.ProjectConfig>,
  hasDeprecationWarnings: boolean,
  outputStream: NodeJS.WriteStream,
  onComplete: OnCompleteCallback,
) => {
  
  // 尝试根据当前存储库中哪些文件已更改来确定要运行哪些测试
  const changedFilesPromise = getChangedFilesPromise(globalConfig, configs);
  if (changedFilesPromise) {
    performance.mark('jest/getChangedFiles:start');
    changedFilesPromise.finally(() => {
      performance.mark('jest/getChangedFiles:end');
    });
  }

  // 该异步函数接收一个测试路径列表，
  // 可以通过返回形状为 { filtered: Array<{ test: string }> } 的对象
  // 来操作该列表以排除测试运行。
  let filter: Filter | undefined;
  if (globalConfig.filter && !globalConfig.skipFilter) {
    const rawFilter = require(globalConfig.filter);
    let filterSetupPromise: Promise<unknown | undefined> | undefined;
    if (rawFilter.setup) {
      // Wrap filter setup Promise to avoid "uncaught Promise" error.
      // If an error is returned, we surface it in the return value.
      filterSetupPromise = (async () => {
        try {
          await rawFilter.setup();
        } catch (err) {
          return err;
        }
        return undefined;
      })();
    }
    filter = async (testPaths: Array<string>) => {
      if (filterSetupPromise) {
        // Expect an undefined return value unless there was an error.
        const err = await filterSetupPromise;
        if (err) {
          throw err;
        }
      }
      return rawFilter(testPaths);
    };
  }

  // 内部文件爬虫/缓存系统
  performance.mark('jest/buildContextsAndHasteMaps:start');
  const {contexts, hasteMapInstances} = await buildContextsAndHasteMaps(
    configs,
    globalConfig,
    outputStream,
  );
  performance.mark('jest/buildContextsAndHasteMaps:end');

  globalConfig.watch || globalConfig.watchAll
    ? await runWatch(
        contexts,
        configs,
        hasDeprecationWarnings,
        globalConfig,
        outputStream,
        hasteMapInstances,
        filter,
      )
    : await runWithoutWatch(
        globalConfig,
        contexts,
        outputStream,
        onComplete,
        changedFilesPromise,
        filter,
      );
};

// 
const runWatch = async (
  contexts: Array<TestContext>,
  _configs: Array<Config.ProjectConfig>,
  hasDeprecationWarnings: boolean,
  globalConfig: Config.GlobalConfig,
  outputStream: NodeJS.WriteStream,
  hasteMapInstances: Array<IHasteMap>,
  filter?: Filter,
) => {
  if (hasDeprecationWarnings) {
    try {
      await handleDeprecationWarnings(outputStream, process.stdin);
      return await watch(
        globalConfig,
        contexts,
        outputStream,
        hasteMapInstances,
        undefined,
        undefined,
        filter,
      );
    } catch {
      exit(0);
    }
  }

  return watch(
    globalConfig,
    contexts,
    outputStream,
    hasteMapInstances,
    undefined,
    undefined,
    filter,
  );
};

// 
const runWithoutWatch = async (
  globalConfig: Config.GlobalConfig,
  contexts: Array<TestContext>,
  outputStream: NodeJS.WriteStream,
  onComplete: OnCompleteCallback,
  changedFilesPromise?: ChangedFilesPromise,
  filter?: Filter,
) => {
  const startRun = async (): Promise<void | null> => {
    if (!globalConfig.listTests) {
      preRunMessagePrint(outputStream);
    }
    return runJest({
      changedFilesPromise,
      contexts,
      failedTestsCache: undefined,
      filter,
      globalConfig,
      onComplete,
      outputStream,
      startRun,
      testWatcher: new TestWatcher({isWatchMode: false}),
    });
  };
  return startRun();
};
