import * as path from 'path';
import chalk = require('chalk');
import exit = require('exit');
import yargs = require('yargs');
import {getVersion, runCLI} from '@jest/core';
import type {AggregatedResult} from '@jest/test-result';
import type {Config} from '@jest/types';
import {runCreate} from 'create-jest';
import {deprecationEntries} from 'jest-config';
import {clearLine, tryRealpath} from 'jest-util';
import {validateCLIOptions} from 'jest-validate';
import * as args from './args';

// 当运行 jest 命令行时 直接执行该 run 函数
export async function run(
  maybeArgv?: Array<string>,
  project?: string,
): Promise<void> {
  try {
    const argv = await buildArgv(maybeArgv);

    if (argv.init) {
      await runCreate();
      return;
    }

    const projects = getProjectListFromCLIArgs(argv, project);

    const {results, globalConfig} = await runCLI(argv, projects);
    readResultsAndExit(results, globalConfig);
  } catch (error: any) {
    clearLine(process.stderr);
    clearLine(process.stdout);
    if (error?.stack) {
      console.error(chalk.red(error.stack));
    } else {
      console.error(chalk.red(error));
    }

    exit(1);
    throw error;
  }
}

// 返回构建参数
/**
 * 当执行 npm run test:cc 时
 * {
 *    '$0': '/Users/didi/Desktop/Demo/my-jest/node_modules/.bin/jest',
 *    _: [],
 *    c: 'jest.config.js',
 *    config: 'jest.config.js'
 * }
 */
export async function buildArgv(
  maybeArgv?: Array<string>,
): Promise<Config.Argv> {
  const version =
    getVersion() +
    (__dirname.includes(`packages${path.sep}jest-cli`) ? '-dev' : '');

  const rawArgv: Array<string> = maybeArgv || process.argv.slice(2);
  const argv: Config.Argv = await yargs(rawArgv)
    .usage(args.usage)
    .version(version)
    .alias('help', 'h')
    .options(args.options)
    .epilogue(args.docs)
    .check(args.check).argv;

  validateCLIOptions(
    argv,
    {...args.options, deprecationEntries},
    // strip leading dashes
    Array.isArray(rawArgv)
      ? rawArgv.map(rawArgv => rawArgv.replace(/^--?/, ''))
      : Object.keys(rawArgv),
  );

  // strip dashed args
  return Object.keys(argv).reduce<Config.Argv>(
    (result, key) => {
      if (!key.includes('-')) {
        result[key] = argv[key];
      }
      return result;
    },
    {$0: argv.$0, _: argv._},
  );
}

// 从 命令行参数 中返回 项目列表
// 默认返回当前 命令行 所在工作目录
// 即: /Users/didi/Desktop/Github/MyGithub/SourceCodeAnalyser/jest@29.7.0
const getProjectListFromCLIArgs = (argv: Config.Argv, project?: string) => {
  const projects = argv.projects ? argv.projects : [];

  if (project) {
    projects.push(project);
  }

  if (!projects.length && process.platform === 'win32') {
    try {
      
      projects.push(tryRealpath(process.cwd()));
    } catch {
    }
  }

  // 返回当前 命令行 所在工作目录
  if (!projects.length) {
    projects.push(process.cwd());
  }

  return projects;
};

// 读取结果并退出进程
const readResultsAndExit = (
  result: AggregatedResult | null,
  globalConfig: Config.GlobalConfig,
) => {
  const code = !result || result.success ? 0 : globalConfig.testFailureExitCode;

  process.on('exit', () => {
    if (typeof code === 'number' && code !== 0) {
      process.exitCode = code;
    }
  });

  if (globalConfig.forceExit) {
    if (!globalConfig.detectOpenHandles) {
      console.warn(
        `${chalk.bold(
          'Force exiting Jest: ',
        )}Have you considered using \`--detectOpenHandles\` to detect ` +
          'async operations that kept running after all tests finished?',
      );
    }

    exit(code);
  } else if (
    !globalConfig.detectOpenHandles &&
    globalConfig.openHandlesTimeout !== 0
  ) {
    const timeout = globalConfig.openHandlesTimeout;
    setTimeout(() => {
      console.warn(
        chalk.yellow.bold(
          `Jest did not exit ${
            timeout === 1000 ? 'one second' : `${timeout / 1000} seconds`
          } after the test run has completed.\n\n'`,
        ) +
          chalk.yellow(
            'This usually means that there are asynchronous operations that ' +
              "weren't stopped in your tests. Consider running Jest with " +
              '`--detectOpenHandles` to troubleshoot this issue.',
          ),
      );
    }, timeout).unref();
  }
};
