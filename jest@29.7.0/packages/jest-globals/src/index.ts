import type {Jest} from '@jest/environment';
import type {JestExpect} from '@jest/expect';
import type {Global} from '@jest/types';
import type {
  ClassLike,
  FunctionLike,
  Mock as JestMock,
  Mocked as JestMocked,
  MockedClass as JestMockedClass,
  MockedFunction as JestMockedFunction,
  MockedObject as JestMockedObject,
  Replaced as JestReplaced,
  Spied as JestSpied,
  SpiedClass as JestSpiedClass,
  SpiedFunction as JestSpiedFunction,
  SpiedGetter as JestSpiedGetter,
  SpiedSetter as JestSpiedSetter,
  UnknownFunction,
} from 'jest-mock';

export declare const expect: JestExpect;

export declare const it: Global.GlobalAdditions['it'];
export declare const test: Global.GlobalAdditions['test'];
export declare const fit: Global.GlobalAdditions['fit'];
export declare const xit: Global.GlobalAdditions['xit'];
export declare const xtest: Global.GlobalAdditions['xtest'];
export declare const describe: Global.GlobalAdditions['describe'];
export declare const xdescribe: Global.GlobalAdditions['xdescribe'];
export declare const fdescribe: Global.GlobalAdditions['fdescribe'];
export declare const beforeAll: Global.GlobalAdditions['beforeAll'];
export declare const beforeEach: Global.GlobalAdditions['beforeEach'];
export declare const afterEach: Global.GlobalAdditions['afterEach'];
export declare const afterAll: Global.GlobalAdditions['afterAll'];

declare const jest: Jest;

// eslint-disable-next-line @typescript-eslint/no-namespace
declare namespace jest {
  /**
   * Constructs the type of a mock function, e.g. the return type of `jest.fn()`.
   */
  export type Mock<T extends FunctionLike = UnknownFunction> = JestMock<T>;
  /**
   * Wraps a class, function or object type with Jest mock type definitions.
   */
  export type Mocked<T extends object> = JestMocked<T>;
  /**
   * Wraps a class type with Jest mock type definitions.
   */
  export type MockedClass<T extends ClassLike> = JestMockedClass<T>;
  /**
   * Wraps a function type with Jest mock type definitions.
   */
  export type MockedFunction<T extends FunctionLike> = JestMockedFunction<T>;
  /**
   * Wraps an object type with Jest mock type definitions.
   */
  export type MockedObject<T extends object> = JestMockedObject<T>;
  /**
   * Constructs the type of a replaced property.
   */
  export type Replaced<T> = JestReplaced<T>;
  /**
   * Constructs the type of a spied class or function.
   */
  export type Spied<T extends ClassLike | FunctionLike> = JestSpied<T>;
  /**
   * Constructs the type of a spied class.
   */
  export type SpiedClass<T extends ClassLike> = JestSpiedClass<T>;
  /**
   * Constructs the type of a spied function.
   */
  export type SpiedFunction<T extends FunctionLike> = JestSpiedFunction<T>;
  /**
   * Constructs the type of a spied getter.
   */
  export type SpiedGetter<T> = JestSpiedGetter<T>;
  /**
   * Constructs the type of a spied setter.
   */
  export type SpiedSetter<T> = JestSpiedSetter<T>;
}

export {jest};

throw new Error(
  'Do not import `@jest/globals` outside of the Jest test environment',
);
