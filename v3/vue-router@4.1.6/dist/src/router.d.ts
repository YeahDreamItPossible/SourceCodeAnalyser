import { RouteLocationNormalized, RouteRecordRaw, RouteLocationRaw, NavigationHookAfter, RouteLocationNormalizedLoaded, RouteLocation, RouteRecordName, NavigationGuardWithThis } from './types';
import { RouterHistory } from './history/common';
import { ScrollPosition, _ScrollPositionNormalized } from './scrollBehavior';
import { PathParserOptions } from './matcher';
import { NavigationFailure } from './errors';
import { parseQuery as originalParseQuery, stringifyQuery as originalStringifyQuery } from './query';
import { Ref, App } from 'vue';
import { RouteRecord } from './matcher/types';
/**
 * Internal type to define an ErrorHandler
 *
 * @param error - error thrown
 * @param to - location we were navigating to when the error happened
 * @param from - location we were navigating from when the error happened
 * @internal
 */
export declare type _ErrorHandler = (error: any, to: RouteLocationNormalized, from: RouteLocationNormalizedLoaded) => any;
declare type Awaitable<T> = T | Promise<T>;
/**
 * Type of the `scrollBehavior` option that can be passed to `createRouter`.
 */
export interface RouterScrollBehavior {
    /**
     * @param to - Route location where we are navigating to
     * @param from - Route location where we are navigating from
     * @param savedPosition - saved position if it exists, `null` otherwise
     */
    (to: RouteLocationNormalized, from: RouteLocationNormalizedLoaded, savedPosition: _ScrollPositionNormalized | null): Awaitable<ScrollPosition | false | void>;
}
/**
 * Options to initialize a {@link Router} instance.
 */
export interface RouterOptions extends PathParserOptions {
    /**
     * History implementation used by the router. Most web applications should use
     * `createWebHistory` but it requires the server to be properly configured.
     * You can also use a _hash_ based history with `createWebHashHistory` that
     * does not require any configuration on the server but isn't handled at all
     * by search engines and does poorly on SEO.
     *
     * @example
     * ```js
     * createRouter({
     *   history: createWebHistory(),
     *   // other options...
     * })
     * ```
     */
    history: RouterHistory;
    /**
     * Initial list of routes that should be added to the router.
     */
    routes: Readonly<RouteRecordRaw[]>;
    /**
     * Function to control scrolling when navigating between pages. Can return a
     * Promise to delay scrolling. Check {@link ScrollBehavior}.
     *
     * @example
     * ```js
     * function scrollBehavior(to, from, savedPosition) {
     *   // `to` and `from` are both route locations
     *   // `savedPosition` can be null if there isn't one
     * }
     * ```
     */
    scrollBehavior?: RouterScrollBehavior;
    /**
     * Custom implementation to parse a query. See its counterpart,
     * {@link RouterOptions.stringifyQuery}.
     *
     * @example
     * Let's say you want to use the [qs package](https://github.com/ljharb/qs)
     * to parse queries, you can provide both `parseQuery` and `stringifyQuery`:
     * ```js
     * import qs from 'qs'
     *
     * createRouter({
     *   // other options...
     *   parseQuery: qs.parse,
     *   stringifyQuery: qs.stringify,
     * })
     * ```
     */
    parseQuery?: typeof originalParseQuery;
    /**
     * Custom implementation to stringify a query object. Should not prepend a leading `?`.
     * {@link RouterOptions.parseQuery | parseQuery} counterpart to handle query parsing.
     */
    stringifyQuery?: typeof originalStringifyQuery;
    /**
     * Default class applied to active {@link RouterLink}. If none is provided,
     * `router-link-active` will be applied.
     */
    linkActiveClass?: string;
    /**
     * Default class applied to exact active {@link RouterLink}. If none is provided,
     * `router-link-exact-active` will be applied.
     */
    linkExactActiveClass?: string;
}
/**
 * Router instance.
 */
export interface Router {
    /**
     * @internal
     */
    /**
     * Current {@link RouteLocationNormalized}
     */
    readonly currentRoute: Ref<RouteLocationNormalizedLoaded>;
    /**
     * Original options object passed to create the Router
     */
    readonly options: RouterOptions;
    /**
     * Allows turning off the listening of history events. This is a low level api for micro-frontends.
     */
    listening: boolean;
    /**
     * Add a new {@link RouteRecordRaw | route record} as the child of an existing route.
     *
     * @param parentName - Parent Route Record where `route` should be appended at
     * @param route - Route Record to add
     */
    addRoute(parentName: RouteRecordName, route: RouteRecordRaw): () => void;
    /**
     * Add a new {@link RouteRecordRaw | route record} to the router.
     *
     * @param route - Route Record to add
     */
    addRoute(route: RouteRecordRaw): () => void;
    /**
     * Remove an existing route by its name.
     *
     * @param name - Name of the route to remove
     */
    removeRoute(name: RouteRecordName): void;
    /**
     * Checks if a route with a given name exists
     *
     * @param name - Name of the route to check
     */
    hasRoute(name: RouteRecordName): boolean;
    /**
     * Get a full list of all the {@link RouteRecord | route records}.
     */
    getRoutes(): RouteRecord[];
    /**
     * Returns the {@link RouteLocation | normalized version} of a
     * {@link RouteLocationRaw | route location}. Also includes an `href` property
     * that includes any existing `base`. By default, the `currentLocation` used is
     * `route.currentRoute` and should only be overridden in advanced use cases.
     *
     * @param to - Raw route location to resolve
     * @param currentLocation - Optional current location to resolve against
     */
    resolve(to: RouteLocationRaw, currentLocation?: RouteLocationNormalizedLoaded): RouteLocation & {
        href: string;
    };
    /**
     * Programmatically navigate to a new URL by pushing an entry in the history
     * stack.
     *
     * @param to - Route location to navigate to
     */
    push(to: RouteLocationRaw): Promise<NavigationFailure | void | undefined>;
    /**
     * Programmatically navigate to a new URL by replacing the current entry in
     * the history stack.
     *
     * @param to - Route location to navigate to
     */
    replace(to: RouteLocationRaw): Promise<NavigationFailure | void | undefined>;
    /**
     * Go back in history if possible by calling `history.back()`. Equivalent to
     * `router.go(-1)`.
     */
    back(): ReturnType<Router['go']>;
    /**
     * Go forward in history if possible by calling `history.forward()`.
     * Equivalent to `router.go(1)`.
     */
    forward(): ReturnType<Router['go']>;
    /**
     * Allows you to move forward or backward through the history. Calls
     * `history.go()`.
     *
     * @param delta - The position in the history to which you want to move,
     * relative to the current page
     */
    go(delta: number): void;
    /**
     * Add a navigation guard that executes before any navigation. Returns a
     * function that removes the registered guard.
     *
     * @param guard - navigation guard to add
     */
    beforeEach(guard: NavigationGuardWithThis<undefined>): () => void;
    /**
     * Add a navigation guard that executes before navigation is about to be
     * resolved. At this state all component have been fetched and other
     * navigation guards have been successful. Returns a function that removes the
     * registered guard.
     *
     * @example
     * ```js
     * router.beforeResolve(to => {
     *   if (to.meta.requiresAuth && !isAuthenticated) return false
     * })
     * ```
     *
     * @param guard - navigation guard to add
     */
    beforeResolve(guard: NavigationGuardWithThis<undefined>): () => void;
    /**
     * Add a navigation hook that is executed after every navigation. Returns a
     * function that removes the registered hook.
     *
     * @example
     * ```js
     * router.afterEach((to, from, failure) => {
     *   if (isNavigationFailure(failure)) {
     *     console.log('failed navigation', failure)
     *   }
     * })
     * ```
     *
     * @param guard - navigation hook to add
     */
    afterEach(guard: NavigationHookAfter): () => void;
    /**
     * Adds an error handler that is called every time a non caught error happens
     * during navigation. This includes errors thrown synchronously and
     * asynchronously, errors returned or passed to `next` in any navigation
     * guard, and errors occurred when trying to resolve an async component that
     * is required to render a route.
     *
     * @param handler - error handler to register
     */
    onError(handler: _ErrorHandler): () => void;
    /**
     * Returns a Promise that resolves when the router has completed the initial
     * navigation, which means it has resolved all async enter hooks and async
     * components that are associated with the initial route. If the initial
     * navigation already happened, the promise resolves immediately.
     *
     * This is useful in server-side rendering to ensure consistent output on both
     * the server and the client. Note that on server side, you need to manually
     * push the initial location while on client side, the router automatically
     * picks it up from the URL.
     */
    isReady(): Promise<void>;
    /**
     * Called automatically by `app.use(router)`. Should not be called manually by
     * the user. This will trigger the initial navigation when on client side.
     *
     * @internal
     * @param app - Application that uses the router
     */
    install(app: App): void;
}
/**
 * Creates a Router instance that can be used by a Vue app.
 *
 * @param options - {@link RouterOptions}
 */
export declare function createRouter(options: RouterOptions): Router;
export {};
//# sourceMappingURL=router.d.ts.map