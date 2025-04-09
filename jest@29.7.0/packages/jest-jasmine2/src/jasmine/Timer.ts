const defaultNow = (function (Date) {
  return function () {
    return new Date().getTime();
  };
})(Date);

// 
export default class Timer {
  start: () => void;
  elapsed: () => number;

  constructor(options?: {now?: () => number}) {
    options = options || {};

    const now = options.now || defaultNow;
    let startTime: number;

    this.start = function () {
      startTime = now();
    };

    this.elapsed = function () {
      return now() - startTime;
    };
  }
}
