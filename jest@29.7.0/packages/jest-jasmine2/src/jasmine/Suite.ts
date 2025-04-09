import type {Circus} from '@jest/types';
import {convertDescriptorToString} from 'jest-util';
import ExpectationFailed from '../ExpectationFailed';
import expectationResultFactory from '../expectationResultFactory';
import type {QueueableFn} from '../queueRunner';
import type Spec from './Spec';

export type SuiteResult = {
  id: string;
  description: string;
  fullName: string;
  failedExpectations: Array<ReturnType<typeof expectationResultFactory>>;
  testPath: string;
  status?: string;
};

export type Attributes = {
  id: string;
  parentSuite?: Suite;
  description: Circus.TestNameLike;
  throwOnExpectationFailure?: boolean;
  getTestPath: () => string;
};

// 套件类
export default class Suite {
  id: string;
  parentSuite?: Suite;
  description: Circus.TestNameLike;
  throwOnExpectationFailure: boolean;
  beforeFns: Array<QueueableFn>;
  afterFns: Array<QueueableFn>;
  beforeAllFns: Array<QueueableFn>;
  afterAllFns: Array<QueueableFn>;
  disabled: boolean;
  children: Array<Suite | Spec>;
  result: SuiteResult;
  sharedContext?: object;
  markedPending: boolean;
  markedTodo: boolean;
  isFocused: boolean;

  constructor(attrs: Attributes) {
    this.markedPending = false;
    this.markedTodo = false;
    this.isFocused = false;
    this.id = attrs.id;
    this.parentSuite = attrs.parentSuite;
    this.description = convertDescriptorToString(attrs.description);
    this.throwOnExpectationFailure = !!attrs.throwOnExpectationFailure;

    this.beforeFns = [];
    this.afterFns = [];
    this.beforeAllFns = [];
    this.afterAllFns = [];
    this.disabled = false;

    this.children = [];

    this.result = {
      id: this.id,
      description: this.description,
      fullName: this.getFullName(),
      failedExpectations: [],
      testPath: attrs.getTestPath(),
    };
  }
  getFullName() {
    const fullName = [];
    for (
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      let parentSuite: Suite | undefined = this;
      parentSuite;
      parentSuite = parentSuite.parentSuite
    ) {
      if (parentSuite.parentSuite) {
        fullName.unshift(parentSuite.description);
      }
    }
    return fullName.join(' ');
  }
  disable() {
    this.disabled = true;
  }
  pend(_message?: string) {
    this.markedPending = true;
  }
  beforeEach(fn: QueueableFn) {
    this.beforeFns.unshift(fn);
  }
  beforeAll(fn: QueueableFn) {
    this.beforeAllFns.push(fn);
  }
  afterEach(fn: QueueableFn) {
    this.afterFns.unshift(fn);
  }
  afterAll(fn: QueueableFn) {
    this.afterAllFns.unshift(fn);
  }

  addChild(child: Suite | Spec) {
    this.children.push(child);
  }

  status() {
    if (this.disabled) {
      return 'disabled';
    }

    if (this.markedPending) {
      return 'pending';
    }

    if (this.result.failedExpectations.length > 0) {
      return 'failed';
    } else {
      return 'finished';
    }
  }

  isExecutable() {
    return !this.disabled;
  }

  canBeReentered() {
    return this.beforeAllFns.length === 0 && this.afterAllFns.length === 0;
  }

  getResult() {
    this.result.status = this.status();
    return this.result;
  }

  sharedUserContext() {
    if (!this.sharedContext) {
      this.sharedContext = {};
    }

    return this.sharedContext;
  }

  clonedSharedUserContext() {
    return this.sharedUserContext();
  }

  onException(...args: Parameters<Spec['onException']>) {
    if (args[0] instanceof ExpectationFailed) {
      return;
    }

    if (isAfterAll(this.children)) {
      const data = {
        matcherName: '',
        passed: false,
        expected: '',
        actual: '',
        error: arguments[0],
      };
      this.result.failedExpectations.push(expectationResultFactory(data));
    } else {
      for (let i = 0; i < this.children.length; i++) {
        const child = this.children[i];
        child.onException.apply(child, args);
      }
    }
  }

  addExpectationResult(...args: Parameters<Spec['addExpectationResult']>) {
    if (isAfterAll(this.children) && isFailure(args)) {
      const data = args[1];
      this.result.failedExpectations.push(expectationResultFactory(data));
      if (this.throwOnExpectationFailure) {
        throw new ExpectationFailed();
      }
    } else {
      for (let i = 0; i < this.children.length; i++) {
        const child = this.children[i];
        try {
          child.addExpectationResult.apply(child, args);
        } catch {
          // keep going
        }
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  execute(..._args: Array<any>) {}
}

function isAfterAll(children: Array<Spec | Suite>) {
  return children && children[0] && children[0].result.status;
}

function isFailure(args: Array<unknown>) {
  return !args[0];
}
