import {AssertionError} from 'assert';
import type {FailedAssertion, Status} from '@jest/test-result';
import type {Circus} from '@jest/types';
import {convertDescriptorToString} from 'jest-util';
import ExpectationFailed from '../ExpectationFailed';
import assertionErrorMessage from '../assertionErrorMessage';
import expectationResultFactory, {
  Options as ExpectationResultFactoryOptions,
} from '../expectationResultFactory';
import type {QueueableFn, default as queueRunner} from '../queueRunner';
import type {AssertionErrorWithStack} from '../types';

export type Attributes = {
  id: string;
  resultCallback: (result: Spec['result']) => void;
  description: Circus.TestNameLike;
  throwOnExpectationFailure: unknown;
  getTestPath: () => string;
  queueableFn: QueueableFn;
  beforeAndAfterFns: () => {
    befores: Array<QueueableFn>;
    afters: Array<QueueableFn>;
  };
  userContext: () => unknown;
  onStart: (context: Spec) => void;
  getSpecName: (spec: Spec) => string;
  queueRunnerFactory: typeof queueRunner;
};

export type SpecResult = {
  id: string;
  description: string;
  fullName: string;
  duration?: number;
  failedExpectations: Array<FailedAssertion>;
  testPath: string;
  passedExpectations: Array<ReturnType<typeof expectationResultFactory>>;
  pendingReason: string;
  status: Status;
  __callsite?: {
    getColumnNumber: () => number;
    getLineNumber: () => number;
  };
};

// 
export default class Spec {
  id: string;
  description: string;
  resultCallback: (result: SpecResult) => void;
  queueableFn: QueueableFn;
  beforeAndAfterFns: () => {
    befores: Array<QueueableFn>;
    afters: Array<QueueableFn>;
  };
  userContext: () => unknown;
  onStart: (spec: Spec) => void;
  getSpecName: (spec: Spec) => string;
  queueRunnerFactory: typeof queueRunner;
  throwOnExpectationFailure: boolean;
  initError: Error;
  result: SpecResult;
  disabled?: boolean;
  currentRun?: ReturnType<typeof queueRunner>;
  markedTodo?: boolean;
  markedPending?: boolean;
  expand?: boolean;

  static pendingSpecExceptionMessage: string;

  static isPendingSpecException(e: Error) {
    return !!(
      e &&
      e.toString &&
      e.toString().indexOf(Spec.pendingSpecExceptionMessage) !== -1
    );
  }

  constructor(attrs: Attributes) {
    this.resultCallback = attrs.resultCallback || function () {};
    this.id = attrs.id;
    this.description = convertDescriptorToString(attrs.description);
    this.queueableFn = attrs.queueableFn;
    this.beforeAndAfterFns =
      attrs.beforeAndAfterFns ||
      function () {
        return {befores: [], afters: []};
      };
    this.userContext =
      attrs.userContext ||
      function () {
        return {};
      };
    this.onStart = attrs.onStart || function () {};
    this.getSpecName =
      attrs.getSpecName ||
      function () {
        return '';
      };
    this.queueRunnerFactory = attrs.queueRunnerFactory || function () {};
    this.throwOnExpectationFailure = !!attrs.throwOnExpectationFailure;

    this.initError = new Error();
    this.initError.name = '';

    // Without this line v8 stores references to all closures
    // in the stack in the Error object. This line stringifies the stack
    // property to allow garbage-collecting objects on the stack
    // https://crbug.com/v8/7142
    // eslint-disable-next-line no-self-assign
    this.initError.stack = this.initError.stack;

    this.queueableFn.initError = this.initError;

    // @ts-expect-error: misses some fields added later
    this.result = {
      id: this.id,
      description: this.description,
      fullName: this.getFullName(),
      failedExpectations: [],
      passedExpectations: [],
      pendingReason: '',
      testPath: attrs.getTestPath(),
    };
  }

  addExpectationResult(
    passed: boolean,
    data: ExpectationResultFactoryOptions,
    isError?: boolean,
  ) {
    const expectationResult = expectationResultFactory(data, this.initError);
    if (passed) {
      this.result.passedExpectations.push(expectationResult);
    } else {
      this.result.failedExpectations.push(expectationResult);

      if (this.throwOnExpectationFailure && !isError) {
        throw new ExpectationFailed();
      }
    }
  }

  execute(onComplete?: () => void, enabled?: boolean) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;

    this.onStart(this);

    if (
      !this.isExecutable() ||
      this.markedPending ||
      this.markedTodo ||
      enabled === false
    ) {
      complete(enabled);
      return;
    }

    const fns = this.beforeAndAfterFns();
    const allFns = fns.befores.concat(this.queueableFn).concat(fns.afters);

    this.currentRun = this.queueRunnerFactory({
      queueableFns: allFns,
      onException() {
        // @ts-expect-error: wrong context
        self.onException.apply(self, arguments);
      },
      userContext: this.userContext(),
      setTimeout,
      clearTimeout,
      fail: () => {},
    });

    this.currentRun.then(() => complete(true));

    function complete(enabledAgain?: boolean) {
      self.result.status = self.status(enabledAgain);
      self.resultCallback(self.result);

      if (onComplete) {
        onComplete();
      }
    }
  }

  cancel() {
    if (this.currentRun) {
      this.currentRun.cancel();
    }
  }

  onException(error: ExpectationFailed | AssertionErrorWithStack) {
    if (Spec.isPendingSpecException(error)) {
      this.pend(extractCustomPendingMessage(error));
      return;
    }

    if (error instanceof ExpectationFailed) {
      return;
    }

    this.addExpectationResult(
      false,
      {
        matcherName: '',
        passed: false,
        expected: '',
        actual: '',
        error: this.isAssertionError(error)
          ? assertionErrorMessage(error, {expand: this.expand})
          : error,
      },
      true,
    );
  }

  disable() {
    this.disabled = true;
  }

  pend(message?: string) {
    this.markedPending = true;
    if (message) {
      this.result.pendingReason = message;
    }
  }

  todo() {
    this.markedTodo = true;
  }

  getResult() {
    this.result.status = this.status();
    return this.result;
  }

  status(enabled?: boolean) {
    if (this.disabled || enabled === false) {
      return 'disabled';
    }

    if (this.markedTodo) {
      return 'todo';
    }

    if (this.markedPending) {
      return 'pending';
    }

    if (this.result.failedExpectations.length > 0) {
      return 'failed';
    } else {
      return 'passed';
    }
  }

  isExecutable() {
    return !this.disabled;
  }

  getFullName() {
    return this.getSpecName(this);
  }

  isAssertionError(error: Error) {
    return (
      error instanceof AssertionError ||
      (error && error.name === AssertionError.name)
    );
  }
}

Spec.pendingSpecExceptionMessage = '=> marked Pending';

const extractCustomPendingMessage = function (e: Error) {
  const fullMessage = e.toString();
  const boilerplateStart = fullMessage.indexOf(
    Spec.pendingSpecExceptionMessage,
  );
  const boilerplateEnd =
    boilerplateStart + Spec.pendingSpecExceptionMessage.length;

  return fullMessage.substr(boilerplateEnd);
};
