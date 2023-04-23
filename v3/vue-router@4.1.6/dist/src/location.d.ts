import { LocationQuery, LocationQueryRaw } from './query';
import { RouteLocation, RouteLocationNormalized } from './types';
import { RouteRecord } from './matcher/types';
/**
 * Location object returned by {@link `parseURL`}.
 * @internal
 */
interface LocationNormalized {
    path: string;
    fullPath: string;
    hash: string;
    query: LocationQuery;
}
/**
 * Location object accepted by {@link `stringifyURL`}.
 * @internal
 */
interface LocationPartial {
    path: string;
    query?: LocationQueryRaw;
    hash?: string;
}
export declare const removeTrailingSlash: (path: string) => string;
/**
 * Transforms a URI into a normalized history location
 *
 * @param parseQuery
 * @param location - URI to normalize
 * @param currentLocation - current absolute location. Allows resolving relative
 * paths. Must start with `/`. Defaults to `/`
 * @returns a normalized history location
 */
export declare function parseURL(parseQuery: (search: string) => LocationQuery, location: string, currentLocation?: string): LocationNormalized;
/**
 * Stringifies a URL object
 *
 * @param stringifyQuery
 * @param location
 */
export declare function stringifyURL(stringifyQuery: (query: LocationQueryRaw) => string, location: LocationPartial): string;
/**
 * Strips off the base from the beginning of a location.pathname in a non-case-sensitive way.
 *
 * @param pathname - location.pathname
 * @param base - base to strip off
 */
export declare function stripBase(pathname: string, base: string): string;
/**
 * Checks if two RouteLocation are equal. This means that both locations are
 * pointing towards the same {@link RouteRecord} and that all `params`, `query`
 * parameters and `hash` are the same
 *
 * @param a - first {@link RouteLocation}
 * @param b - second {@link RouteLocation}
 */
export declare function isSameRouteLocation(stringifyQuery: (query: LocationQueryRaw) => string, a: RouteLocation, b: RouteLocation): boolean;
/**
 * Check if two `RouteRecords` are equal. Takes into account aliases: they are
 * considered equal to the `RouteRecord` they are aliasing.
 *
 * @param a - first {@link RouteRecord}
 * @param b - second {@link RouteRecord}
 */
export declare function isSameRouteRecord(a: RouteRecord, b: RouteRecord): boolean;
export declare function isSameRouteLocationParams(a: RouteLocationNormalized['params'], b: RouteLocationNormalized['params']): boolean;
/**
 * Resolves a relative path that starts with `.`.
 *
 * @param to - path location we are resolving
 * @param from - currentLocation.path, should start with `/`
 */
export declare function resolveRelativePath(to: string, from: string): string;
export {};
//# sourceMappingURL=location.d.ts.map