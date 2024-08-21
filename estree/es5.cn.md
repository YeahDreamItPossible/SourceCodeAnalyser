本文档详细介绍了 支持ES5语法 的 核心抽象语法树AST 节点类型

- [节点对象](#节点对象)
- [标识符](#标识符)
- [字面量](#literal)
  - [正则表达式字面量](#regexpliteral)
- [程序](#programs)
- [函数](#functions)
- [语句](#statements)
  - [表达式语句](#expressionstatement)
  - [块语句](#blockstatement)
  - [空语句](#emptystatement)
  - [调试语句](#debuggerstatement)
  - [With语句](#withstatement)
  - [流程语句](#control-flow)
    - [Return语句](#returnstatement)
    - [Labeled语句](#labeledstatement)
    - [Break语句](#breakstatement)
    - [Continue语句](#continuestatement)
  - [选择语句](#choice)
    - [If语句](#ifstatement)
    - [Switch语句](#switchstatement)
      - [SwitchCase语句](#switchcase)
  - [异常语句](#exceptions)
    - [ThrowStatement](#throwstatement)
    - [TryStatement](#trystatement)
      - [CatchClause](#catchclause)
  - [循环语句](#loops)
    - [While语句](#whilestatement)
    - [DoWhile语句](#dowhilestatement)
    - [For语句](#forstatement)
    - [ForIn语句](#forinstatement)
- [声明](#declarations)
  - [FunctionDeclaration](#functiondeclaration)
  - [VariableDeclaration](#variabledeclaration)
    - [VariableDeclarator](#variabledeclarator)
- [表达式](#expressions)
  - [This表达式](#thisexpression)
  - [ArrayExpression](#arrayexpression)
  - [ObjectExpression](#objectexpression)
    - [Property](#property)
  - [函数表达式](#functionexpression)
  - [一元操作符表达式](#unary-operations)
    - [UnaryExpression](#unaryexpression)
      - [UnaryOperator](#unaryoperator)
    - [UpdateExpression](#updateexpression)
      - [UpdateOperator](#updateoperator)
  - [二元运算符表达式](#binary-operations)
    - [二元表达式](#binaryexpression)
      - [二元操作符](#binaryoperator)
    - [赋值表达式](#assignmentexpression)
      - [赋值运算符](#assignmentoperator)
    - [逻辑表达式](#logicalexpression)
      - [逻辑运算符](#logicaloperator)
    - [成员表达式](#memberexpression)
  - [条件表达式](#conditionalexpression)
  - [Call表达式](#callexpression)
  - [NewExpression](#newexpression)
  - [SequenceExpression](#sequenceexpression)
- [Patterns](#patterns)

# 节点对象

抽象语法树AST 节点表示为 节点对象
该类是 AST节点 的基类
实现了以下接口的功能

```js
interface Node {
    type: string;
    loc: SourceLocation | null;
}
```
该 type 字段是表示 节点对象类型 的字符串.
每个 节点对象的子类 都必须用 特定字符串 标记 type 字段.

该 loc 字段是表示 节点对象 的源位置信息.
如果节点不包含有关源位置的信息,则字段为无效的; 
否则,它是一个由起始位置(解析源区域的第一个字符的位置)和结束位置(解析的源区域后的第一个字母的位置)组成的对象：

```js
interface SourceLocation {
    source: string | null;
    start: Position;
    end: Position;
}
```

每个 Position对象 必须包含行索引(从 1 开始)和 列索引(从 0 开始)字段：

```js
interface Position {
    line: number; // >= 1
    column: number; // >= 0
}
```

# 标识符

```js
interface Identifier <: Expression, Pattern {
    type: "Identifier";
    name: string;
}
```

请注意,标识符可以是表达式或解构模式

# 字面量

```js
interface Literal <: Expression {
    type: "Literal";
    value: string | boolean | null | number | RegExp;
}
```

注意,字面量值可以是表达式.

## 正则表达式字面量

```js
interface RegExpLiteral <: Literal {
  regex: {
    pattern: string;
    flags: string;
  };
}
```
这个regex属性允许在不支持某些标志的环境中表示正则表达式，例如y或u。
在不支持这些标志的环境中价值将null因为正则表达式不能以本机方式表示。
The `regex` property allows regexes to be represented in environments that don’t
support certain flags such as `y` or `u`. In environments that don't support
these flags `value` will be `null` as the regex can't be represented natively.

# 程序

```js
interface Program <: Node {
    type: "Program";
    body: [ Directive | Statement ];
}
```

完整的程序源代码树

# 函数

```js
interface Function <: Node {
    id: Identifier | null;
    params: [ Pattern ];
    body: FunctionBody;
}
```

函数声明 或 函数表达式

# 语句

```js
interface Statement <: Node { }
```

## 表达式语句

```js
interface ExpressionStatement <: Statement {
    type: "ExpressionStatement";
    expression: Expression;
}
```
表达式语句，即由单个表达式组成的语句。

## 指令

```js
interface Directive <: ExpressionStatement {
    expression: Literal;
    directive: string;
}
```

脚本或函数的指令序言中的指令。这个directive属性是不带引号的指令的原始字符串源。
A directive from the directive prologue of a script or function.
The `directive` property is the raw string source of the directive without quotes.

## 块语句

```js
interface BlockStatement <: Statement {
    type: "BlockStatement";
    body: [ Statement ];
}
```

块语句，即由大括号包围的语句序列。

## 函数体

```js
interface FunctionBody <: BlockStatement {
    body: [ Directive | Statement ];
}
```

The body of a function, which is a block statement that may begin with directives.

## 空语句

```js
interface EmptyStatement <: Statement {
    type: "EmptyStatement";
}
```

An empty statement, i.e., a solitary semicolon.

## 调试语句

```js
interface DebuggerStatement <: Statement {
    type: "DebuggerStatement";
}
```

A `debugger` statement.

## With语句

```js
interface WithStatement <: Statement {
    type: "WithStatement";
    object: Expression;
    body: Statement;
}
```

A `with` statement.

## 流程语句

### Return语句

```js
interface ReturnStatement <: Statement {
    type: "ReturnStatement";
    argument: Expression | null;
}
```

A `return` statement.

### Labeled语句

```js
interface LabeledStatement <: Statement {
    type: "LabeledStatement";
    label: Identifier;
    body: Statement;
}
```

A labeled statement, i.e., a statement prefixed by a `break`/`continue` label.

### Break语句

```js
interface BreakStatement <: Statement {
    type: "BreakStatement";
    label: Identifier | null;
}
```

A `break` statement.

### Continue语句

```js
interface ContinueStatement <: Statement {
    type: "ContinueStatement";
    label: Identifier | null;
}
```

A `continue` statement.

## 条件语句

### If语句

```js
interface IfStatement <: Statement {
    type: "IfStatement";
    test: Expression;
    consequent: Statement;
    alternate: Statement | null;
}
```

An `if` statement.

### Switch语句

```js
interface SwitchStatement <: Statement {
    type: "SwitchStatement";
    discriminant: Expression;
    cases: [ SwitchCase ];
}
```

A `switch` statement.

#### SwitchCase

```js
interface SwitchCase <: Node {
    type: "SwitchCase";
    test: Expression | null;
    consequent: [ Statement ];
}
```

A `case` (if `test` is an `Expression`) or `default` (if `test === null`) clause in the body of a `switch` statement.

## 异常语句

### Throw语句

```js
interface ThrowStatement <: Statement {
    type: "ThrowStatement";
    argument: Expression;
}
```

A `throw` statement.

### Try语句

```js
interface TryStatement <: Statement {
    type: "TryStatement";
    block: BlockStatement;
    handler: CatchClause | null;
    finalizer: BlockStatement | null;
}
```

A `try` statement. If `handler` is `null` then `finalizer` must be a `BlockStatement`.

#### CatchClause

```js
interface CatchClause <: Node {
    type: "CatchClause";
    param: Pattern;
    body: BlockStatement;
}
```

A `catch` clause following a `try` block.

## 循环语句

### While语句

```js
interface WhileStatement <: Statement {
    type: "WhileStatement";
    test: Expression;
    body: Statement;
}
```

A `while` statement.

### DoWhile语句

```js
interface DoWhileStatement <: Statement {
    type: "DoWhileStatement";
    body: Statement;
    test: Expression;
}
```

A `do`/`while` statement.

### For语句

```js
interface ForStatement <: Statement {
    type: "ForStatement";
    init: VariableDeclaration | Expression | null;
    test: Expression | null;
    update: Expression | null;
    body: Statement;
}
```

A `for` statement.

### ForIn语句

```js
interface ForInStatement <: Statement {
    type: "ForInStatement";
    left: VariableDeclaration |  Pattern;
    right: Expression;
    body: Statement;
}
```

A `for`/`in` statement.

# 声明

```js
interface Declaration <: Statement { }
```

Any declaration node. Note that declarations are considered statements; this is because declarations can appear in any statement context.

## 函数声明

```js
interface FunctionDeclaration <: Function, Declaration {
    type: "FunctionDeclaration";
    id: Identifier;
}
```

A function declaration. Note that unlike in the parent interface `Function`, the `id` cannot be `null`.

## 变量声明

```js
interface VariableDeclaration <: Declaration {
    type: "VariableDeclaration";
    declarations: [ VariableDeclarator ];
    kind: "var";
}
```

A variable declaration.

### VariableDeclarator

```js
interface VariableDeclarator <: Node {
    type: "VariableDeclarator";
    id: Pattern;
    init: Expression | null;
}
```

A variable declarator.

# 表达式

```js
interface Expression <: Node { }
```

Any expression node. Since the left-hand side of an assignment may be any expression in general, an expression can also be a pattern.

## This表达式

```js
interface ThisExpression <: Expression {
    type: "ThisExpression";
}
```

A `this` expression.

## Array表达式

```js
interface ArrayExpression <: Expression {
    type: "ArrayExpression";
    elements: [ Expression | null ];
}
```

An array expression. An element might be `null` if it represents a hole in a sparse array. E.g. `[1,,2]`.

## Object表达式

```js
interface ObjectExpression <: Expression {
    type: "ObjectExpression";
    properties: [ Property ];
}
```

An object expression.

### Property

```js
interface Property <: Node {
    type: "Property";
    key: Literal | Identifier;
    value: Expression;
    kind: "init" | "get" | "set";
}
```

A literal property in an object expression can have either a string or number as its `key`. Ordinary property initializers have a `kind` value `"init"`; getters and setters have the kind values `"get"` and `"set"`, respectively.

## Function表达式

```js
interface FunctionExpression <: Function, Expression {
    type: "FunctionExpression";
}
```

A `function` expression.

## 一元操作符表达式

### UnaryExpression

```js
interface UnaryExpression <: Expression {
    type: "UnaryExpression";
    operator: UnaryOperator;
    prefix: boolean;
    argument: Expression;
}
```

A unary operator expression.

#### UnaryOperator

```js
enum UnaryOperator {
    "-" | "+" | "!" | "~" | "typeof" | "void" | "delete"
}
```

A unary operator token.

### UpdateExpression

```js
interface UpdateExpression <: Expression {
    type: "UpdateExpression";
    operator: UpdateOperator;
    argument: Expression;
    prefix: boolean;
}
```

An update (increment or decrement) operator expression.

#### UpdateOperator

```js
enum UpdateOperator {
    "++" | "--"
}
```

An update (increment or decrement) operator token.

## 二元运算符表达式

### BinaryExpression

```js
interface BinaryExpression <: Expression {
    type: "BinaryExpression";
    operator: BinaryOperator;
    left: Expression;
    right: Expression;
}
```

A binary operator expression.

#### BinaryOperator

```js
enum BinaryOperator {
    "==" | "!=" | "===" | "!=="
         | "<" | "<=" | ">" | ">="
         | "<<" | ">>" | ">>>"
         | "+" | "-" | "*" | "/" | "%"
         | "|" | "^" | "&" | "in"
         | "instanceof"
}
```

A binary operator token.

### AssignmentExpression

```js
interface AssignmentExpression <: Expression {
    type: "AssignmentExpression";
    operator: AssignmentOperator;
    left: Pattern | Expression;
    right: Expression;
}
```

An assignment operator expression.

#### AssignmentOperator

```js
enum AssignmentOperator {
    "=" | "+=" | "-=" | "*=" | "/=" | "%="
        | "<<=" | ">>=" | ">>>="
        | "|=" | "^=" | "&="
}
```

An assignment operator token.

### LogicalExpression

```js
interface LogicalExpression <: Expression {
    type: "LogicalExpression";
    operator: LogicalOperator;
    left: Expression;
    right: Expression;
}
```

A logical operator expression.

#### LogicalOperator

```js
enum LogicalOperator {
    "||" | "&&"
}
```

A logical operator token.

### MemberExpression

```js
interface MemberExpression <: Expression, Pattern {
    type: "MemberExpression";
    object: Expression;
    property: Expression;
    computed: boolean;
}
```

A member expression. If `computed` is `true`, the node corresponds to a computed (`a[b]`) member expression and `property` is an `Expression`. If `computed` is `false`, the node corresponds to a static (`a.b`) member expression and `property` is an `Identifier`.

## 条件表达式

```js
interface ConditionalExpression <: Expression {
    type: "ConditionalExpression";
    test: Expression;
    alternate: Expression;
    consequent: Expression;
}
```

A conditional expression, i.e., a ternary `?`/`:` expression.

## Call表达式

```js
interface CallExpression <: Expression {
    type: "CallExpression";
    callee: Expression;
    arguments: [ Expression ];
}
```

A function or method call expression.

## New表达式

```js
interface NewExpression <: Expression {
    type: "NewExpression";
    callee: Expression;
    arguments: [ Expression ];
}
```

A `new` expression.

## Sequence表达式

```js
interface SequenceExpression <: Expression {
    type: "SequenceExpression";
    expressions: [ Expression ];
}
```

A sequence expression, i.e., a comma-separated sequence of expressions.

# 模式

Destructuring binding and assignment are not part of ES5, but all binding positions accept `Pattern` to allow for destructuring in ES6. Nevertheless, for ES5, the only `Pattern` subtype is [`Identifier`](#identifier).

```js
interface Pattern <: Node { }
```
