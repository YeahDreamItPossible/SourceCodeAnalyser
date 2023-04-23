import { PropType, VNode, UnwrapRef, VNodeProps, AllowedComponentProps, ComponentCustomProps, ComputedRef, DefineComponent, RendererElement, RendererNode, ComponentOptionsMixin } from 'vue';
import { RouteLocationRaw, VueUseOptions, RouteLocation, RouteLocationNormalized } from './types';
import { NavigationFailure } from './errors';
export interface RouterLinkOptions {
    /**
     * Route Location the link should navigate to when clicked on.
     */
    to: RouteLocationRaw;
    /**
     * Calls `router.replace` instead of `router.push`.
     */
    replace?: boolean;
}
export interface RouterLinkProps extends RouterLinkOptions {
    /**
     * Whether RouterLink should not wrap its content in an `a` tag. Useful when
     * using `v-slot` to create a custom RouterLink
     */
    custom?: boolean;
    /**
     * Class to apply when the link is active
     */
    activeClass?: string;
    /**
     * Class to apply when the link is exact active
     */
    exactActiveClass?: string;
    /**
     * Value passed to the attribute `aria-current` when the link is exact active.
     *
     * @defaultValue `'page'`
     */
    ariaCurrentValue?: 'page' | 'step' | 'location' | 'date' | 'time' | 'true' | 'false';
}
export interface UseLinkDevtoolsContext {
    route: RouteLocationNormalized & {
        href: string;
    };
    isActive: boolean;
    isExactActive: boolean;
}
export declare type UseLinkOptions = VueUseOptions<RouterLinkOptions>;
export declare function useLink(props: UseLinkOptions): {
    route: ComputedRef<RouteLocation & {
        href: string;
    }>;
    href: ComputedRef<string>;
    isActive: ComputedRef<boolean>;
    isExactActive: ComputedRef<boolean>;
    navigate: (e?: MouseEvent) => Promise<void | NavigationFailure>;
};
export declare const RouterLinkImpl: DefineComponent<{
    to: {
        type: PropType<RouteLocationRaw>;
        required: true;
    };
    replace: BooleanConstructor;
    activeClass: StringConstructor;
    exactActiveClass: StringConstructor;
    custom: BooleanConstructor;
    ariaCurrentValue: {
        type: PropType<"page" | "step" | "location" | "date" | "time" | "true" | "false" | undefined>;
        default: string;
    };
}, () => VNode<RendererNode, RendererElement, {
    [key: string]: any;
}> | VNode<RendererNode, RendererElement, {
    [key: string]: any;
}>[] | undefined, unknown, {}, {}, ComponentOptionsMixin, ComponentOptionsMixin, {}, string, VNodeProps & AllowedComponentProps & ComponentCustomProps, Readonly<import("vue").ExtractPropTypes<{
    to: {
        type: PropType<RouteLocationRaw>;
        required: true;
    };
    replace: BooleanConstructor;
    activeClass: StringConstructor;
    exactActiveClass: StringConstructor;
    custom: BooleanConstructor;
    ariaCurrentValue: {
        type: PropType<"page" | "step" | "location" | "date" | "time" | "true" | "false" | undefined>;
        default: string;
    };
}>>, {
    replace: boolean;
    ariaCurrentValue: "page" | "step" | "location" | "date" | "time" | "true" | "false" | undefined;
    custom: boolean;
}>;
/**
 * Component to render a link that triggers a navigation on click.
 */
export declare const RouterLink: _RouterLinkI;
/**
 * Typed version of the `RouterLink` component. Its generic defaults to the typed router, so it can be inferred
 * automatically for JSX.
 *
 * @internal
 */
export interface _RouterLinkI {
    new (): {
        $props: AllowedComponentProps & ComponentCustomProps & VNodeProps & RouterLinkProps;
        $slots: {
            default?: ({ route, href, isActive, isExactActive, navigate, }: UnwrapRef<ReturnType<typeof useLink>>) => VNode[];
        };
    };
    /**
     * Access to `useLink()` without depending on using vue-router
     *
     * @internal
     */
    useLink: typeof useLink;
}
//# sourceMappingURL=RouterLink.d.ts.map