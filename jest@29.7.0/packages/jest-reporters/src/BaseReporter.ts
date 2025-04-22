import type {
  AggregatedResult,
  Test,
  TestCaseResult,
  TestContext,
  TestResult,
} from '@jest/test-result';
import {preRunMessage} from 'jest-util';
import type {Reporter, ReporterOnStartOptions} from './types';

const {remove: preRunMessageRemove} = preRunMessage;


// 基础报告器
// 作用:
// 
export default class BaseReporter implements Reporter {
  private _error?: Error;

  log(message: string): void {
    process.stderr.write(`${message}\n`);
  }

  onRunStart(
    _results?: AggregatedResult,
    _options?: ReporterOnStartOptions,
  ): void {
    // 清除 错误输出
    preRunMessageRemove(process.stderr);
  }

  onTestCaseResult(_test: Test, _testCaseResult: TestCaseResult): void {}

  onTestResult(
    _test?: Test,
    _testResult?: TestResult,
    _results?: AggregatedResult,
  ): void {}

  onTestStart(_test?: Test): void {}

  onRunComplete(
    _testContexts?: Set<TestContext>,
    _aggregatedResults?: AggregatedResult,
  ): Promise<void> | void {}

  protected _setError(error: Error): void {
    this._error = error;
  }

  getLastError(): Error | undefined {
    return this._error;
  }
}
