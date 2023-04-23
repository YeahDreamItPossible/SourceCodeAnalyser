import { RouteParams, RouteComponent, RouteParamsRaw } from '../types';
export * from './env';
export declare function isESModule(obj: any): obj is {
    default: RouteComponent;
};
export declare const assign: {
    <T extends {}, U>(target: T, source: U): T & U;
    <T_1 extends {}, U_1, V>(target: T_1, source1: U_1, source2: V): T_1 & U_1 & V;
    <T_2 extends {}, U_2, V_1, W>(target: T_2, source1: U_2, source2: V_1, source3: W): T_2 & U_2 & V_1 & W;
    (target: object, ...sources: any[]): any;
};
export declare function applyToParams(fn: (v: string | number | null | undefined) => string, params: RouteParamsRaw | undefined): RouteParams;
export declare const noop: () => void;
/**
 * Typesafe alternative to Array.isArray
 * https://github.com/microsoft/TypeScript/pull/48228
 */
export declare const isArray: (arg: ArrayLike<any> | any) => arg is ReadonlyArray<any>;
//# sourceMappingURL=index.d.ts.map