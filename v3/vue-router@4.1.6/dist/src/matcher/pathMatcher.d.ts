import { RouteRecord } from './types';
import { PathParser, PathParserOptions } from './pathParserRanker';
export interface RouteRecordMatcher extends PathParser {
    record: RouteRecord;
    parent: RouteRecordMatcher | undefined;
    children: RouteRecordMatcher[];
    alias: RouteRecordMatcher[];
}
export declare function createRouteRecordMatcher(record: Readonly<RouteRecord>, parent: RouteRecordMatcher | undefined, options?: PathParserOptions): RouteRecordMatcher;
//# sourceMappingURL=pathMatcher.d.ts.map