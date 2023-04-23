export declare const enum TokenType {
    Static = 0,
    Param = 1,
    Group = 2
}
interface TokenStatic {
    type: TokenType.Static;
    value: string;
}
interface TokenParam {
    type: TokenType.Param;
    regexp?: string;
    value: string;
    optional: boolean;
    repeatable: boolean;
}
interface TokenGroup {
    type: TokenType.Group;
    value: Exclude<Token, TokenGroup>[];
}
export declare type Token = TokenStatic | TokenParam | TokenGroup;
export declare function tokenizePath(path: string): Array<Token[]>;
export {};
//# sourceMappingURL=pathTokenizer.d.ts.map