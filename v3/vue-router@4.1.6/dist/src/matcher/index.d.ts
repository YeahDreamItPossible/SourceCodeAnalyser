import { RouteRecordRaw, MatcherLocationRaw, MatcherLocation, RouteRecordName } from '../types';
import { RouteRecordMatcher } from './pathMatcher';
import { RouteRecordNormalized } from './types';
import type { PathParserOptions, _PathParserOptions } from './pathParserRanker';
/**
 * Internal RouterMatcher
 *
 * @internal
 */
export interface RouterMatcher {
    addRoute: (record: RouteRecordRaw, parent?: RouteRecordMatcher) => () => void;
    removeRoute: {
        (matcher: RouteRecordMatcher): void;
        (name: RouteRecordName): void;
    };
    getRoutes: () => RouteRecordMatcher[];
    getRecordMatcher: (name: RouteRecordName) => RouteRecordMatcher | undefined;
    /**
     * Resolves a location. Gives access to the route record that corresponds to the actual path as well as filling the corresponding params objects
     *
     * @param location - MatcherLocationRaw to resolve to a url
     * @param currentLocation - MatcherLocation of the current location
     */
    resolve: (location: MatcherLocationRaw, currentLocation: MatcherLocation) => MatcherLocation;
}
/**
 * Creates a Router Matcher.
 *
 * @internal
 * @param routes - array of initial routes
 * @param globalOptions - global route options
 */
export declare function createRouterMatcher(routes: Readonly<RouteRecordRaw[]>, globalOptions: PathParserOptions): RouterMatcher;
/**
 * Normalizes a RouteRecordRaw. Creates a copy
 *
 * @param record
 * @returns the normalized version
 */
export declare function normalizeRouteRecord(record: RouteRecordRaw): RouteRecordNormalized;
export type { PathParserOptions, _PathParserOptions };
//# sourceMappingURL=index.d.ts.map