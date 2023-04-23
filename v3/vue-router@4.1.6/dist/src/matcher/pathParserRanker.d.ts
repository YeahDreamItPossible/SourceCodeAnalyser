import { Token } from './pathTokenizer';
export declare type PathParams = Record<string, string | string[]>;
/**
 * A param in a url like `/users/:id`
 */
interface PathParserParamKey {
    name: string;
    repeatable: boolean;
    optional: boolean;
}
export interface PathParser {
    /**
     * The regexp used to match a url
     */
    re: RegExp;
    /**
     * The score of the parser
     */
    score: Array<number[]>;
    /**
     * Keys that appeared in the path
     */
    keys: PathParserParamKey[];
    /**
     * Parses a url and returns the matched params or null if it doesn't match. An
     * optional param that isn't preset will be an empty string. A repeatable
     * param will be an array if there is at least one value.
     *
     * @param path - url to parse
     * @returns a Params object, empty if there are no params. `null` if there is
     * no match
     */
    parse(path: string): PathParams | null;
    /**
     * Creates a string version of the url
     *
     * @param params - object of params
     * @returns a url
     */
    stringify(params: PathParams): string;
}
/**
 * @internal
 */
export interface _PathParserOptions {
    /**
     * Makes the RegExp case-sensitive.
     *
     * @defaultValue `false`
     */
    sensitive?: boolean;
    /**
     * Whether to disallow a trailing slash or not.
     *
     * @defaultValue `false`
     */
    strict?: boolean;
    /**
     * Should the RegExp match from the beginning by prepending a `^` to it.
     * @internal
     *
     * @defaultValue `true`
     */
    start?: boolean;
    /**
     * Should the RegExp match until the end by appending a `$` to it.
     *
     * @defaultValue `true`
     */
    end?: boolean;
}
export declare type PathParserOptions = Pick<_PathParserOptions, 'end' | 'sensitive' | 'strict'>;
/**
 * Creates a path parser from an array of Segments (a segment is an array of Tokens)
 *
 * @param segments - array of segments returned by tokenizePath
 * @param extraOptions - optional options for the regexp
 * @returns a PathParser
 */
export declare function tokensToParser(segments: Array<Token[]>, extraOptions?: _PathParserOptions): PathParser;
/**
 * Compare function that can be used with `sort` to sort an array of PathParser
 *
 * @param a - first PathParser
 * @param b - second PathParser
 * @returns 0 if both are equal, < 0 if a should be sorted first, > 0 if b
 */
export declare function comparePathParserScore(a: PathParser, b: PathParser): number;
export {};
//# sourceMappingURL=pathParserRanker.d.ts.map