export declare type HistoryLocation = string;
/**
 * Allowed variables in HTML5 history state. Note that pushState clones the state
 * passed and does not accept everything: e.g.: it doesn't accept symbols, nor
 * functions as values. It also ignores Symbols as keys.
 *
 * @internal
 */
export declare type HistoryStateValue = string | number | boolean | null | undefined | HistoryState | HistoryStateArray;
/**
 * Allowed HTML history.state
 */
export interface HistoryState {
    [x: number]: HistoryStateValue;
    [x: string]: HistoryStateValue;
}
/**
 * Allowed arrays for history.state.
 *
 * @internal
 */
export interface HistoryStateArray extends Array<HistoryStateValue> {
}
export declare enum NavigationType {
    pop = "pop",
    push = "push"
}
export declare enum NavigationDirection {
    back = "back",
    forward = "forward",
    unknown = ""
}
export interface NavigationInformation {
    type: NavigationType;
    direction: NavigationDirection;
    delta: number;
}
export interface NavigationCallback {
    (to: HistoryLocation, from: HistoryLocation, information: NavigationInformation): void;
}
/**
 * Starting location for Histories
 */
export declare const START: HistoryLocation;
export declare type ValueContainer<T> = {
    value: T;
};
/**
 * Interface implemented by History implementations that can be passed to the
 * router as {@link Router.history}
 *
 * @alpha
 */
export interface RouterHistory {
    /**
     * Base path that is prepended to every url. This allows hosting an SPA at a
     * sub-folder of a domain like `example.com/sub-folder` by having a `base` of
     * `/sub-folder`
     */
    readonly base: string;
    /**
     * Current History location
     */
    readonly location: HistoryLocation;
    /**
     * Current History state
     */
    readonly state: HistoryState;
    /**
     * Navigates to a location. In the case of an HTML5 History implementation,
     * this will call `history.pushState` to effectively change the URL.
     *
     * @param to - location to push
     * @param data - optional {@link HistoryState} to be associated with the
     * navigation entry
     */
    push(to: HistoryLocation, data?: HistoryState): void;
    /**
     * Same as {@link RouterHistory.push} but performs a `history.replaceState`
     * instead of `history.pushState`
     *
     * @param to - location to set
     * @param data - optional {@link HistoryState} to be associated with the
     * navigation entry
     */
    replace(to: HistoryLocation, data?: HistoryState): void;
    /**
     * Traverses history in a given direction.
     *
     * @example
     * ```js
     * myHistory.go(-1) // equivalent to window.history.back()
     * myHistory.go(1) // equivalent to window.history.forward()
     * ```
     *
     * @param delta - distance to travel. If delta is \< 0, it will go back,
     * if it's \> 0, it will go forward by that amount of entries.
     * @param triggerListeners - whether this should trigger listeners attached to
     * the history
     */
    go(delta: number, triggerListeners?: boolean): void;
    /**
     * Attach a listener to the History implementation that is triggered when the
     * navigation is triggered from outside (like the Browser back and forward
     * buttons) or when passing `true` to {@link RouterHistory.back} and
     * {@link RouterHistory.forward}
     *
     * @param callback - listener to attach
     * @returns a callback to remove the listener
     */
    listen(callback: NavigationCallback): () => void;
    /**
     * Generates the corresponding href to be used in an anchor tag.
     *
     * @param location - history location that should create an href
     */
    createHref(location: HistoryLocation): string;
    /**
     * Clears any event listener attached by the history implementation.
     */
    destroy(): void;
}
/**
 * Normalizes a base by removing any trailing slash and reading the base tag if
 * present.
 *
 * @param base - base to normalize
 */
export declare function normalizeBase(base?: string): string;
export declare function createHref(base: string, location: HistoryLocation): string;
//# sourceMappingURL=common.d.ts.map