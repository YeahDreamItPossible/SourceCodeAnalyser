import { MatcherLocationRaw, MatcherLocation, RouteLocationRaw, RouteLocationNormalized } from './types';
/**
 * Flags so we can combine them when checking for multiple errors. This is the internal version of
 * {@link NavigationFailureType}.
 *
 * @internal
 */
export declare const enum ErrorTypes {
    MATCHER_NOT_FOUND = 1,
    NAVIGATION_GUARD_REDIRECT = 2,
    NAVIGATION_ABORTED = 4,
    NAVIGATION_CANCELLED = 8,
    NAVIGATION_DUPLICATED = 16
}
export interface MatcherError extends Error {
    type: ErrorTypes.MATCHER_NOT_FOUND;
    location: MatcherLocationRaw;
    currentLocation?: MatcherLocation;
}
/**
 * Enumeration with all possible types for navigation failures. Can be passed to
 * {@link isNavigationFailure} to check for specific failures.
 */
export declare enum NavigationFailureType {
    /**
     * An aborted navigation is a navigation that failed because a navigation
     * guard returned `false` or called `next(false)`
     */
    aborted = 4,
    /**
     * A cancelled navigation is a navigation that failed because a more recent
     * navigation finished started (not necessarily finished).
     */
    cancelled = 8,
    /**
     * A duplicated navigation is a navigation that failed because it was
     * initiated while already being at the exact same location.
     */
    duplicated = 16
}
/**
 * Extended Error that contains extra information regarding a failed navigation.
 */
export interface NavigationFailure extends Error {
    /**
     * Type of the navigation. One of {@link NavigationFailureType}
     */
    type: ErrorTypes.NAVIGATION_CANCELLED | ErrorTypes.NAVIGATION_ABORTED | ErrorTypes.NAVIGATION_DUPLICATED;
    /**
     * Route location we were navigating from
     */
    from: RouteLocationNormalized;
    /**
     * Route location we were navigating to
     */
    to: RouteLocationNormalized;
}
/**
 * Internal error used to detect a redirection.
 *
 * @internal
 */
export interface NavigationRedirectError extends Omit<NavigationFailure, 'to' | 'type'> {
    type: ErrorTypes.NAVIGATION_GUARD_REDIRECT;
    to: RouteLocationRaw;
}
declare type RouterError = NavigationFailure | NavigationRedirectError | MatcherError;
export declare function createRouterError<E extends RouterError>(type: E['type'], params: Omit<E, 'type' | keyof Error>): E;
/**
 * Check if an object is a {@link NavigationFailure}.
 *
 * @example
 * ```js
 * import { isNavigationFailure, NavigationFailureType } from 'vue-router'
 *
 * router.afterEach((to, from, failure) => {
 *   // Any kind of navigation failure
 *   if (isNavigationFailure(failure)) {
 *     // ...
 *   }
 *   // Only duplicated navigations
 *   if (isNavigationFailure(failure, NavigationFailureType.duplicated)) {
 *     // ...
 *   }
 *   // Aborted or canceled navigations
 *   if (isNavigationFailure(failure, NavigationFailureType.aborted | NavigationFailureType.canceled)) {
 *     // ...
 *   }
 * })
 * ```
 * @param error - possible {@link NavigationFailure}
 * @param type - optional types to check for
 */
export declare function isNavigationFailure(error: any, type?: ErrorTypes.NAVIGATION_GUARD_REDIRECT): error is NavigationRedirectError;
export declare function isNavigationFailure(error: any, type?: ErrorTypes | NavigationFailureType): error is NavigationFailure;
export {};
//# sourceMappingURL=errors.d.ts.map