import { NavigationGuard, RouteLocationNormalized, RouteLocationNormalizedLoaded, RouteComponent, RawRouteComponent } from './types';
import { RouteRecordNormalized } from './matcher/types';
/**
 * Add a navigation guard that triggers whenever the component for the current
 * location is about to be left. Similar to {@link beforeRouteLeave} but can be
 * used in any component. The guard is removed when the component is unmounted.
 *
 * @param leaveGuard - {@link NavigationGuard}
 */
export declare function onBeforeRouteLeave(leaveGuard: NavigationGuard): void;
/**
 * Add a navigation guard that triggers whenever the current location is about
 * to be updated. Similar to {@link beforeRouteUpdate} but can be used in any
 * component. The guard is removed when the component is unmounted.
 *
 * @param updateGuard - {@link NavigationGuard}
 */
export declare function onBeforeRouteUpdate(updateGuard: NavigationGuard): void;
export declare function guardToPromiseFn(guard: NavigationGuard, to: RouteLocationNormalized, from: RouteLocationNormalizedLoaded): () => Promise<void>;
export declare function guardToPromiseFn(guard: NavigationGuard, to: RouteLocationNormalized, from: RouteLocationNormalizedLoaded, record: RouteRecordNormalized, name: string): () => Promise<void>;
declare type GuardType = 'beforeRouteEnter' | 'beforeRouteUpdate' | 'beforeRouteLeave';
export declare function extractComponentsGuards(matched: RouteRecordNormalized[], guardType: GuardType, to: RouteLocationNormalized, from: RouteLocationNormalizedLoaded): (() => Promise<void>)[];
/**
 * Allows differentiating lazy components from functional components and vue-class-component
 * @internal
 *
 * @param component
 */
export declare function isRouteComponent(component: RawRouteComponent): component is RouteComponent;
/**
 * Ensures a route is loaded, so it can be passed as o prop to `<RouterView>`.
 *
 * @param route - resolved route to load
 */
export declare function loadRouteLocation(route: RouteLocationNormalized): Promise<RouteLocationNormalizedLoaded>;
export {};
//# sourceMappingURL=navigationGuards.d.ts.map