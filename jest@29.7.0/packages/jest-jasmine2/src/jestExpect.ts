import {jestExpect} from '@jest/expect';
import type {JasmineMatchersObject} from './types';

export default function jestExpectAdapter(config: {expand: boolean}): void {
  global.expect = jestExpect;
  jestExpect.setState({expand: config.expand});

  const jasmine = global.jasmine;
  jasmine.anything = jestExpect.anything;
  jasmine.any = jestExpect.any;
  jasmine.objectContaining = jestExpect.objectContaining;
  jasmine.arrayContaining = jestExpect.arrayContaining;
  jasmine.stringMatching = jestExpect.stringMatching;

  jasmine.addMatchers = (jasmineMatchersObject: JasmineMatchersObject) => {
    const jestMatchersObject = Object.create(null);
    Object.keys(jasmineMatchersObject).forEach(name => {
      jestMatchersObject[name] = function (...args: Array<unknown>) {
        // use "expect.extend" if you need to use equality testers (via this.equal)
        const result = jasmineMatchersObject[name](null, null);
        // if there is no 'negativeCompare', both should be handled by `compare`
        const negativeCompare = result.negativeCompare || result.compare;

        return this.isNot
          ? negativeCompare.apply(null, args)
          : result.compare.apply(null, args);
      };
    });

    jestExpect.extend(jestMatchersObject);
  };
}
