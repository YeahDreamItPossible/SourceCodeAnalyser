import { RouteLocationNormalized, RouteLocationNormalizedLoaded } from './types';
/**
 * Scroll position similar to
 * {@link https://developer.mozilla.org/en-US/docs/Web/API/ScrollToOptions | `ScrollToOptions`}.
 * Note that not all browsers support `behavior`.
 */
export declare type ScrollPositionCoordinates = {
    behavior?: ScrollOptions['behavior'];
    left?: number;
    top?: number;
};
/**
 * Internal normalized version of {@link ScrollPositionCoordinates} that always
 * has `left` and `top` coordinates.
 *
 * @internal
 */
export declare type _ScrollPositionNormalized = {
    behavior?: ScrollOptions['behavior'];
    left: number;
    top: number;
};
export interface ScrollPositionElement extends ScrollToOptions {
    /**
     * A valid CSS selector. Note some characters must be escaped in id selectors (https://mathiasbynens.be/notes/css-escapes).
     * @example
     * Here are a few examples:
     *
     * - `.title`
     * - `.content:first-child`
     * - `#marker`
     * - `#marker\~with\~symbols`
     * - `#marker.with.dot`: selects `class="with dot" id="marker"`, not `id="marker.with.dot"`
     *
     */
    el: string | Element;
}
export declare type ScrollPosition = ScrollPositionCoordinates | ScrollPositionElement;
declare type Awaitable<T> = T | PromiseLike<T>;
export interface ScrollBehaviorHandler<T> {
    (to: RouteLocationNormalized, from: RouteLocationNormalizedLoaded, savedPosition: T | void): Awaitable<ScrollPosition | false | void>;
}
export declare const computeScrollPosition: () => _ScrollPositionNormalized;
export declare function scrollToPosition(position: ScrollPosition): void;
export declare function getScrollKey(path: string, delta: number): string;
export declare const scrollPositions: Map<string, _ScrollPositionNormalized>;
export declare function saveScrollPosition(key: string, scrollPosition: _ScrollPositionNormalized): void;
export declare function getSavedScrollPosition(key: string): _ScrollPositionNormalized | undefined;
export {};
/**
 * ScrollBehavior instance used by the router to compute and restore the scroll
 * position when navigating.
 */
//# sourceMappingURL=scrollBehavior.d.ts.map