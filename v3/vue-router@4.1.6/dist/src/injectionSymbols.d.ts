import type { InjectionKey, ComputedRef, Ref } from 'vue';
import { RouteLocationNormalizedLoaded } from './types';
import { RouteRecordNormalized } from './matcher/types';
import type { Router } from './router';
/**
 * RouteRecord being rendered by the closest ancestor Router View. Used for
 * `onBeforeRouteUpdate` and `onBeforeRouteLeave`. rvlm stands for Router View
 * Location Matched
 *
 * @internal
 */
export declare const matchedRouteKey: InjectionKey<ComputedRef<RouteRecordNormalized | undefined>>;
/**
 * Allows overriding the router view depth to control which component in
 * `matched` is rendered. rvd stands for Router View Depth
 *
 * @internal
 */
export declare const viewDepthKey: InjectionKey<number | Ref<number>>;
/**
 * Allows overriding the router instance returned by `useRouter` in tests. r
 * stands for router
 *
 * @internal
 */
export declare const routerKey: InjectionKey<Router>;
/**
 * Allows overriding the current route returned by `useRoute` in tests. rl
 * stands for route location
 *
 * @internal
 */
export declare const routeLocationKey: InjectionKey<RouteLocationNormalizedLoaded>;
/**
 * Allows overriding the current route used by router-view. Internally this is
 * used when the `route` prop is passed.
 *
 * @internal
 */
export declare const routerViewLocationKey: InjectionKey<Ref<RouteLocationNormalizedLoaded>>;
//# sourceMappingURL=injectionSymbols.d.ts.map