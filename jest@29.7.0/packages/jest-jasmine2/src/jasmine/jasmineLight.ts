import type {Jasmine, SpecDefinitionsFn} from '../types';
import Env from './Env';
import JsApiReporter from './JsApiReporter';
import ReportDispatcher from './ReportDispatcher';
import Spec from './Spec';
import Suite from './Suite';
import Timer from './Timer';
import createSpy from './createSpy';
import SpyRegistry from './spyRegistry';

const testTimeoutSymbol = Symbol.for('TEST_TIMEOUT_SYMBOL');

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface Global {
      [testTimeoutSymbol]: number;
    }
  }
}

export const create = function (createOptions: Record<string, any>): Jasmine {
  const j$ = {...createOptions} as Jasmine;

  Object.defineProperty(j$, '_DEFAULT_TIMEOUT_INTERVAL', {
    configurable: true,
    enumerable: true,
    get() {
      // eslint-disable-next-line no-restricted-globals
      return global[testTimeoutSymbol] || createOptions.testTimeout || 5000;
    },
    set(value) {
      // eslint-disable-next-line no-restricted-globals
      global[testTimeoutSymbol] = value;
    },
  });

  j$.getEnv = function () {
    const env = (j$.currentEnv_ = j$.currentEnv_ || new j$.Env());
    //jasmine. singletons in here (setTimeout blah blah).
    return env;
  };
  j$.createSpy = createSpy;
  j$.Env = Env(j$);
  j$.JsApiReporter = JsApiReporter;
  j$.ReportDispatcher = ReportDispatcher;
  j$.Spec = Spec;
  j$.SpyRegistry = SpyRegistry;
  j$.Suite = Suite;
  j$.Timer = Timer;
  j$.version = '2.5.2-light';

  return j$;
};

// Interface is a reserved word in strict mode, so can't export it as ESM
export const _interface = function (jasmine: Jasmine, env: any) {
  const jasmineInterface = {
    describe(description: string, specDefinitions: SpecDefinitionsFn) {
      return env.describe(description, specDefinitions);
    },

    xdescribe(description: string, specDefinitions: SpecDefinitionsFn) {
      return env.xdescribe(description, specDefinitions);
    },

    fdescribe(description: string, specDefinitions: SpecDefinitionsFn) {
      return env.fdescribe(description, specDefinitions);
    },

    it() {
      return env.it.apply(env, arguments);
    },

    xit() {
      return env.xit.apply(env, arguments);
    },

    fit() {
      return env.fit.apply(env, arguments);
    },

    beforeEach() {
      if (typeof arguments[0] !== 'function') {
        throw new Error(
          'Invalid first argument. It must be a callback function.',
        );
      }
      return env.beforeEach.apply(env, arguments);
    },

    afterEach() {
      if (typeof arguments[0] !== 'function') {
        throw new Error(
          'Invalid first argument. It must be a callback function.',
        );
      }
      return env.afterEach.apply(env, arguments);
    },

    beforeAll() {
      if (typeof arguments[0] !== 'function') {
        throw new Error(
          'Invalid first argument. It must be a callback function.',
        );
      }
      return env.beforeAll.apply(env, arguments);
    },

    afterAll() {
      if (typeof arguments[0] !== 'function') {
        throw new Error(
          'Invalid first argument. It must be a callback function.',
        );
      }
      return env.afterAll.apply(env, arguments);
    },

    pending() {
      return env.pending.apply(env, arguments);
    },

    fail() {
      return env.fail.apply(env, arguments);
    },

    spyOn(obj: Record<string, any>, methodName: string, accessType?: string) {
      return env.spyOn(obj, methodName, accessType);
    },

    jsApiReporter: new jasmine.JsApiReporter({
      timer: new jasmine.Timer(),
    }),

    jasmine,
  };

  return jasmineInterface;
};
