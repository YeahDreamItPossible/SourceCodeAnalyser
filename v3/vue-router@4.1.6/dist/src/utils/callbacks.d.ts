/**
 * Create a list of callbacks that can be reset. Used to create before and after navigation guards list
 */
export declare function useCallbacks<T>(): {
    add: (handler: T) => () => void;
    list: () => T[];
    reset: () => void;
};
//# sourceMappingURL=callbacks.d.ts.map