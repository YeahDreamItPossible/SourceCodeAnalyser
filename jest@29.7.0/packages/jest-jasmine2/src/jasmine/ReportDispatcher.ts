import type {Reporter, RunDetails} from '../types';
import type {SpecResult} from './Spec';
import type {SuiteResult} from './Suite';

// 报告调度器
export default class ReportDispatcher implements Reporter {
  addReporter: (reporter: Reporter) => void;
  provideFallbackReporter: (reporter: Reporter) => void;
  clearReporters: () => void;

  // @ts-expect-error: confused by loop in ctor
  jasmineDone: (runDetails: RunDetails) => void;
  // @ts-expect-error: confused by loop in ctor
  jasmineStarted: (runDetails: RunDetails) => void;
  // @ts-expect-error: confused by loop in ctor
  specDone: (result: SpecResult) => void;
  // @ts-expect-error: confused by loop in ctor
  specStarted: (spec: SpecResult) => void;
  // @ts-expect-error: confused by loop in ctor
  suiteDone: (result: SuiteResult) => void;
  // @ts-expect-error: confused by loop in ctor
  suiteStarted: (result: SuiteResult) => void;

  constructor(methods: Array<keyof Reporter>) {
    const dispatchedMethods = methods || [];

    for (let i = 0; i < dispatchedMethods.length; i++) {
      const method = dispatchedMethods[i];
      this[method] = (function (m) {
        return function () {
          dispatch(m, arguments);
        };
      })(method);
    }

    let reporters: Array<Reporter> = [];
    let fallbackReporter: Reporter | null = null;

    this.addReporter = function (reporter) {
      reporters.push(reporter);
    };

    this.provideFallbackReporter = function (reporter) {
      fallbackReporter = reporter;
    };

    this.clearReporters = function () {
      reporters = [];
    };

    return this;

    function dispatch(method: keyof Reporter, args: unknown) {
      if (reporters.length === 0 && fallbackReporter !== null) {
        reporters.push(fallbackReporter);
      }
      for (let i = 0; i < reporters.length; i++) {
        const reporter = reporters[i];
        if (reporter[method]) {
          // @ts-expect-error: wrong context
          reporter[method].apply(reporter, args);
        }
      }
    }
  }
}
