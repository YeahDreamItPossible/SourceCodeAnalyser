import type {TestFileEvent} from '@jest/test-result';
import type {Circus} from '@jest/types';
import {
  createTestCaseStartInfo,
  makeSingleTestResult,
  parseSingleTestResult,
} from './utils';

// 事件处理器
// 测试用例报告处理器
const testCaseReportHandler =
  (testPath: string, sendMessageToJest: TestFileEvent) =>
  (event: Circus.Event): void => {
    switch (event.name) {
      case 'test_started': {
        const testCaseStartInfo = createTestCaseStartInfo(event.test);
        sendMessageToJest('test-case-start', [testPath, testCaseStartInfo]);
        break;
      }
      case 'test_todo':
      case 'test_done': {
        const testResult = makeSingleTestResult(event.test);
        const testCaseResult = parseSingleTestResult(testResult);
        sendMessageToJest('test-case-result', [testPath, testCaseResult]);
        break;
      }
    }
  };

export default testCaseReportHandler;
