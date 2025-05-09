import chalk = require('chalk');
import Emittery = require('emittery');
import pLimit = require('p-limit');
import type {
  Test,
  TestEvents,
  TestFileEvent,
  TestResult,
} from '@jest/test-result';
import {deepCyclicCopy} from 'jest-util';
import type {TestWatcher} from 'jest-watcher';
import {JestWorkerFarm, PromiseWithCustomMessage, Worker} from 'jest-worker';
import runTest from './runTest';
import type {SerializableResolver} from './testWorker';
import {EmittingTestRunner, TestRunnerOptions, UnsubscribeFn} from './types';

export type {Test, TestEvents} from '@jest/test-result';
export type {Config} from '@jest/types';
export type {TestWatcher} from 'jest-watcher';
export {CallbackTestRunner, EmittingTestRunner} from './types';
export type {
  CallbackTestRunnerInterface,
  EmittingTestRunnerInterface,
  OnTestFailure,
  OnTestStart,
  OnTestSuccess,
  TestRunnerContext,
  TestRunnerOptions,
  JestTestRunner,
  UnsubscribeFn,
} from './types';

type TestWorker = typeof import('./testWorker');

// 测试运行器
// 作用：
// 以 串行 或者 并行 的方式运行单测文件
export default class TestRunner extends EmittingTestRunner {
  readonly #eventEmitter = new Emittery<TestEvents>();

  async runTests(
    tests: Array<Test>,
    watcher: TestWatcher,
    options: TestRunnerOptions,
  ): Promise<void> {
    return options.serial
      ? this.#createInBandTestRun(tests, watcher)
      : this.#createParallelTestRun(tests, watcher);
  }

  // 串行
  async #createInBandTestRun(tests: Array<Test>, watcher: TestWatcher) {
    process.env.JEST_WORKER_ID = '1';
    const mutex = pLimit(1);
    return tests.reduce(
      (promise, test) =>
        mutex(() =>
          promise
            .then(async () => {
              if (watcher.isInterrupted()) {
                throw new CancelRun();
              }

              // `deepCyclicCopy` used here to avoid mem-leak
              const sendMessageToJest: TestFileEvent = (eventName, args) =>
                this.#eventEmitter.emit(
                  eventName,
                  deepCyclicCopy(args, {keepPrototype: false}),
                );

              await this.#eventEmitter.emit('test-file-start', [test]);

              return runTest(
                test.path,
                this._globalConfig,
                test.context.config,
                test.context.resolver,
                this._context,
                sendMessageToJest,
              );
            })
            .then(
              result =>
                this.#eventEmitter.emit('test-file-success', [test, result]),
              error =>
                this.#eventEmitter.emit('test-file-failure', [test, error]),
            ),
        ),
      Promise.resolve(),
    );
  }

  // 并行， 以 worker 的方式
  async #createParallelTestRun(tests: Array<Test>, watcher: TestWatcher) {
    const resolvers: Map<string, SerializableResolver> = new Map();
    for (const test of tests) {
      if (!resolvers.has(test.context.config.id)) {
        resolvers.set(test.context.config.id, {
          config: test.context.config,
          serializableModuleMap: test.context.moduleMap.toJSON(),
        });
      }
    }

    const worker = new Worker(require.resolve('./testWorker'), {
      enableWorkerThreads: this._globalConfig.workerThreads,
      exposedMethods: ['worker'],
      forkOptions: {serialization: 'json', stdio: 'pipe'},
      // The workerIdleMemoryLimit should've been converted to a number during
      // the normalization phase.
      idleMemoryLimit:
        typeof this._globalConfig.workerIdleMemoryLimit === 'number'
          ? this._globalConfig.workerIdleMemoryLimit
          : undefined,
      maxRetries: 3,
      numWorkers: this._globalConfig.maxWorkers,
      setupArgs: [{serializableResolvers: Array.from(resolvers.values())}],
    }) as JestWorkerFarm<TestWorker>;

    if (worker.getStdout()) worker.getStdout().pipe(process.stdout);
    if (worker.getStderr()) worker.getStderr().pipe(process.stderr);

    const mutex = pLimit(this._globalConfig.maxWorkers);

    // Send test suites to workers continuously instead of all at once to track
    // the start time of individual tests.
    const runTestInWorker = (test: Test) =>
      mutex(async () => {
        if (watcher.isInterrupted()) {
          return Promise.reject();
        }

        await this.#eventEmitter.emit('test-file-start', [test]);

        const promise = worker.worker({
          config: test.context.config,
          context: {
            ...this._context,
            changedFiles:
              this._context.changedFiles &&
              Array.from(this._context.changedFiles),
            sourcesRelatedToTestsInChangedFiles:
              this._context.sourcesRelatedToTestsInChangedFiles &&
              Array.from(this._context.sourcesRelatedToTestsInChangedFiles),
          },
          globalConfig: this._globalConfig,
          path: test.path,
        }) as PromiseWithCustomMessage<TestResult>;

        if (promise.UNSTABLE_onCustomMessage) {
          // TODO: Get appropriate type for `onCustomMessage`
          promise.UNSTABLE_onCustomMessage(([event, payload]: any) =>
            this.#eventEmitter.emit(event, payload),
          );
        }

        return promise;
      });

    const onInterrupt = new Promise((_, reject) => {
      watcher.on('change', state => {
        if (state.interrupted) {
          reject(new CancelRun());
        }
      });
    });

    const runAllTests = Promise.all(
      tests.map(test =>
        runTestInWorker(test).then(
          result =>
            this.#eventEmitter.emit('test-file-success', [test, result]),
          error => this.#eventEmitter.emit('test-file-failure', [test, error]),
        ),
      ),
    );

    const cleanup = async () => {
      const {forceExited} = await worker.end();
      if (forceExited) {
        console.error(
          chalk.yellow(
            'A worker process has failed to exit gracefully and has been force exited. ' +
              'This is likely caused by tests leaking due to improper teardown. ' +
              'Try running with --detectOpenHandles to find leaks. ' +
              'Active timers can also cause this, ensure that .unref() was called on them.',
          ),
        );
      }
    };

    return Promise.race([runAllTests, onInterrupt]).then(cleanup, cleanup);
  }

  on<Name extends keyof TestEvents>(
    eventName: Name,
    listener: (eventData: TestEvents[Name]) => void | Promise<void>,
  ): UnsubscribeFn {
    return this.#eventEmitter.on(eventName, listener);
  }
}

class CancelRun extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'CancelRun';
  }
}
