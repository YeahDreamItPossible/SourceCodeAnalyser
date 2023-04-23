import { PropType, VNodeProps, AllowedComponentProps, ComponentCustomProps, VNode } from 'vue';
import { RouteLocationNormalized, RouteLocationNormalizedLoaded, RouteLocationMatched } from './types';
export interface RouterViewProps {
    name?: string;
    route?: RouteLocationNormalized;
}
export interface RouterViewDevtoolsContext extends Pick<RouteLocationMatched, 'path' | 'name' | 'meta'> {
    depth: number;
}
export declare const RouterViewImpl: import("vue").DefineComponent<{
    name: {
        type: PropType<string>;
        default: string;
    };
    route: PropType<RouteLocationNormalizedLoaded>;
}, () => VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}> | VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}>[] | null, unknown, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, VNodeProps & AllowedComponentProps & ComponentCustomProps, Readonly<import("vue").ExtractPropTypes<{
    name: {
        type: PropType<string>;
        default: string;
    };
    route: PropType<RouteLocationNormalizedLoaded>;
}>>, {
    name: string;
}>;
/**
 * Component to display the current route the user is at.
 */
export declare const RouterView: new () => {
    $props: AllowedComponentProps & ComponentCustomProps & VNodeProps & RouterViewProps;
    $slots: {
        default?: (({ Component, route, }: {
            Component: VNode;
            route: RouteLocationNormalizedLoaded;
        }) => VNode[]) | undefined;
    };
};
//# sourceMappingURL=RouterView.d.ts.map