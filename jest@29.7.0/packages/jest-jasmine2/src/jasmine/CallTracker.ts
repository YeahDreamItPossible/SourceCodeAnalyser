export type Context = {
  object: unknown;
  args: Array<unknown>;
  returnValue?: unknown;
};

class CallTracker {
  track: (context: Context) => void;
  any: () => boolean;
  count: () => number;
  argsFor: (index: number) => Array<unknown>;
  all: () => Array<Context>;
  allArgs: () => Array<unknown>;
  first: () => Context;
  mostRecent: () => Context;
  reset: () => void;

  constructor() {
    let calls: Array<Context> = [];

    this.track = function (context: Context) {
      calls.push(context);
    };

    this.any = function () {
      return !!calls.length;
    };

    this.count = function () {
      return calls.length;
    };

    this.argsFor = function (index) {
      const call = calls[index];
      return call ? call.args : [];
    };

    this.all = function () {
      return calls;
    };

    this.allArgs = function () {
      const callArgs = [];
      for (let i = 0; i < calls.length; i++) {
        callArgs.push(calls[i].args);
      }

      return callArgs;
    };

    this.first = function () {
      return calls[0];
    };

    this.mostRecent = function () {
      return calls[calls.length - 1];
    };

    this.reset = function () {
      calls = [];
    };
  }
}

export default CallTracker;
