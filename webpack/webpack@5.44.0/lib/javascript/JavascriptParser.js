"use strict";

const { Parser: AcornParser } = require("acorn");
const { SyncBailHook, HookMap } = require("tapable");
const vm = require("vm");
const Parser = require("../Parser");
const StackedMap = require("../util/StackedMap");
const binarySearchBounds = require("../util/binarySearchBounds");
const memoize = require("../util/memoize");
const BasicEvaluatedExpression = require("./BasicEvaluatedExpression");

/** @typedef {import("acorn").Options} AcornOptions */
/** @typedef {import("estree").ArrayExpression} ArrayExpressionNode */
/** @typedef {import("estree").BinaryExpression} BinaryExpressionNode */
/** @typedef {import("estree").BlockStatement} BlockStatementNode */
/** @typedef {import("estree").SequenceExpression} SequenceExpressionNode */
/** @typedef {import("estree").CallExpression} CallExpressionNode */
/** @typedef {import("estree").ClassDeclaration} ClassDeclarationNode */
/** @typedef {import("estree").ClassExpression} ClassExpressionNode */
/** @typedef {import("estree").Comment} CommentNode */
/** @typedef {import("estree").ConditionalExpression} ConditionalExpressionNode */
/** @typedef {import("estree").Declaration} DeclarationNode */
/** @typedef {import("estree").PrivateIdentifier} PrivateIdentifierNode */
/** @typedef {import("estree").PropertyDefinition} PropertyDefinitionNode */
/** @typedef {import("estree").Expression} ExpressionNode */
/** @typedef {import("estree").Identifier} IdentifierNode */
/** @typedef {import("estree").IfStatement} IfStatementNode */
/** @typedef {import("estree").LabeledStatement} LabeledStatementNode */
/** @typedef {import("estree").Literal} LiteralNode */
/** @typedef {import("estree").LogicalExpression} LogicalExpressionNode */
/** @typedef {import("estree").ChainExpression} ChainExpressionNode */
/** @typedef {import("estree").MemberExpression} MemberExpressionNode */
/** @typedef {import("estree").MetaProperty} MetaPropertyNode */
/** @typedef {import("estree").MethodDefinition} MethodDefinitionNode */
/** @typedef {import("estree").ModuleDeclaration} ModuleDeclarationNode */
/** @typedef {import("estree").NewExpression} NewExpressionNode */
/** @typedef {import("estree").Node} AnyNode */
/** @typedef {import("estree").Program} ProgramNode */
/** @typedef {import("estree").Statement} StatementNode */
/** @typedef {import("estree").Super} SuperNode */
/** @typedef {import("estree").TaggedTemplateExpression} TaggedTemplateExpressionNode */
/** @typedef {import("estree").TemplateLiteral} TemplateLiteralNode */
/** @typedef {import("estree").ThisExpression} ThisExpressionNode */
/** @typedef {import("estree").UnaryExpression} UnaryExpressionNode */
/** @typedef {import("estree").VariableDeclarator} VariableDeclaratorNode */
/** @template T @typedef {import("tapable").AsArray<T>} AsArray<T> */
/** @typedef {import("../Parser").ParserState} ParserState */
/** @typedef {import("../Parser").PreparsedAst} PreparsedAst */
/** @typedef {{declaredScope: ScopeInfo, freeName: string | true, tagInfo: TagInfo | undefined}} VariableInfoInterface */
/** @typedef {{ name: string | VariableInfo, rootInfo: string | VariableInfo, getMembers: () => string[] }} GetInfoResult */

const EMPTY_ARRAY = [];
// 用二进制表示 1
const ALLOWED_MEMBER_TYPES_CALL_EXPRESSION = 0b01;
// 用二进制表示 2
const ALLOWED_MEMBER_TYPES_EXPRESSION = 0b10;
// 用二进制表示 3
const ALLOWED_MEMBER_TYPES_ALL = 0b11;

// Syntax: https://developer.mozilla.org/en/SpiderMonkey/Parser_API

const parser = AcornParser;

// 变量信息
class VariableInfo {
	constructor(declaredScope, freeName, tagInfo) {
		// 变量作用域
		this.declaredScope = declaredScope;
		// 变量别名 如果没有 则为true
		this.freeName = freeName;
		// 标签信息
		this.tagInfo = tagInfo;
	}
}

/** @typedef {string | ScopeInfo | VariableInfo} ExportedVariableInfo */
/** @typedef {LiteralNode | string | null | undefined} ImportSource */
/** @typedef {Omit<AcornOptions, "sourceType" | "ecmaVersion"> & { sourceType: "module" | "script" | "auto", ecmaVersion?: AcornOptions["ecmaVersion"] }} ParseOptions */

/**
 * 标签信息
 * @typedef {Object} TagInfo
 * @property {any} tag
 * @property {any} data
 * @property {TagInfo | undefined} next
 */

/**
 * 作用域信息
 * @typedef {Object} ScopeInfo
 * @property {StackedMap<string, VariableInfo | ScopeInfo>} definitions
 * @property {boolean | "arrow"} topLevelScope
 * @property {boolean} inShorthand
 * @property {boolean} isStrict
 * @property {boolean} isAsmJs
 * @property {boolean} inTry
 */

/**
 * 操作符分类
 * 1. 算数操作符  + | - | * | / | %
 * 2. 赋值操作符  = | += | -= | *= | /= | %=
 * 3. 比较操作符  == | === | != | !== | > | < | >= | <=
 * 4. 逻辑操作符  && | || | !
 * 5. 位操作符    >> | << | >>> | & | | | ^
 * 6. 条件操作符  ? :
 * 7. 
 * 8.
 * 
 */

/**
 * 表达式 与 语句 定义以及区别:
 * 表达式:
 * 由操作符和操作数组合而成的序列, 它求值出一个值
 * 在JavaScript中,几乎任何可以产生值的代码片段都可以被视为一个表达式
 * 用途:
 * 表达式通常用于赋值、逻辑判断、数学求值等场景
 * 语句:
 * 语句是执行特定任务的代码片段, 它可能包含关键字、变量、操作符、表达式等
 * 用途:
 * 语句用于声明变量、赋值、执行函数、进行条件判断、循环等
 * 
 * 说明:
 * 能直接放到 return 关键字后的 字符串 就是表达式
 */

/**
 * ExpressionType 表达式分类
 * ArrowFunctionExpression 箭头函数表达式(const add = (a, b) => a + b)
 * AssignmentExpression 赋值表达式(非变量声明)(a = a + 5, 而非 let a = 5)
 * AwaitExpression 等待表达式(用于 await 关键字)
 * BinaryExpression 二元表达式(例如 a + b)
 * CallExpression 调用表达式(用于函数调用)
 * ClassExpression 类表达式(用于定义 class)
 * ConditionalExpression 条件表达式(例如: a ? b : c)
 * FunctionExpression 函数表达式(用于定义函数)
 * Identifier 标识符(当表达式中包含变量名 函数名时)
 * LogicalExpression 逻辑表达式(例如 || && !)
 * MemberExpression 成员表达式(例如: obj.property obj[key])
 * NewExpression 新建表达式(用于 new 关键字)
 * ObjectExpression 对象表达式(用于定义字面量对象)
 * SequenceExpression 序列表达式(逗号分隔的表达式列表, (x++, x + 2))
 * SpreadElement 扩展元素(使用到扩展运算符...)
 * TaggedTemplateExpression  标签模板表达式(与模板字符串和函数标签一起使用)
 * TemplateLiteral 模板字面量(用于多行字符串和嵌入表达式 `hello${name}`)
 * ThisExpression this 表达式
 * UnaryExpression 一元表达式(例如: !b)
 * UpdateExpression 更新表达式(例如: a++ --b)
 */

/**
 * 语句分类
 * BlockStatement 块语句(通常用于表示代码块，如函数体或控制流语句的主体)
 * VariableDeclaration 变量声明(声明一个或多个变量)
 * FunctionDeclaration 函数声明(声明一个命名的函数)
 * ReturnStatement 返回语句(用于从函数中返回值)
 * ClassDeclaration：类声明（声明一个命名的类）
 * ExpressionStatement：表达式语句（一个表达式后跟分号，用于执行表达式并忽略其结果）
 * ImportDeclaration：导入声明（用于导入模块中的导出）
 * ExportAllDeclaration：导出全部声明（用于导出另一个模块的所有导出 export * from '...'）
 * ExportDefaultDeclaration：默认导出声明（声明一个默认导出）
 * ExportNamedDeclaration：命名导出声明（声明一个或多个命名导出）
 * IfStatement：条件语句（条件语句）
 * SwitchStatement：分支语句（多分支条件语句）
 * ForInStatement：for-in 语句（用于遍历对象的属性）
 * ForOfStatement：for-of 语句（用于遍历可迭代对象）
 * ForStatement：for 语句（传统的 for 循环）
 * WhileStatement：循环语句（while 循环）
 * DoWhileStatement：做当语句（do-while 循环）
 * ThrowStatement：抛出语句（用于抛出一个错误或异常）
 * TryStatement：尝试语句（用于捕获异常）
 * LabeledStatement：标签语句（给语句一个标签，以便与 break 或 continue 一起使用）
 * WithStatement：with 语句（注意：在现代 JavaScript 中很少使用，并且可能在未来的规范中被移除）
 */

/**
 * evaluate 与 expression 钩子区别
 * 相同:
 * 二者都是针对 表达式
 * 区别:
 * evaluate 钩子针对 表达式类型 进行代码分析
 * expression 钩子则针对与 标识符(变量) 进行代码分析
 */

/**
 * evaluateTypeof 与 typeof 钩子区别:
 * 相同点:
 * 二者都是针对 typeof 标识符进行代码分析
 * 不同点:
 * evaluteTypeof 钩子是针对 typeof 自由变量 表达式进行代码分析
 * typeof 钩子是针对 typeof 标识符 标识符进行代码分析
 */

/**
 * Pattern 与 Identifier 区别
 * Identifier 是 Babel AST 中的一个具体节点类型，用于表示一个标识符，比如变量名、函数名等。
 * 它是一个基本的 AST 节点，用于引用程序中的名称。
 * Pattern 在 Babel 中通常指的是一个可以与某个值进行匹配的模式。
 * 在解构赋值或函数参数等场景中，模式用于描述如何提取或匹配数据的结构。
 * 然而，在 Babel 的 AST 节点类型中，Pattern 并不是一个直接存在的节点类型，而是指像 ObjectPattern、ArrayPattern 等用于模式匹配的节点。
 */

/**
 * 一元表达式(UnaryExpression)
 * "-" | "+" | "!" | "~" | "typeof" | "void" | "delete"
 * 二元表达式(BinaryExpression)
 * "==" | "!=" | "===" | "!==" | "<" | "<=" | 
 * ">" | ">=" | "<<" | ">>" | ">>>" | "+" | 
 * "-" | "*" | "/" | "%" | "|" | "^" | "&" | "in" | "instanceof"
 * 逻辑表达式(LogicalExpression)
 * "||" | "&&" | "??"
 * 条件表达式(ConditionalExpression)
 * ?/:
 * 更新表达式(UpdateExpression)
 *  "++" | "--"
 * 序列表达式(SequenceExpression)
 * 元属性(MetaProperty)
 * import.meta
 */

/**
 * 导入声明(ImportDeclaration):
 * 当语句中包含 import 关键字时
 * 导入标识符(ImportSpecifier):
 * import { foo } from '...'
 * 导入默认标识符(ImportDefaultSpecifier):
 * import foo from '...'
 * 导入命名标识符(ImportNamespaceSpecifier):
 * import * as foo from '...'
 */

/**
 * 导出命名声明(ExportNamedDeclaration):
 * 当
 * 导出标识符(ExportSpecifier):
 * export { name }
 * 导出默认声明(ExportDefaultDeclaration):
 * export default function say() {}
 * 导出全部声明(ExportAllDeclaration):
 * export * from '...'
 */

/**
 * JavascriptParser.hooks 分类
 * 1. 针对与 语句(statement)
 * statement 
 * statementIf
 * preStatement
 * blockPreStatement
 * 
 * 2. 针对于 表达式(expression)
 * expression
 * expressionMemberChain
 * expressionConditionalOperator
 * expressionLogicalOperator
 * 
 * 3. 针对于 表达式求值(evaluate)
 * evaluate  		// 必须返回 BasicEvaluatedExpression 的实例
 * evaluateTypeof
 * evaluateIdentifier
 * evaluateCallExpressionMember
 */

const joinRanges = (startRange, endRange) => {
	if (!endRange) return startRange;
	if (!startRange) return endRange;
	return [startRange[0], endRange[1]];
};

const objectAndMembersToName = (object, membersReversed) => {
	let name = object;
	for (let i = membersReversed.length - 1; i >= 0; i--) {
		name = name + "." + membersReversed[i];
	}
	return name;
};

const getRootName = expression => {
	switch (expression.type) {
		case "Identifier":
			return expression.name;
		case "ThisExpression":
			return "this";
		case "MetaProperty":
			return `${expression.meta.name}.${expression.property.name}`;
		default:
			return undefined;
	}
};

// 默认的 AcornOptions
const defaultParserOptions = {
	ranges: true,
	locations: true,
	ecmaVersion: "latest",
	sourceType: "module",
	onComment: null
};

// regexp to match at least one "magic comment"
const webpackCommentRegExp = new RegExp(/(^|\W)webpack[A-Z]{1,}[A-Za-z]{1,}:/);

const EMPTY_COMMENT_OPTIONS = {
	options: null,
	errors: null
};

// JS类型 语法分析器
// 作用:
// 
class JavascriptParser extends Parser {
	// sourceTyp: module | script | auto
	constructor(sourceType = "auto") {
		super();
		this.hooks = Object.freeze({
			// 当代码片段中有有求值 typeof 自由变量 表达式时
			// 自由变量: 在 A 中作用域要用到的变量 x.并没有在 A 中声明,要到别的作用域中找到他,这个变量 x 就是自由变量
			// 示例: 
			// const val = typeof name => evaluateTypeof.for('name').tap('...')
			evaluateTypeof: new HookMap(() => new SyncBailHook(["expression"])),
			// 当求值 特定表达式类型的表达式 时 必须返回 BasicEvaluatedExpression 的实例
			// 当代码片段中有 以上表达式类型(ExpressionType) 时
			// 示例: 
			// const a = new String('Hello') => evaluate.for('NewExpression').tap('...')
			// const val = name + '...'      => evaluate.for('Identifier').tap('...')
			evaluate: new HookMap(() => new SyncBailHook(["expression"])),
			// 当求值 特定自由变量的表达式 时
			// 当表达式中包含 自由变量 时
			// 示例: 
			// name += 1 => evaluateIdentifier.for('name').tap(...)
			evaluateIdentifier: new HookMap(() => new SyncBailHook(["expression"])),
			// TODO:
			// 当求值 含有特定已经被定义的变量的表达式 时
			// 评估 定义标识符
			// 示例:
			// 
			evaluateDefinedIdentifier: new HookMap(
				() => new SyncBailHook(["expression"])
			),
			// 当求值 特定成员函数调用的表达式 时
			// 示例: 
			// const val = u.vb() => evaluateCallExpressionMember.for('vb').tap('...') 
			evaluateCallExpressionMember: new HookMap(
				() => new SyncBailHook(["expression", "param"])
			),
			// TODO:
			// 
			/** @type {HookMap<SyncBailHook<[ExpressionNode | DeclarationNode | PrivateIdentifierNode, number], boolean | void>>} */
			isPure: new HookMap(
				() => new SyncBailHook(["expression", "commentsStartPosition"])
			),
			// 在预遍历 单个语句前调用该钩子
			// 当该钩子返回 true 时 则跳过当前语句的预遍历
			preStatement: new SyncBailHook(["statement"]),
			// 当块预遍历 单个语句时
			// 当该钩子返回 true 时 则跳过当前语句的遍历
			blockPreStatement: new SyncBailHook(["declaration"]),
			// 当遍历单个语句时
			// 当该钩子返回 非unfefined 时 则跳过当前语句的遍历
			statement: new SyncBailHook(["statement"]),
			// 当遍历 if 语句时
			// 当代码片段中包含 if 语句时
			statementIf: new SyncBailHook(["statement"]),
			// TODO:
			// 当代码片段中包含 clss 表达式时
			// SyncBailHook<[ExpressionNode, ClassExpressionNode | ClassDeclarationNode], boolean | void>
			classExtendsExpression: new SyncBailHook([
				"expression",
				"classDefinition"
			]),
			/** @type {SyncBailHook<[MethodDefinitionNode | PropertyDefinitionNode, ClassExpressionNode | ClassDeclarationNode], boolean | void>} */
			classBodyElement: new SyncBailHook(["element", "classDefinition"]),
			/** @type {SyncBailHook<[ExpressionNode, MethodDefinitionNode | PropertyDefinitionNode, ClassExpressionNode | ClassDeclarationNode], boolean | void>} */
			classBodyValue: new SyncBailHook([
				"expression",
				"element",
				"classDefinition"
			]),
			// 当代码块中含有 label 关键字 时
			// 示例:
			// label 'outter' => hookMap.for('outter').tap('...')
			label: new HookMap(() => new SyncBailHook(["statement"])),
			// 当块预遍历 import 语句时
			// 代码片段中每个包含 静态import 语句时调用
			import: new SyncBailHook(["statement", "source"]),
			// 当块预遍历 import 标识符 语句时
			// 当代码片段中每个 import 语句中包含具体的导入标识符(import specifier) 时调用
			importSpecifier: new SyncBailHook([
				"statement",
				"source",
				"exportName",
				"identifierName"
			]),
			// TODO:
			// 为代码片段中每个 import 语句中导出的函数被调用 时调用
			importCall: new SyncBailHook(["expression"]),
			// 当代码片段中出现 export 语句时调用
			export: new SyncBailHook(["statement"]),
			// 当代码片段中有 export * from '' 语句时
			exportImport: new SyncBailHook(["statement", "source"]),
			// 为代码片段中每个 export 语句(该导出语句导出具体声明)时调用 
			// 示例: export const myName = 'Lee'
			exportDeclaration: new SyncBailHook(["statement", "declaration"]),
			// 为代码片段中每个 export default 语句(该导出语句默认声明)时调用 
			exportExpression: new SyncBailHook(["statement", "declaration"]),
			// 为代码片段中每个 export 语句(该导出语句导出具体声明)时调用 
			exportSpecifier: new SyncBailHook([
				"statement",
				"identifierName",
				"exportName",
				"index"
			]),
			// 
			exportImportSpecifier: new SyncBailHook([
				"statement",
				"source",
				"identifierName",
				"exportName",
				"index"
			]),
			// 预声明
			// 在预遍历 非var 关键字 声明变量前
			// 当该钩子返回 true 时则跳过进入模式
			preDeclarator: new SyncBailHook(["declarator", "statement"]),
			/** @type {SyncBailHook<[VariableDeclaratorNode, StatementNode], boolean | void>} */
			declarator: new SyncBailHook(["declarator", "statement"]),
			// 当分析 变量声明 时
			// 示例: var a = 2 => varDeclaration.for('a').tap(...)
			varDeclaration: new HookMap(() => new SyncBailHook(["declaration"])),
			// 当分析 用 let 关键字声明变量 时
			// 作用: 分析使用 let 关键声明 特定的变量
			// 示例: let name = 'Lee' => varDeclarationLet.for('name').tap(...)
			varDeclarationLet: new HookMap(() => new SyncBailHook(["declaration"])),
			// 当分析 用 const 关键字声明变量 时
			// 作用: 分析使用 const 关键声明 特定的变量
			// 示例: const name = 'Lee' => varDeclarationConst.for('name').tap(...)
			varDeclarationConst: new HookMap(() => new SyncBailHook(["declaration"])),
			// 当分析 使用 var 关键字声明变量 时
			// 作用: 分析使用 var 关键声明 特定的变量
			// var name = 'Lee' => varDeclarationVar.for('name').tap(...)
			varDeclarationVar: new HookMap(() => new SyncBailHook(["declaration"])),
			// TODO:
			// 在进入模式(enterPattern)时调用
			/** @type {HookMap<SyncBailHook<[IdentifierNode], boolean | void>>} */
			pattern: new HookMap(() => new SyncBailHook(["pattern"])),
			// 返回 Boolean 来表示 是否可以重命名自由变量
			// 示例: var a = b => canRename.for('b').tap('...')
			canRename: new HookMap(() => new SyncBailHook(["initExpression"])),
			// 当代码片段中 包含重命名给新的标识符 时
			// 示例: var a = b => rename.for('b').tap('...')
			rename: new HookMap(() => new SyncBailHook(["initExpression"])),
			// 当解析 赋值表达式 时
			// 示例: 
			// a += 2  => assign.for('a').tap('...')
			assign: new HookMap(() => new SyncBailHook(["expression"])),
			/** @type {HookMap<SyncBailHook<[import("estree").AssignmentExpression, string[]], boolean | void>>} */
			assignMemberChain: new HookMap(
				() => new SyncBailHook(["expression", "members"])
			),
			// 当分析 typeof 关键字时
			// 示例: 
			// typeof obj
			typeof: new HookMap(() => new SyncBailHook(["expression"])),
			// 当分析 await 表达式时
			topLevelAwait: new SyncBailHook(["expression"]),
			// 当分析函数调用时(针对于调用的函数名)
			// 示例: 
			// sayHello()  => call.for('sayHello').tap('...')
			call: new HookMap(() => new SyncBailHook(["expression"])),
			// 当代码片段中包含 成员链函数调用 时(针对于函数的调用者)
			// 示例:
			// myObj.anyFunc()  =>  callMemberChain.for('myObj').tap('...')
			callMemberChain: new HookMap(
				() => new SyncBailHook(["expression", "members"])
			),
			// 示例:
			// a.b().c.d
			memberChainOfCallMemberChain: new HookMap(
				() =>
					new SyncBailHook([
						"expression",
						"calleeMembers",
						"callExpression",
						"members"
					])
			),
			// 示例:
			// a.b().c.d()
			callMemberChainOfCallMemberChain: new HookMap(
				() =>
					new SyncBailHook([
						"expression",
						"calleeMembers",
						"innerCallExpression",
						"members"
					])
			),
			/** @type {SyncBailHook<[ChainExpressionNode], boolean | void>} */
			optionalChaining: new SyncBailHook(["optionalChaining"]),
			// 当遇到 new 表达式时
			// 示例: new MyClass()
			new: new HookMap(() => new SyncBailHook(["expression"])),
			// 当分析 含有特定自由变量的表达式 时
			// 示例: vb += '...' => expression.for('vb').tap('...')
			expression: new HookMap(() => new SyncBailHook(["expression"])),
			// 当分析 成员链表达式 时
			// 示例: a.b => expressionMemberChain.for('a').tap('...')
			expressionMemberChain: new HookMap(
				() => new SyncBailHook(["expression", "members"])
			),
			/** @type {HookMap<SyncBailHook<[ExpressionNode, string[]], boolean | void>>} */
			unhandledExpressionMemberChain: new HookMap(
				() => new SyncBailHook(["expression", "members"])
			),
			// 当分析 含有条件操作符的表达式  时
			// 实例: condition1 && condition2 ? a : b
			expressionConditionalOperator: new SyncBailHook(["expression"]),
			// 当分析 含有逻辑操作符(|| | && | !)的表达式  时
			// 示例: vb && ...
			expressionLogicalOperator: new SyncBailHook(["expression"]),
			// 当访问整个 抽象语法树(ast) 时
			// 此时整个 抽象语法树 并未经过 词法、语法分析
			program: new SyncBailHook(["ast", "comments"]),
			// 当访问整个 抽象语法树(ast) 时
			// 此时已经对整个 抽象语法树 经过 词法、语法分析
			finish: new SyncBailHook(["ast", "comments"])
		});
		// 源代码类型
		this.sourceType = sourceType;
		// 作用域
		// ScopeInfo
		this.scope = undefined;
		// 状态
		// ParserState
		this.state = undefined;
		// 注释
		this.comments = undefined;
		// 
		this.semicolons = undefined;
		// 
		/** @type {(StatementNode|ExpressionNode)[]} */
		this.statementPath = undefined;
		// 
		this.prevStatement = undefined;
		// 
		this.currentTagData = undefined;
		// 注册事件
		this._initializeEvaluating();
	}

	// 注册 求值表达式 钩子
	// 作用: 主要是注册 evaluate 相关钩子
	_initializeEvaluating() {
		// 分析 表达式 中的 字面量
		this.hooks.evaluate.for("Literal").tap("JavascriptParser", _expr => {
			const expr = /** @type {LiteralNode} */ (_expr);
			switch (typeof expr.value) {
				case "number":
					return new BasicEvaluatedExpression()
						.setNumber(expr.value)
						.setRange(expr.range);
				case "bigint":
					return new BasicEvaluatedExpression()
						.setBigInt(expr.value)
						.setRange(expr.range);
				case "string":
					return new BasicEvaluatedExpression()
						.setString(expr.value)
						.setRange(expr.range);
				case "boolean":
					return new BasicEvaluatedExpression()
						.setBoolean(expr.value)
						.setRange(expr.range);
			}
			if (expr.value === null) {
				return new BasicEvaluatedExpression().setNull().setRange(expr.range);
			}
			if (expr.value instanceof RegExp) {
				return new BasicEvaluatedExpression()
					.setRegExp(expr.value)
					.setRange(expr.range);
			}
		});
		// 分析 表达式 中的 new表达式
		this.hooks.evaluate.for("NewExpression").tap("JavascriptParser", _expr => {
			const expr = /** @type {NewExpressionNode} */ (_expr);
			const callee = expr.callee;
			if (
				callee.type !== "Identifier" ||
				callee.name !== "RegExp" ||
				expr.arguments.length > 2 ||
				this.getVariableInfo("RegExp") !== "RegExp"
			)
				return;

			let regExp, flags;
			const arg1 = expr.arguments[0];

			if (arg1) {
				if (arg1.type === "SpreadElement") return;

				const evaluatedRegExp = this.evaluateExpression(arg1);

				if (!evaluatedRegExp) return;

				regExp = evaluatedRegExp.asString();

				if (!regExp) return;
			} else {
				return new BasicEvaluatedExpression()
					.setRegExp(new RegExp(""))
					.setRange(expr.range);
			}

			const arg2 = expr.arguments[1];

			if (arg2) {
				if (arg2.type === "SpreadElement") return;

				const evaluatedFlags = this.evaluateExpression(arg2);

				if (!evaluatedFlags) return;

				if (!evaluatedFlags.isUndefined()) {
					flags = evaluatedFlags.asString();

					if (
						flags === undefined ||
						!BasicEvaluatedExpression.isValidRegExpFlags(flags)
					)
						return;
				}
			}

			return new BasicEvaluatedExpression()
				.setRegExp(flags ? new RegExp(regExp, flags) : new RegExp(regExp))
				.setRange(expr.range);
		});
		// 
		this.hooks.evaluate
			.for("LogicalExpression")
			.tap("JavascriptParser", _expr => {
				const expr = /** @type {LogicalExpressionNode} */ (_expr);

				const left = this.evaluateExpression(expr.left);
				if (!left) return;
				if (expr.operator === "&&") {
					const leftAsBool = left.asBool();
					if (leftAsBool === false) return left.setRange(expr.range);
					if (leftAsBool !== true) return;
				} else if (expr.operator === "||") {
					const leftAsBool = left.asBool();
					if (leftAsBool === true) return left.setRange(expr.range);
					if (leftAsBool !== false) return;
				} else if (expr.operator === "??") {
					const leftAsNullish = left.asNullish();
					if (leftAsNullish === false) return left.setRange(expr.range);
					if (leftAsNullish !== true) return;
				} else return;
				const right = this.evaluateExpression(expr.right);
				if (!right) return;
				if (left.couldHaveSideEffects()) right.setSideEffects();
				return right.setRange(expr.range);
			});

		const valueAsExpression = (value, expr, sideEffects) => {
			switch (typeof value) {
				case "boolean":
					return new BasicEvaluatedExpression()
						.setBoolean(value)
						.setSideEffects(sideEffects)
						.setRange(expr.range);
				case "number":
					return new BasicEvaluatedExpression()
						.setNumber(value)
						.setSideEffects(sideEffects)
						.setRange(expr.range);
				case "bigint":
					return new BasicEvaluatedExpression()
						.setBigInt(value)
						.setSideEffects(sideEffects)
						.setRange(expr.range);
				case "string":
					return new BasicEvaluatedExpression()
						.setString(value)
						.setSideEffects(sideEffects)
						.setRange(expr.range);
			}
		};

		this.hooks.evaluate
			.for("BinaryExpression")
			.tap("JavascriptParser", _expr => {
				const expr = /** @type {BinaryExpressionNode} */ (_expr);

				const handleConstOperation = fn => {
					const left = this.evaluateExpression(expr.left);
					if (!left || !left.isCompileTimeValue()) return;

					const right = this.evaluateExpression(expr.right);
					if (!right || !right.isCompileTimeValue()) return;

					const result = fn(
						left.asCompileTimeValue(),
						right.asCompileTimeValue()
					);
					return valueAsExpression(
						result,
						expr,
						left.couldHaveSideEffects() || right.couldHaveSideEffects()
					);
				};

				const isAlwaysDifferent = (a, b) =>
					(a === true && b === false) || (a === false && b === true);

				const handleTemplateStringCompare = (left, right, res, eql) => {
					const getPrefix = parts => {
						let value = "";
						for (const p of parts) {
							const v = p.asString();
							if (v !== undefined) value += v;
							else break;
						}
						return value;
					};
					const getSuffix = parts => {
						let value = "";
						for (let i = parts.length - 1; i >= 0; i--) {
							const v = parts[i].asString();
							if (v !== undefined) value = v + value;
							else break;
						}
						return value;
					};
					const leftPrefix = getPrefix(left.parts);
					const rightPrefix = getPrefix(right.parts);
					const leftSuffix = getSuffix(left.parts);
					const rightSuffix = getSuffix(right.parts);
					const lenPrefix = Math.min(leftPrefix.length, rightPrefix.length);
					const lenSuffix = Math.min(leftSuffix.length, rightSuffix.length);
					if (
						leftPrefix.slice(0, lenPrefix) !==
							rightPrefix.slice(0, lenPrefix) ||
						leftSuffix.slice(-lenSuffix) !== rightSuffix.slice(-lenSuffix)
					) {
						return res
							.setBoolean(!eql)
							.setSideEffects(
								left.couldHaveSideEffects() || right.couldHaveSideEffects()
							);
					}
				};

				const handleStrictEqualityComparison = eql => {
					const left = this.evaluateExpression(expr.left);
					if (!left) return;
					const right = this.evaluateExpression(expr.right);
					if (!right) return;
					const res = new BasicEvaluatedExpression();
					res.setRange(expr.range);

					const leftConst = left.isCompileTimeValue();
					const rightConst = right.isCompileTimeValue();

					if (leftConst && rightConst) {
						return res
							.setBoolean(
								eql ===
									(left.asCompileTimeValue() === right.asCompileTimeValue())
							)
							.setSideEffects(
								left.couldHaveSideEffects() || right.couldHaveSideEffects()
							);
					}

					if (left.isArray() && right.isArray()) {
						return res
							.setBoolean(!eql)
							.setSideEffects(
								left.couldHaveSideEffects() || right.couldHaveSideEffects()
							);
					}
					if (left.isTemplateString() && right.isTemplateString()) {
						return handleTemplateStringCompare(left, right, res, eql);
					}

					const leftPrimitive = left.isPrimitiveType();
					const rightPrimitive = right.isPrimitiveType();

					if (
						// Primitive !== Object or
						// compile-time object types are never equal to something at runtime
						(leftPrimitive === false &&
							(leftConst || rightPrimitive === true)) ||
						(rightPrimitive === false &&
							(rightConst || leftPrimitive === true)) ||
						// Different nullish or boolish status also means not equal
						isAlwaysDifferent(left.asBool(), right.asBool()) ||
						isAlwaysDifferent(left.asNullish(), right.asNullish())
					) {
						return res
							.setBoolean(!eql)
							.setSideEffects(
								left.couldHaveSideEffects() || right.couldHaveSideEffects()
							);
					}
				};

				const handleAbstractEqualityComparison = eql => {
					const left = this.evaluateExpression(expr.left);
					if (!left) return;
					const right = this.evaluateExpression(expr.right);
					if (!right) return;
					const res = new BasicEvaluatedExpression();
					res.setRange(expr.range);

					const leftConst = left.isCompileTimeValue();
					const rightConst = right.isCompileTimeValue();

					if (leftConst && rightConst) {
						return res
							.setBoolean(
								eql ===
									// eslint-disable-next-line eqeqeq
									(left.asCompileTimeValue() == right.asCompileTimeValue())
							)
							.setSideEffects(
								left.couldHaveSideEffects() || right.couldHaveSideEffects()
							);
					}

					if (left.isArray() && right.isArray()) {
						return res
							.setBoolean(!eql)
							.setSideEffects(
								left.couldHaveSideEffects() || right.couldHaveSideEffects()
							);
					}
					if (left.isTemplateString() && right.isTemplateString()) {
						return handleTemplateStringCompare(left, right, res, eql);
					}
				};

				if (expr.operator === "+") {
					const left = this.evaluateExpression(expr.left);
					if (!left) return;
					const right = this.evaluateExpression(expr.right);
					if (!right) return;
					const res = new BasicEvaluatedExpression();
					if (left.isString()) {
						if (right.isString()) {
							res.setString(left.string + right.string);
						} else if (right.isNumber()) {
							res.setString(left.string + right.number);
						} else if (
							right.isWrapped() &&
							right.prefix &&
							right.prefix.isString()
						) {
							// "left" + ("prefix" + inner + "postfix")
							// => ("leftPrefix" + inner + "postfix")
							res.setWrapped(
								new BasicEvaluatedExpression()
									.setString(left.string + right.prefix.string)
									.setRange(joinRanges(left.range, right.prefix.range)),
								right.postfix,
								right.wrappedInnerExpressions
							);
						} else if (right.isWrapped()) {
							// "left" + ([null] + inner + "postfix")
							// => ("left" + inner + "postfix")
							res.setWrapped(
								left,
								right.postfix,
								right.wrappedInnerExpressions
							);
						} else {
							// "left" + expr
							// => ("left" + expr + "")
							res.setWrapped(left, null, [right]);
						}
					} else if (left.isNumber()) {
						if (right.isString()) {
							res.setString(left.number + right.string);
						} else if (right.isNumber()) {
							res.setNumber(left.number + right.number);
						} else {
							return;
						}
					} else if (left.isBigInt()) {
						if (right.isBigInt()) {
							res.setBigInt(left.bigint + right.bigint);
						}
					} else if (left.isWrapped()) {
						if (left.postfix && left.postfix.isString() && right.isString()) {
							// ("prefix" + inner + "postfix") + "right"
							// => ("prefix" + inner + "postfixRight")
							res.setWrapped(
								left.prefix,
								new BasicEvaluatedExpression()
									.setString(left.postfix.string + right.string)
									.setRange(joinRanges(left.postfix.range, right.range)),
								left.wrappedInnerExpressions
							);
						} else if (
							left.postfix &&
							left.postfix.isString() &&
							right.isNumber()
						) {
							// ("prefix" + inner + "postfix") + 123
							// => ("prefix" + inner + "postfix123")
							res.setWrapped(
								left.prefix,
								new BasicEvaluatedExpression()
									.setString(left.postfix.string + right.number)
									.setRange(joinRanges(left.postfix.range, right.range)),
								left.wrappedInnerExpressions
							);
						} else if (right.isString()) {
							// ("prefix" + inner + [null]) + "right"
							// => ("prefix" + inner + "right")
							res.setWrapped(left.prefix, right, left.wrappedInnerExpressions);
						} else if (right.isNumber()) {
							// ("prefix" + inner + [null]) + 123
							// => ("prefix" + inner + "123")
							res.setWrapped(
								left.prefix,
								new BasicEvaluatedExpression()
									.setString(right.number + "")
									.setRange(right.range),
								left.wrappedInnerExpressions
							);
						} else if (right.isWrapped()) {
							// ("prefix1" + inner1 + "postfix1") + ("prefix2" + inner2 + "postfix2")
							// ("prefix1" + inner1 + "postfix1" + "prefix2" + inner2 + "postfix2")
							res.setWrapped(
								left.prefix,
								right.postfix,
								left.wrappedInnerExpressions &&
									right.wrappedInnerExpressions &&
									left.wrappedInnerExpressions
										.concat(left.postfix ? [left.postfix] : [])
										.concat(right.prefix ? [right.prefix] : [])
										.concat(right.wrappedInnerExpressions)
							);
						} else {
							// ("prefix" + inner + postfix) + expr
							// => ("prefix" + inner + postfix + expr + [null])
							res.setWrapped(
								left.prefix,
								null,
								left.wrappedInnerExpressions &&
									left.wrappedInnerExpressions.concat(
										left.postfix ? [left.postfix, right] : [right]
									)
							);
						}
					} else {
						if (right.isString()) {
							// left + "right"
							// => ([null] + left + "right")
							res.setWrapped(null, right, [left]);
						} else if (right.isWrapped()) {
							// left + (prefix + inner + "postfix")
							// => ([null] + left + prefix + inner + "postfix")
							res.setWrapped(
								null,
								right.postfix,
								right.wrappedInnerExpressions &&
									(right.prefix ? [left, right.prefix] : [left]).concat(
										right.wrappedInnerExpressions
									)
							);
						} else {
							return;
						}
					}
					if (left.couldHaveSideEffects() || right.couldHaveSideEffects())
						res.setSideEffects();
					res.setRange(expr.range);
					return res;
				} else if (expr.operator === "-") {
					return handleConstOperation((l, r) => l - r);
				} else if (expr.operator === "*") {
					return handleConstOperation((l, r) => l * r);
				} else if (expr.operator === "/") {
					return handleConstOperation((l, r) => l / r);
				} else if (expr.operator === "**") {
					return handleConstOperation((l, r) => l ** r);
				} else if (expr.operator === "===") {
					return handleStrictEqualityComparison(true);
				} else if (expr.operator === "==") {
					return handleAbstractEqualityComparison(true);
				} else if (expr.operator === "!==") {
					return handleStrictEqualityComparison(false);
				} else if (expr.operator === "!=") {
					return handleAbstractEqualityComparison(false);
				} else if (expr.operator === "&") {
					return handleConstOperation((l, r) => l & r);
				} else if (expr.operator === "|") {
					return handleConstOperation((l, r) => l | r);
				} else if (expr.operator === "^") {
					return handleConstOperation((l, r) => l ^ r);
				} else if (expr.operator === ">>>") {
					return handleConstOperation((l, r) => l >>> r);
				} else if (expr.operator === ">>") {
					return handleConstOperation((l, r) => l >> r);
				} else if (expr.operator === "<<") {
					return handleConstOperation((l, r) => l << r);
				} else if (expr.operator === "<") {
					return handleConstOperation((l, r) => l < r);
				} else if (expr.operator === ">") {
					return handleConstOperation((l, r) => l > r);
				} else if (expr.operator === "<=") {
					return handleConstOperation((l, r) => l <= r);
				} else if (expr.operator === ">=") {
					return handleConstOperation((l, r) => l >= r);
				}
			});
		this.hooks.evaluate
			.for("UnaryExpression")
			.tap("JavascriptParser", _expr => {
				const expr = /** @type {UnaryExpressionNode} */ (_expr);

				const handleConstOperation = fn => {
					const argument = this.evaluateExpression(expr.argument);
					if (!argument || !argument.isCompileTimeValue()) return;
					const result = fn(argument.asCompileTimeValue());
					return valueAsExpression(
						result,
						expr,
						argument.couldHaveSideEffects()
					);
				};

				if (expr.operator === "typeof") {
					switch (expr.argument.type) {
						case "Identifier": {
							const res = this.callHooksForName(
								this.hooks.evaluateTypeof,
								expr.argument.name,
								expr
							);
							if (res !== undefined) return res;
							break;
						}
						case "MetaProperty": {
							const res = this.callHooksForName(
								this.hooks.evaluateTypeof,
								getRootName(expr.argument),
								expr
							);
							if (res !== undefined) return res;
							break;
						}
						case "MemberExpression": {
							const res = this.callHooksForExpression(
								this.hooks.evaluateTypeof,
								expr.argument,
								expr
							);
							if (res !== undefined) return res;
							break;
						}
						case "ChainExpression": {
							const res = this.callHooksForExpression(
								this.hooks.evaluateTypeof,
								expr.argument.expression,
								expr
							);
							if (res !== undefined) return res;
							break;
						}
						case "FunctionExpression": {
							return new BasicEvaluatedExpression()
								.setString("function")
								.setRange(expr.range);
						}
					}
					const arg = this.evaluateExpression(expr.argument);
					if (arg.isUnknown()) return;
					if (arg.isString()) {
						return new BasicEvaluatedExpression()
							.setString("string")
							.setRange(expr.range);
					}
					if (arg.isWrapped()) {
						return new BasicEvaluatedExpression()
							.setString("string")
							.setSideEffects()
							.setRange(expr.range);
					}
					if (arg.isUndefined()) {
						return new BasicEvaluatedExpression()
							.setString("undefined")
							.setRange(expr.range);
					}
					if (arg.isNumber()) {
						return new BasicEvaluatedExpression()
							.setString("number")
							.setRange(expr.range);
					}
					if (arg.isBigInt()) {
						return new BasicEvaluatedExpression()
							.setString("bigint")
							.setRange(expr.range);
					}
					if (arg.isBoolean()) {
						return new BasicEvaluatedExpression()
							.setString("boolean")
							.setRange(expr.range);
					}
					if (arg.isConstArray() || arg.isRegExp() || arg.isNull()) {
						return new BasicEvaluatedExpression()
							.setString("object")
							.setRange(expr.range);
					}
					if (arg.isArray()) {
						return new BasicEvaluatedExpression()
							.setString("object")
							.setSideEffects(arg.couldHaveSideEffects())
							.setRange(expr.range);
					}
				} else if (expr.operator === "!") {
					const argument = this.evaluateExpression(expr.argument);
					if (!argument) return;
					const bool = argument.asBool();
					if (typeof bool !== "boolean") return;
					return new BasicEvaluatedExpression()
						.setBoolean(!bool)
						.setSideEffects(argument.couldHaveSideEffects())
						.setRange(expr.range);
				} else if (expr.operator === "~") {
					return handleConstOperation(v => ~v);
				} else if (expr.operator === "+") {
					return handleConstOperation(v => +v);
				} else if (expr.operator === "-") {
					return handleConstOperation(v => -v);
				}
			});
		this.hooks.evaluateTypeof.for("undefined").tap("JavascriptParser", expr => {
			return new BasicEvaluatedExpression()
				.setString("undefined")
				.setRange(expr.range);
		});
		/**
		 * @param {string} exprType expression type name
		 * @param {function(ExpressionNode): GetInfoResult | undefined} getInfo get info
		 * @returns {void}
		 */
		const tapEvaluateWithVariableInfo = (exprType, getInfo) => {
			/** @type {ExpressionNode | undefined} */
			let cachedExpression = undefined;
			/** @type {GetInfoResult | undefined} */
			let cachedInfo = undefined;
			this.hooks.evaluate.for(exprType).tap("JavascriptParser", expr => {
				const expression = /** @type {MemberExpressionNode} */ (expr);

				const info = getInfo(expr);
				if (info !== undefined) {
					return this.callHooksForInfoWithFallback(
						this.hooks.evaluateIdentifier,
						info.name,
						name => {
							cachedExpression = expression;
							cachedInfo = info;
						},
						name => {
							const hook = this.hooks.evaluateDefinedIdentifier.get(name);
							if (hook !== undefined) {
								return hook.call(expression);
							}
						},
						expression
					);
				}
			});
			this.hooks.evaluate
				.for(exprType)
				.tap({ name: "JavascriptParser", stage: 100 }, expr => {
					const info = cachedExpression === expr ? cachedInfo : getInfo(expr);
					if (info !== undefined) {
						return new BasicEvaluatedExpression()
							.setIdentifier(info.name, info.rootInfo, info.getMembers)
							.setRange(expr.range);
					}
				});
			this.hooks.finish.tap("JavascriptParser", () => {
				// Cleanup for GC
				cachedExpression = cachedInfo = undefined;
			});
		};
		tapEvaluateWithVariableInfo("Identifier", expr => {
			const info = this.getVariableInfo(
				/** @type {IdentifierNode} */ (expr).name
			);
			if (
				typeof info === "string" ||
				(info instanceof VariableInfo && typeof info.freeName === "string")
			) {
				return { name: info, rootInfo: info, getMembers: () => [] };
			}
		});
		tapEvaluateWithVariableInfo("ThisExpression", expr => {
			const info = this.getVariableInfo("this");
			if (
				typeof info === "string" ||
				(info instanceof VariableInfo && typeof info.freeName === "string")
			) {
				return { name: info, rootInfo: info, getMembers: () => [] };
			}
		});
		this.hooks.evaluate.for("MetaProperty").tap("JavascriptParser", expr => {
			const metaProperty = /** @type {MetaPropertyNode} */ (expr);

			return this.callHooksForName(
				this.hooks.evaluateIdentifier,
				getRootName(expr),
				metaProperty
			);
		});
		tapEvaluateWithVariableInfo("MemberExpression", expr =>
			this.getMemberExpressionInfo(
				/** @type {MemberExpressionNode} */ (expr),
				ALLOWED_MEMBER_TYPES_EXPRESSION
			)
		);

		this.hooks.evaluate.for("CallExpression").tap("JavascriptParser", _expr => {
			const expr = /** @type {CallExpressionNode} */ (_expr);
			if (
				expr.callee.type !== "MemberExpression" ||
				expr.callee.property.type !==
					(expr.callee.computed ? "Literal" : "Identifier")
			) {
				return;
			}

			// type Super also possible here
			const param = this.evaluateExpression(
				/** @type {ExpressionNode} */ (expr.callee.object)
			);
			if (!param) return;
			const property =
				expr.callee.property.type === "Literal"
					? `${expr.callee.property.value}`
					: expr.callee.property.name;
			const hook = this.hooks.evaluateCallExpressionMember.get(property);
			if (hook !== undefined) {
				return hook.call(expr, param);
			}
		});
		this.hooks.evaluateCallExpressionMember
			.for("indexOf")
			.tap("JavascriptParser", (expr, param) => {
				if (!param.isString()) return;
				if (expr.arguments.length === 0) return;
				const [arg1, arg2] = expr.arguments;
				if (arg1.type === "SpreadElement") return;
				const arg1Eval = this.evaluateExpression(arg1);
				if (!arg1Eval.isString()) return;
				const arg1Value = arg1Eval.string;

				let result;
				if (arg2) {
					if (arg2.type === "SpreadElement") return;
					const arg2Eval = this.evaluateExpression(arg2);
					if (!arg2Eval.isNumber()) return;
					result = param.string.indexOf(arg1Value, arg2Eval.number);
				} else {
					result = param.string.indexOf(arg1Value);
				}
				return new BasicEvaluatedExpression()
					.setNumber(result)
					.setSideEffects(param.couldHaveSideEffects())
					.setRange(expr.range);
			});
		this.hooks.evaluateCallExpressionMember
			.for("replace")
			.tap("JavascriptParser", (expr, param) => {
				if (!param.isString()) return;
				if (expr.arguments.length !== 2) return;
				if (expr.arguments[0].type === "SpreadElement") return;
				if (expr.arguments[1].type === "SpreadElement") return;
				let arg1 = this.evaluateExpression(expr.arguments[0]);
				let arg2 = this.evaluateExpression(expr.arguments[1]);
				if (!arg1.isString() && !arg1.isRegExp()) return;
				const arg1Value = arg1.regExp || arg1.string;
				if (!arg2.isString()) return;
				const arg2Value = arg2.string;
				return new BasicEvaluatedExpression()
					.setString(param.string.replace(arg1Value, arg2Value))
					.setSideEffects(param.couldHaveSideEffects())
					.setRange(expr.range);
			});
		["substr", "substring", "slice"].forEach(fn => {
			this.hooks.evaluateCallExpressionMember
				.for(fn)
				.tap("JavascriptParser", (expr, param) => {
					if (!param.isString()) return;
					let arg1;
					let result,
						str = param.string;
					switch (expr.arguments.length) {
						case 1:
							if (expr.arguments[0].type === "SpreadElement") return;
							arg1 = this.evaluateExpression(expr.arguments[0]);
							if (!arg1.isNumber()) return;
							result = str[fn](arg1.number);
							break;
						case 2: {
							if (expr.arguments[0].type === "SpreadElement") return;
							if (expr.arguments[1].type === "SpreadElement") return;
							arg1 = this.evaluateExpression(expr.arguments[0]);
							const arg2 = this.evaluateExpression(expr.arguments[1]);
							if (!arg1.isNumber()) return;
							if (!arg2.isNumber()) return;
							result = str[fn](arg1.number, arg2.number);
							break;
						}
						default:
							return;
					}
					return new BasicEvaluatedExpression()
						.setString(result)
						.setSideEffects(param.couldHaveSideEffects())
						.setRange(expr.range);
				});
		});

		/**
		 * @param {"cooked" | "raw"} kind kind of values to get
		 * @param {TemplateLiteralNode} templateLiteralExpr TemplateLiteral expr
		 * @returns {{quasis: BasicEvaluatedExpression[], parts: BasicEvaluatedExpression[]}} Simplified template
		 */
		const getSimplifiedTemplateResult = (kind, templateLiteralExpr) => {
			/** @type {BasicEvaluatedExpression[]} */
			const quasis = [];
			/** @type {BasicEvaluatedExpression[]} */
			const parts = [];

			for (let i = 0; i < templateLiteralExpr.quasis.length; i++) {
				const quasiExpr = templateLiteralExpr.quasis[i];
				const quasi = quasiExpr.value[kind];

				if (i > 0) {
					const prevExpr = parts[parts.length - 1];
					const expr = this.evaluateExpression(
						templateLiteralExpr.expressions[i - 1]
					);
					const exprAsString = expr.asString();
					if (
						typeof exprAsString === "string" &&
						!expr.couldHaveSideEffects()
					) {
						// We can merge quasi + expr + quasi when expr
						// is a const string

						prevExpr.setString(prevExpr.string + exprAsString + quasi);
						prevExpr.setRange([prevExpr.range[0], quasiExpr.range[1]]);
						// We unset the expression as it doesn't match to a single expression
						prevExpr.setExpression(undefined);
						continue;
					}
					parts.push(expr);
				}

				const part = new BasicEvaluatedExpression()
					.setString(quasi)
					.setRange(quasiExpr.range)
					.setExpression(quasiExpr);
				quasis.push(part);
				parts.push(part);
			}
			return {
				quasis,
				parts
			};
		};

		this.hooks.evaluate
			.for("TemplateLiteral")
			.tap("JavascriptParser", _node => {
				const node = /** @type {TemplateLiteralNode} */ (_node);

				const { quasis, parts } = getSimplifiedTemplateResult("cooked", node);
				if (parts.length === 1) {
					return parts[0].setRange(node.range);
				}
				return new BasicEvaluatedExpression()
					.setTemplateString(quasis, parts, "cooked")
					.setRange(node.range);
			});
		this.hooks.evaluate
			.for("TaggedTemplateExpression")
			.tap("JavascriptParser", _node => {
				const node = /** @type {TaggedTemplateExpressionNode} */ (_node);
				const tag = this.evaluateExpression(node.tag);

				if (tag.isIdentifier() && tag.identifier !== "String.raw") return;
				const { quasis, parts } = getSimplifiedTemplateResult(
					"raw",
					node.quasi
				);
				return new BasicEvaluatedExpression()
					.setTemplateString(quasis, parts, "raw")
					.setRange(node.range);
			});

		this.hooks.evaluateCallExpressionMember
			.for("concat")
			.tap("JavascriptParser", (expr, param) => {
				if (!param.isString() && !param.isWrapped()) return;

				let stringSuffix = null;
				let hasUnknownParams = false;
				const innerExpressions = [];
				for (let i = expr.arguments.length - 1; i >= 0; i--) {
					const arg = expr.arguments[i];
					if (arg.type === "SpreadElement") return;
					const argExpr = this.evaluateExpression(arg);
					if (
						hasUnknownParams ||
						(!argExpr.isString() && !argExpr.isNumber())
					) {
						hasUnknownParams = true;
						innerExpressions.push(argExpr);
						continue;
					}

					const value = argExpr.isString()
						? argExpr.string
						: "" + argExpr.number;

					const newString = value + (stringSuffix ? stringSuffix.string : "");
					const newRange = [
						argExpr.range[0],
						(stringSuffix || argExpr).range[1]
					];
					stringSuffix = new BasicEvaluatedExpression()
						.setString(newString)
						.setSideEffects(
							(stringSuffix && stringSuffix.couldHaveSideEffects()) ||
								argExpr.couldHaveSideEffects()
						)
						.setRange(newRange);
				}

				if (hasUnknownParams) {
					const prefix = param.isString() ? param : param.prefix;
					const inner =
						param.isWrapped() && param.wrappedInnerExpressions
							? param.wrappedInnerExpressions.concat(innerExpressions.reverse())
							: innerExpressions.reverse();
					return new BasicEvaluatedExpression()
						.setWrapped(prefix, stringSuffix, inner)
						.setRange(expr.range);
				} else if (param.isWrapped()) {
					const postfix = stringSuffix || param.postfix;
					const inner = param.wrappedInnerExpressions
						? param.wrappedInnerExpressions.concat(innerExpressions.reverse())
						: innerExpressions.reverse();
					return new BasicEvaluatedExpression()
						.setWrapped(param.prefix, postfix, inner)
						.setRange(expr.range);
				} else {
					const newString =
						param.string + (stringSuffix ? stringSuffix.string : "");
					return new BasicEvaluatedExpression()
						.setString(newString)
						.setSideEffects(
							(stringSuffix && stringSuffix.couldHaveSideEffects()) ||
								param.couldHaveSideEffects()
						)
						.setRange(expr.range);
				}
			});
		this.hooks.evaluateCallExpressionMember
			.for("split")
			.tap("JavascriptParser", (expr, param) => {
				if (!param.isString()) return;
				if (expr.arguments.length !== 1) return;
				if (expr.arguments[0].type === "SpreadElement") return;
				let result;
				const arg = this.evaluateExpression(expr.arguments[0]);
				if (arg.isString()) {
					result = param.string.split(arg.string);
				} else if (arg.isRegExp()) {
					result = param.string.split(arg.regExp);
				} else {
					return;
				}
				return new BasicEvaluatedExpression()
					.setArray(result)
					.setSideEffects(param.couldHaveSideEffects())
					.setRange(expr.range);
			});
		this.hooks.evaluate
			.for("ConditionalExpression")
			.tap("JavascriptParser", _expr => {
				const expr = /** @type {ConditionalExpressionNode} */ (_expr);

				const condition = this.evaluateExpression(expr.test);
				const conditionValue = condition.asBool();
				let res;
				if (conditionValue === undefined) {
					const consequent = this.evaluateExpression(expr.consequent);
					const alternate = this.evaluateExpression(expr.alternate);
					if (!consequent || !alternate) return;
					res = new BasicEvaluatedExpression();
					if (consequent.isConditional()) {
						res.setOptions(consequent.options);
					} else {
						res.setOptions([consequent]);
					}
					if (alternate.isConditional()) {
						res.addOptions(alternate.options);
					} else {
						res.addOptions([alternate]);
					}
				} else {
					res = this.evaluateExpression(
						conditionValue ? expr.consequent : expr.alternate
					);
					if (condition.couldHaveSideEffects()) res.setSideEffects();
				}
				res.setRange(expr.range);
				return res;
			});
		this.hooks.evaluate
			.for("ArrayExpression")
			.tap("JavascriptParser", _expr => {
				const expr = /** @type {ArrayExpressionNode} */ (_expr);

				const items = expr.elements.map(element => {
					return (
						element !== null &&
						element.type !== "SpreadElement" &&
						this.evaluateExpression(element)
					);
				});
				if (!items.every(Boolean)) return;
				return new BasicEvaluatedExpression()
					.setItems(items)
					.setRange(expr.range);
			});
		this.hooks.evaluate
			.for("ChainExpression")
			.tap("JavascriptParser", _expr => {
				const expr = /** @type {ChainExpressionNode} */ (_expr);
				/** @type {ExpressionNode[]} */
				const optionalExpressionsStack = [];
				/** @type {ExpressionNode|SuperNode} */
				let next = expr.expression;

				while (
					next.type === "MemberExpression" ||
					next.type === "CallExpression"
				) {
					if (next.type === "MemberExpression") {
						if (next.optional) {
							// SuperNode can not be optional
							optionalExpressionsStack.push(
								/** @type {ExpressionNode} */ (next.object)
							);
						}
						next = next.object;
					} else {
						if (next.optional) {
							// SuperNode can not be optional
							optionalExpressionsStack.push(
								/** @type {ExpressionNode} */ (next.callee)
							);
						}
						next = next.callee;
					}
				}

				while (optionalExpressionsStack.length > 0) {
					const expression = optionalExpressionsStack.pop();
					const evaluated = this.evaluateExpression(expression);

					if (evaluated && evaluated.asNullish()) {
						return evaluated.setRange(_expr.range);
					}
				}
				return this.evaluateExpression(expr.expression);
			});
	}

	// 返回 表达式 更名后的标识符
	getRenameIdentifier(expr) {
		const result = this.evaluateExpression(expr);
		if (result && result.isIdentifier()) {
			return result.identifier;
		}
	}

	// 遍历 类语句 或者 类表达式
	walkClass(classy) {
		if (classy.superClass) {
			if (!this.hooks.classExtendsExpression.call(classy.superClass, classy)) {
				this.walkExpression(classy.superClass);
			}
		}
		if (classy.body && classy.body.type === "ClassBody") {
			for (const classElement of /** @type {TODO} */ (classy.body.body)) {
				if (!this.hooks.classBodyElement.call(classElement, classy)) {
					if (classElement.computed && classElement.key) {
						this.walkExpression(classElement.key);
					}
					if (classElement.value) {
						if (
							!this.hooks.classBodyValue.call(
								classElement.value,
								classElement,
								classy
							)
						) {
							const wasTopLevel = this.scope.topLevelScope;
							this.scope.topLevelScope = false;
							this.walkExpression(classElement.value);
							this.scope.topLevelScope = wasTopLevel;
						}
					}
				}
			}
		}
	}

	// 预遍历 所有的语句
	// 作用: 为所有的 变量声明 设置 作用域
	preWalkStatements(statements) {
		for (let index = 0, len = statements.length; index < len; index++) {
			const statement = statements[index];
			this.preWalkStatement(statement);
		}
	}

	// 块预遍历 所有的语句
	// 作用: 为import export class const let 声明的变量 设置作用域
	// 主要是 为 具有块作用域 的关键字 声明的变量 设置作用域
	blockPreWalkStatements(statements) {
		for (let index = 0, len = statements.length; index < len; index++) {
			const statement = statements[index];
			this.blockPreWalkStatement(statement);
		}
	}

	// 遍历 所有的语句 
	// 作用: 遍历所有的语句和表达式 并加工处理
	walkStatements(statements) {
		for (let index = 0, len = statements.length; index < len; index++) {
			const statement = statements[index];
			this.walkStatement(statement);
		}
	}

	// 预遍历 单个语句
	preWalkStatement(statement) {
		this.statementPath.push(statement);
		if (this.hooks.preStatement.call(statement)) {
			this.prevStatement = this.statementPath.pop();
			return;
		}
		switch (statement.type) {
			case "BlockStatement":
				this.preWalkBlockStatement(statement);
				break;
			case "DoWhileStatement":
				this.preWalkDoWhileStatement(statement);
				break;
			case "ForInStatement":
				this.preWalkForInStatement(statement);
				break;
			case "ForOfStatement":
				this.preWalkForOfStatement(statement);
				break;
			case "ForStatement":
				this.preWalkForStatement(statement);
				break;
			case "FunctionDeclaration":
				this.preWalkFunctionDeclaration(statement);
				break;
			case "IfStatement":
				this.preWalkIfStatement(statement);
				break;
			case "LabeledStatement":
				this.preWalkLabeledStatement(statement);
				break;
			case "SwitchStatement":
				this.preWalkSwitchStatement(statement);
				break;
			case "TryStatement":
				this.preWalkTryStatement(statement);
				break;
			case "VariableDeclaration":
				this.preWalkVariableDeclaration(statement);
				break;
			case "WhileStatement":
				this.preWalkWhileStatement(statement);
				break;
			case "WithStatement":
				this.preWalkWithStatement(statement);
				break;
		}
		this.prevStatement = this.statementPath.pop();
	}

	// 块预遍历 单个语句
	blockPreWalkStatement(statement) {
		this.statementPath.push(statement);
		if (this.hooks.blockPreStatement.call(statement)) {
			this.prevStatement = this.statementPath.pop();
			return;
		}
		switch (statement.type) {
			case "ImportDeclaration":
				this.blockPreWalkImportDeclaration(statement);
				break;
			case "ExportAllDeclaration":
				this.blockPreWalkExportAllDeclaration(statement);
				break;
			case "ExportDefaultDeclaration":
				this.blockPreWalkExportDefaultDeclaration(statement);
				break;
			case "ExportNamedDeclaration":
				this.blockPreWalkExportNamedDeclaration(statement);
				break;
			case "VariableDeclaration":
				this.blockPreWalkVariableDeclaration(statement);
				break;
			case "ClassDeclaration":
				this.blockPreWalkClassDeclaration(statement);
				break;
		}
		this.prevStatement = this.statementPath.pop();
	}

	// 遍历 单个语句
	walkStatement(statement) {
		this.statementPath.push(statement);
		if (this.hooks.statement.call(statement) !== undefined) {
			this.prevStatement = this.statementPath.pop();
			return;
		}
		switch (statement.type) {
			case "BlockStatement":
				this.walkBlockStatement(statement);
				break;
			case "ClassDeclaration":
				this.walkClassDeclaration(statement);
				break;
			case "DoWhileStatement":
				this.walkDoWhileStatement(statement);
				break;
			case "ExportDefaultDeclaration":
				this.walkExportDefaultDeclaration(statement);
				break;
			case "ExportNamedDeclaration":
				this.walkExportNamedDeclaration(statement);
				break;
			case "ExpressionStatement":
				this.walkExpressionStatement(statement);
				break;
			case "ForInStatement":
				this.walkForInStatement(statement);
				break;
			case "ForOfStatement":
				this.walkForOfStatement(statement);
				break;
			case "ForStatement":
				this.walkForStatement(statement);
				break;
			case "FunctionDeclaration":
				this.walkFunctionDeclaration(statement);
				break;
			case "IfStatement":
				this.walkIfStatement(statement);
				break;
			case "LabeledStatement":
				this.walkLabeledStatement(statement);
				break;
			case "ReturnStatement":
				this.walkReturnStatement(statement);
				break;
			case "SwitchStatement":
				this.walkSwitchStatement(statement);
				break;
			case "ThrowStatement":
				this.walkThrowStatement(statement);
				break;
			case "TryStatement":
				this.walkTryStatement(statement);
				break;
			case "VariableDeclaration":
				this.walkVariableDeclaration(statement);
				break;
			case "WhileStatement":
				this.walkWhileStatement(statement);
				break;
			case "WithStatement":
				this.walkWithStatement(statement);
				break;
		}
		this.prevStatement = this.statementPath.pop();
	}

	// 遍历 嵌套的语句
	walkNestedStatement(statement) {
		this.prevStatement = undefined;
		this.walkStatement(statement);
	}

	// 预遍历 块语句
	// 递归预遍历statement.body
	preWalkBlockStatement(statement) {
		this.preWalkStatements(statement.body);
	}

	// 遍历 块语句
	walkBlockStatement(statement) {
		this.inBlockScope(() => {
			const body = statement.body;
			const prev = this.prevStatement;
			this.blockPreWalkStatements(body);
			this.prevStatement = prev;
			this.walkStatements(body);
		});
	}

	// 遍历 表达式语句
	walkExpressionStatement(statement) {
		this.walkExpression(statement.expression);
	}

	// 预遍历 If语句
	preWalkIfStatement(statement) {
		this.preWalkStatement(statement.consequent);
		// 预分析 else-if 或者 else 语句
		if (statement.alternate) {
			this.preWalkStatement(statement.alternate);
		}
	}

	// 遍历 If语句
	walkIfStatement(statement) {
		const result = this.hooks.statementIf.call(statement);
		if (result === undefined) {
			this.walkExpression(statement.test);
			this.walkNestedStatement(statement.consequent);
			if (statement.alternate) {
				this.walkNestedStatement(statement.alternate);
			}
		} else {
			if (result) {
				this.walkNestedStatement(statement.consequent);
			} else if (statement.alternate) {
				this.walkNestedStatement(statement.alternate);
			}
		}
	}

	// 预遍历 Label语句
	preWalkLabeledStatement(statement) {
		this.preWalkStatement(statement.body);
	}

	// 遍历 Label语句
	walkLabeledStatement(statement) {
		const hook = this.hooks.label.get(statement.label.name);
		if (hook !== undefined) {
			const result = hook.call(statement);
			if (result === true) return;
		}
		this.walkNestedStatement(statement.body);
	}

	// 预遍历 With语句
	preWalkWithStatement(statement) {
		this.preWalkStatement(statement.body);
	}

	// 遍历 With语句
	walkWithStatement(statement) {
		this.walkExpression(statement.object);
		this.walkNestedStatement(statement.body);
	}

	// 预遍历 Switch语句
	preWalkSwitchStatement(statement) {
		this.preWalkSwitchCases(statement.cases);
	}

	// 遍历 Switch语句
	walkSwitchStatement(statement) {
		this.walkExpression(statement.discriminant);
		this.walkSwitchCases(statement.cases);
	}

	walkTerminatingStatement(statement) {
		if (statement.argument) this.walkExpression(statement.argument);
	}

	// 遍历 Return语句
	walkReturnStatement(statement) {
		this.walkTerminatingStatement(statement);
	}

	// 遍历 Throw语句
	walkThrowStatement(statement) {
		this.walkTerminatingStatement(statement);
	}

	// 预遍历 Try语句
	preWalkTryStatement(statement) {
		this.preWalkStatement(statement.block);
		if (statement.handler) this.preWalkCatchClause(statement.handler);
		if (statement.finializer) this.preWalkStatement(statement.finializer);
	}

	// 遍历 Try语句
	walkTryStatement(statement) {
		if (this.scope.inTry) {
			this.walkStatement(statement.block);
		} else {
			this.scope.inTry = true;
			this.walkStatement(statement.block);
			this.scope.inTry = false;
		}
		if (statement.handler) this.walkCatchClause(statement.handler);
		if (statement.finalizer) this.walkStatement(statement.finalizer);
	}

	// 预遍历 While语句
	preWalkWhileStatement(statement) {
		this.preWalkStatement(statement.body);
	}

	// 遍历 While语句
	walkWhileStatement(statement) {
		this.walkExpression(statement.test);
		this.walkNestedStatement(statement.body);
	}

	// 预遍历 DoWhile语句
	// 递归预遍历statement.body
	preWalkDoWhileStatement(statement) {
		this.preWalkStatement(statement.body);
	}

	// 遍历 DoWhile语句
	walkDoWhileStatement(statement) {
		this.walkNestedStatement(statement.body);
		this.walkExpression(statement.test);
	}

	// 预遍历 For语句
	preWalkForStatement(statement) {
		if (statement.init) {
			if (statement.init.type === "VariableDeclaration") {
				this.preWalkStatement(statement.init);
			}
		}
		this.preWalkStatement(statement.body);
	}

	// 遍历 For语句
	walkForStatement(statement) {
		this.inBlockScope(() => {
			if (statement.init) {
				if (statement.init.type === "VariableDeclaration") {
					this.blockPreWalkVariableDeclaration(statement.init);
					this.prevStatement = undefined;
					this.walkStatement(statement.init);
				} else {
					this.walkExpression(statement.init);
				}
			}
			if (statement.test) {
				this.walkExpression(statement.test);
			}
			if (statement.update) {
				this.walkExpression(statement.update);
			}
			const body = statement.body;
			if (body.type === "BlockStatement") {
				// no need to add additional scope
				const prev = this.prevStatement;
				this.blockPreWalkStatements(body.body);
				this.prevStatement = prev;
				this.walkStatements(body.body);
			} else {
				this.walkNestedStatement(body);
			}
		});
	}

	// 预遍历 ForIn语句
	preWalkForInStatement(statement) {
		if (statement.left.type === "VariableDeclaration") {
			this.preWalkVariableDeclaration(statement.left);
		}
		this.preWalkStatement(statement.body);
	}

	// 遍历 ForIn语句
	walkForInStatement(statement) {
		this.inBlockScope(() => {
			if (statement.left.type === "VariableDeclaration") {
				this.blockPreWalkVariableDeclaration(statement.left);
				this.walkVariableDeclaration(statement.left);
			} else {
				this.walkPattern(statement.left);
			}
			this.walkExpression(statement.right);
			const body = statement.body;
			if (body.type === "BlockStatement") {
				// no need to add additional scope
				const prev = this.prevStatement;
				this.blockPreWalkStatements(body.body);
				this.prevStatement = prev;
				this.walkStatements(body.body);
			} else {
				this.walkNestedStatement(body);
			}
		});
	}

	// 预遍历 ForOf语句
	preWalkForOfStatement(statement) {
		// ForOf 语句中有 await 关键字
		// 示例: for await(let i of arr) {}
		if (statement.await && this.scope.topLevelScope === true) {
			this.hooks.topLevelAwait.call(statement);
		}
		if (statement.left.type === "VariableDeclaration") {
			this.preWalkVariableDeclaration(statement.left);
		}
		this.preWalkStatement(statement.body);
	}

	// 遍历 ForOf语句
	walkForOfStatement(statement) {
		this.inBlockScope(() => {
			if (statement.left.type === "VariableDeclaration") {
				this.blockPreWalkVariableDeclaration(statement.left);
				this.walkVariableDeclaration(statement.left);
			} else {
				this.walkPattern(statement.left);
			}
			this.walkExpression(statement.right);
			const body = statement.body;
			if (body.type === "BlockStatement") {
				// no need to add additional scope
				const prev = this.prevStatement;
				this.blockPreWalkStatements(body.body);
				this.prevStatement = prev;
				this.walkStatements(body.body);
			} else {
				this.walkNestedStatement(body);
			}
		});
	}

	// 预遍历 函数声明语句
	preWalkFunctionDeclaration(statement) {
		if (statement.id) {
			this.defineVariable(statement.id.name);
		}
	}

	// 遍历 函数声明语句
	walkFunctionDeclaration(statement) {
		const wasTopLevel = this.scope.topLevelScope;
		this.scope.topLevelScope = false;
		this.inFunctionScope(true, statement.params, () => {
			for (const param of statement.params) {
				this.walkPattern(param);
			}
			if (statement.body.type === "BlockStatement") {
				this.detectMode(statement.body.body);
				const prev = this.prevStatement;
				this.preWalkStatement(statement.body);
				this.prevStatement = prev;
				this.walkStatement(statement.body);
			} else {
				this.walkExpression(statement.body);
			}
		});
		this.scope.topLevelScope = wasTopLevel;
	}

	// 块预遍历 导入声明语句
	blockPreWalkImportDeclaration(statement) {
		const source = statement.source.value;
		this.hooks.import.call(statement, source);
		for (const specifier of statement.specifiers) {
			const name = specifier.local.name;
			switch (specifier.type) {
				case "ImportDefaultSpecifier":
					if (
						!this.hooks.importSpecifier.call(statement, source, "default", name)
					) {
						this.defineVariable(name);
					}
					break;
				case "ImportSpecifier":
					if (
						!this.hooks.importSpecifier.call(
							statement,
							source,
							specifier.imported.name,
							name
						)
					) {
						this.defineVariable(name);
					}
					break;
				case "ImportNamespaceSpecifier":
					if (!this.hooks.importSpecifier.call(statement, source, null, name)) {
						this.defineVariable(name);
					}
					break;
				default:
					this.defineVariable(name);
			}
		}
	}

	enterDeclaration(declaration, onIdent) {
		switch (declaration.type) {
			case "VariableDeclaration":
				for (const declarator of declaration.declarations) {
					switch (declarator.type) {
						case "VariableDeclarator": {
							this.enterPattern(declarator.id, onIdent);
							break;
						}
					}
				}
				break;
			case "FunctionDeclaration":
				this.enterPattern(declaration.id, onIdent);
				break;
			case "ClassDeclaration":
				this.enterPattern(declaration.id, onIdent);
				break;
		}
	}

	// 块预遍历 导出命名声明
	blockPreWalkExportNamedDeclaration(statement) {
		let source;
		if (statement.source) {
			source = statement.source.value;
			this.hooks.exportImport.call(statement, source);
		} else {
			this.hooks.export.call(statement);
		}
		if (statement.declaration) {
			if (
				!this.hooks.exportDeclaration.call(statement, statement.declaration)
			) {
				const prev = this.prevStatement;
				this.preWalkStatement(statement.declaration);
				this.prevStatement = prev;
				this.blockPreWalkStatement(statement.declaration);
				let index = 0;
				this.enterDeclaration(statement.declaration, def => {
					this.hooks.exportSpecifier.call(statement, def, def, index++);
				});
			}
		}
		if (statement.specifiers) {
			for (
				let specifierIndex = 0;
				specifierIndex < statement.specifiers.length;
				specifierIndex++
			) {
				const specifier = statement.specifiers[specifierIndex];
				switch (specifier.type) {
					case "ExportSpecifier": {
						const name = specifier.exported.name;
						if (source) {
							this.hooks.exportImportSpecifier.call(
								statement,
								source,
								specifier.local.name,
								name,
								specifierIndex
							);
						} else {
							this.hooks.exportSpecifier.call(
								statement,
								specifier.local.name,
								name,
								specifierIndex
							);
						}
						break;
					}
				}
			}
		}
	}

	// 遍历 导出命名语句
	walkExportNamedDeclaration(statement) {
		if (statement.declaration) {
			this.walkStatement(statement.declaration);
		}
	}

	// 块预遍历 导出默认声明
	blockPreWalkExportDefaultDeclaration(statement) {
		const prev = this.prevStatement;
		this.preWalkStatement(statement.declaration);
		this.prevStatement = prev;
		this.blockPreWalkStatement(statement.declaration);
		if (
			statement.declaration.id &&
			statement.declaration.type !== "FunctionExpression" &&
			statement.declaration.type !== "ClassExpression"
		) {
			this.hooks.exportSpecifier.call(
				statement,
				statement.declaration.id.name,
				"default",
				undefined
			);
		}
	}

	// 遍历 导出默认值语句
	walkExportDefaultDeclaration(statement) {
		this.hooks.export.call(statement);
		if (
			statement.declaration.id &&
			statement.declaration.type !== "FunctionExpression" &&
			statement.declaration.type !== "ClassExpression"
		) {
			if (
				!this.hooks.exportDeclaration.call(statement, statement.declaration)
			) {
				this.walkStatement(statement.declaration);
			}
		} else {
			// Acorn parses `export default function() {}` as `FunctionDeclaration` and
			// `export default class {}` as `ClassDeclaration`, both with `id = null`.
			// These nodes must be treated as expressions.
			if (
				statement.declaration.type === "FunctionDeclaration" ||
				statement.declaration.type === "ClassDeclaration"
			) {
				this.walkStatement(statement.declaration);
			} else {
				this.walkExpression(statement.declaration);
			}
			if (!this.hooks.exportExpression.call(statement, statement.declaration)) {
				this.hooks.exportSpecifier.call(
					statement,
					statement.declaration,
					"default",
					undefined
				);
			}
		}
	}

	// 块预遍历 导出所有声明语句
	blockPreWalkExportAllDeclaration(statement) {
		const source = statement.source.value;
		const name = statement.exported ? statement.exported.name : null;
		this.hooks.exportImport.call(statement, source);
		this.hooks.exportImportSpecifier.call(statement, source, null, name, 0);
	}

	// 预遍历 Var变量声明语句
	preWalkVariableDeclaration(statement) {
		// 只有当 使用 var 关键字声明变量时 
		if (statement.kind !== "var") return;
		this._preWalkVariableDeclaration(statement, this.hooks.varDeclarationVar);
	}

	// 块预遍历 变量声明语句
	blockPreWalkVariableDeclaration(statement) {
		if (statement.kind === "var") return;
		const hookMap =
			statement.kind === "const"
				? this.hooks.varDeclarationConst
				: this.hooks.varDeclarationLet;
		this._preWalkVariableDeclaration(statement, hookMap);
	}

	// 开始预遍历 Var变量声明语句
	_preWalkVariableDeclaration(statement, hookMap) {
		for (const declarator of statement.declarations) {
			switch (declarator.type) {
				case "VariableDeclarator": {
					if (!this.hooks.preDeclarator.call(declarator, statement)) {
						this.enterPattern(declarator.id, (name, decl) => {
							let hook = hookMap.get(name);
							if (hook === undefined || !hook.call(decl)) {
								hook = this.hooks.varDeclaration.get(name);
								if (hook === undefined || !hook.call(decl)) {
									this.defineVariable(name);
								}
							}
						});
					}
					break;
				}
			}
		}
	}

	// 遍历 变量声明语句
	walkVariableDeclaration(statement) {
		for (const declarator of statement.declarations) {
			switch (declarator.type) {
				case "VariableDeclarator": {
					const renameIdentifier =
						declarator.init && this.getRenameIdentifier(declarator.init);
					if (renameIdentifier && declarator.id.type === "Identifier") {
						const hook = this.hooks.canRename.get(renameIdentifier);
						if (hook !== undefined && hook.call(declarator.init)) {
							// renaming with "var a = b;"
							const hook = this.hooks.rename.get(renameIdentifier);
							if (hook === undefined || !hook.call(declarator.init)) {
								this.setVariable(declarator.id.name, renameIdentifier);
							}
							break;
						}
					}
					if (!this.hooks.declarator.call(declarator, statement)) {
						this.walkPattern(declarator.id);
						if (declarator.init) this.walkExpression(declarator.init);
					}
					break;
				}
			}
		}
	}

	// 块遍历 类声明语句
	blockPreWalkClassDeclaration(statement) {
		if (statement.id) {
			this.defineVariable(statement.id.name);
		}
	}

	// 遍历 类声明语句
	walkClassDeclaration(statement) {
		this.walkClass(statement);
	}

	// 预遍历 SwitchCases 语句
	preWalkSwitchCases(switchCases) {
		for (let index = 0, len = switchCases.length; index < len; index++) {
			const switchCase = switchCases[index];
			this.preWalkStatements(switchCase.consequent);
		}
	}

	// 遍历 SwitchCase
	walkSwitchCases(switchCases) {
		this.inBlockScope(() => {
			const len = switchCases.length;

			// we need to pre walk all statements first since we can have invalid code
			// import A from "module";
			// switch(1) {
			//    case 1:
			//      console.log(A); // should fail at runtime
			//    case 2:
			//      const A = 1;
			// }
			for (let index = 0; index < len; index++) {
				const switchCase = switchCases[index];

				if (switchCase.consequent.length > 0) {
					const prev = this.prevStatement;
					this.blockPreWalkStatements(switchCase.consequent);
					this.prevStatement = prev;
				}
			}

			for (let index = 0; index < len; index++) {
				const switchCase = switchCases[index];

				if (switchCase.test) {
					this.walkExpression(switchCase.test);
				}
				if (switchCase.consequent.length > 0) {
					this.walkStatements(switchCase.consequent);
				}
			}
		});
	}

	// 预遍历 Catch语句
	preWalkCatchClause(catchClause) {
		this.preWalkStatement(catchClause.body);
	}

	walkCatchClause(catchClause) {
		this.inBlockScope(() => {
			// Error binding is optional in catch clause since ECMAScript 2019
			if (catchClause.param !== null) {
				this.enterPattern(catchClause.param, ident => {
					this.defineVariable(ident);
				});
				this.walkPattern(catchClause.param);
			}
			const prev = this.prevStatement;
			this.blockPreWalkStatement(catchClause.body);
			this.prevStatement = prev;
			this.walkStatement(catchClause.body);
		});
	}

	// 遍历 模式
	walkPattern(pattern) {
		switch (pattern.type) {
			case "ArrayPattern":
				this.walkArrayPattern(pattern);
				break;
			case "AssignmentPattern":
				this.walkAssignmentPattern(pattern);
				break;
			case "MemberExpression":
				this.walkMemberExpression(pattern);
				break;
			case "ObjectPattern":
				this.walkObjectPattern(pattern);
				break;
			case "RestElement":
				this.walkRestElement(pattern);
				break;
		}
	}

	// 遍历 赋值模式
	walkAssignmentPattern(pattern) {
		this.walkExpression(pattern.right);
		this.walkPattern(pattern.left);
	}

	// 遍历 对象模式
	walkObjectPattern(pattern) {
		for (let i = 0, len = pattern.properties.length; i < len; i++) {
			const prop = pattern.properties[i];
			if (prop) {
				if (prop.computed) this.walkExpression(prop.key);
				if (prop.value) this.walkPattern(prop.value);
			}
		}
	}

	// 遍历 数组模式
	walkArrayPattern(pattern) {
		for (let i = 0, len = pattern.elements.length; i < len; i++) {
			const element = pattern.elements[i];
			if (element) this.walkPattern(element);
		}
	}

	// 遍历 剩余参数模式
	walkRestElement(pattern) {
		this.walkPattern(pattern.argument);
	}

	// 遍历 所有的表达式
	walkExpressions(expressions) {
		for (const expression of expressions) {
			if (expression) {
				this.walkExpression(expression);
			}
		}
	}

	// 遍历 单个表达式
	// 根据 不同的表达式类型 遍历对应的表达式
	walkExpression(expression) {
		switch (expression.type) {
			case "ArrayExpression":
				this.walkArrayExpression(expression);
				break;
			case "ArrowFunctionExpression":
				this.walkArrowFunctionExpression(expression);
				break;
			case "AssignmentExpression":
				this.walkAssignmentExpression(expression);
				break;
			case "AwaitExpression":
				this.walkAwaitExpression(expression);
				break;
			case "BinaryExpression":
				this.walkBinaryExpression(expression);
				break;
			case "CallExpression":
				this.walkCallExpression(expression);
				break;
			case "ChainExpression":
				this.walkChainExpression(expression);
				break;
			case "ClassExpression":
				this.walkClassExpression(expression);
				break;
			case "ConditionalExpression":
				this.walkConditionalExpression(expression);
				break;
			case "FunctionExpression":
				this.walkFunctionExpression(expression);
				break;
			case "Identifier":
				this.walkIdentifier(expression);
				break;
			case "ImportExpression":
				this.walkImportExpression(expression);
				break;
			case "LogicalExpression":
				this.walkLogicalExpression(expression);
				break;
			case "MetaProperty":
				this.walkMetaProperty(expression);
				break;
			case "MemberExpression":
				this.walkMemberExpression(expression);
				break;
			case "NewExpression":
				this.walkNewExpression(expression);
				break;
			case "ObjectExpression":
				this.walkObjectExpression(expression);
				break;
			case "SequenceExpression":
				this.walkSequenceExpression(expression);
				break;
			case "SpreadElement":
				this.walkSpreadElement(expression);
				break;
			case "TaggedTemplateExpression":
				this.walkTaggedTemplateExpression(expression);
				break;
			case "TemplateLiteral":
				this.walkTemplateLiteral(expression);
				break;
			case "ThisExpression":
				this.walkThisExpression(expression);
				break;
			case "UnaryExpression":
				this.walkUnaryExpression(expression);
				break;
			case "UpdateExpression":
				this.walkUpdateExpression(expression);
				break;
			case "YieldExpression":
				this.walkYieldExpression(expression);
				break;
		}
	}

	// 遍历 await表达式
	walkAwaitExpression(expression) {
		if (this.scope.topLevelScope === true)
			this.hooks.topLevelAwait.call(expression);
		this.walkExpression(expression.argument);
	}

	// 遍历 数组表达式
	walkArrayExpression(expression) {
		if (expression.elements) {
			this.walkExpressions(expression.elements);
		}
	}

	// 遍历 扩展运算符元素
	walkSpreadElement(expression) {
		if (expression.argument) {
			this.walkExpression(expression.argument);
		}
	}

	// 遍历 对象表达式
	walkObjectExpression(expression) {
		for (
			let propIndex = 0, len = expression.properties.length;
			propIndex < len;
			propIndex++
		) {
			const prop = expression.properties[propIndex];
			this.walkProperty(prop);
		}
	}

	// 遍历 属性
	walkProperty(prop) {
		if (prop.type === "SpreadElement") {
			this.walkExpression(prop.argument);
			return;
		}
		if (prop.computed) {
			this.walkExpression(prop.key);
		}
		if (prop.shorthand && prop.value && prop.value.type === "Identifier") {
			this.scope.inShorthand = prop.value.name;
			this.walkIdentifier(prop.value);
			this.scope.inShorthand = false;
		} else {
			this.walkExpression(prop.value);
		}
	}

	// 遍历 函数表达式
	walkFunctionExpression(expression) {
		const wasTopLevel = this.scope.topLevelScope;
		this.scope.topLevelScope = false;
		const scopeParams = expression.params;

		// Add function name in scope for recursive calls
		if (expression.id) {
			scopeParams.push(expression.id.name);
		}

		this.inFunctionScope(true, scopeParams, () => {
			for (const param of expression.params) {
				this.walkPattern(param);
			}
			if (expression.body.type === "BlockStatement") {
				this.detectMode(expression.body.body);
				const prev = this.prevStatement;
				this.preWalkStatement(expression.body);
				this.prevStatement = prev;
				this.walkStatement(expression.body);
			} else {
				this.walkExpression(expression.body);
			}
		});
		this.scope.topLevelScope = wasTopLevel;
	}

	// 遍历 箭头函数表达式
	walkArrowFunctionExpression(expression) {
		const wasTopLevel = this.scope.topLevelScope;
		this.scope.topLevelScope = wasTopLevel ? "arrow" : false;
		this.inFunctionScope(false, expression.params, () => {
			for (const param of expression.params) {
				this.walkPattern(param);
			}
			if (expression.body.type === "BlockStatement") {
				this.detectMode(expression.body.body);
				const prev = this.prevStatement;
				this.preWalkStatement(expression.body);
				this.prevStatement = prev;
				this.walkStatement(expression.body);
			} else {
				this.walkExpression(expression.body);
			}
		});
		this.scope.topLevelScope = wasTopLevel;
	}

	// 遍历 序列表达式
	walkSequenceExpression(expression) {
		if (!expression.expressions) return;
		// We treat sequence expressions like statements when they are one statement level
		// This has some benefits for optimizations that only work on statement level
		const currentStatement = this.statementPath[this.statementPath.length - 1];
		if (
			currentStatement === expression ||
			(currentStatement.type === "ExpressionStatement" &&
				currentStatement.expression === expression)
		) {
			const old = this.statementPath.pop();
			for (const expr of expression.expressions) {
				this.statementPath.push(expr);
				this.walkExpression(expr);
				this.statementPath.pop();
			}
			this.statementPath.push(old);
		} else {
			this.walkExpressions(expression.expressions);
		}
	}

	// 遍历 更新表达式
	walkUpdateExpression(expression) {
		this.walkExpression(expression.argument);
	}

	// 遍历 一元表达式
	walkUnaryExpression(expression) {
		if (expression.operator === "typeof") {
			const result = this.callHooksForExpression(
				this.hooks.typeof,
				expression.argument,
				expression
			);
			if (result === true) return;
			if (expression.argument.type === "ChainExpression") {
				const result = this.callHooksForExpression(
					this.hooks.typeof,
					expression.argument.expression,
					expression
				);
				if (result === true) return;
			}
		}
		this.walkExpression(expression.argument);
	}

	// 遍历 表达式左节点和右节点
	walkLeftRightExpression(expression) {
		this.walkExpression(expression.left);
		this.walkExpression(expression.right);
	}

	// 遍历 二元表达式
	walkBinaryExpression(expression) {
		this.walkLeftRightExpression(expression);
	}

	// 遍历 逻辑表达式
	walkLogicalExpression(expression) {
		const result = this.hooks.expressionLogicalOperator.call(expression);
		if (result === undefined) {
			this.walkLeftRightExpression(expression);
		} else {
			if (result) {
				this.walkExpression(expression.right);
			}
		}
	}

	// 遍历 赋值表达式
	walkAssignmentExpression(expression) {
		if (expression.left.type === "Identifier") {
			const renameIdentifier = this.getRenameIdentifier(expression.right);
			if (renameIdentifier) {
				if (
					this.callHooksForInfo(
						this.hooks.canRename,
						renameIdentifier,
						expression.right
					)
				) {
					// renaming "a = b;"
					if (
						!this.callHooksForInfo(
							this.hooks.rename,
							renameIdentifier,
							expression.right
						)
					) {
						this.setVariable(
							expression.left.name,
							this.getVariableInfo(renameIdentifier)
						);
					}
					return;
				}
			}
			this.walkExpression(expression.right);
			this.enterPattern(expression.left, (name, decl) => {
				if (!this.callHooksForName(this.hooks.assign, name, expression)) {
					this.walkExpression(expression.left);
				}
			});
			return;
		}
		if (expression.left.type.endsWith("Pattern")) {
			this.walkExpression(expression.right);
			this.enterPattern(expression.left, (name, decl) => {
				if (!this.callHooksForName(this.hooks.assign, name, expression)) {
					this.defineVariable(name);
				}
			});
			this.walkPattern(expression.left);
		} else if (expression.left.type === "MemberExpression") {
			const exprName = this.getMemberExpressionInfo(
				expression.left,
				ALLOWED_MEMBER_TYPES_EXPRESSION
			);
			if (exprName) {
				if (
					this.callHooksForInfo(
						this.hooks.assignMemberChain,
						exprName.rootInfo,
						expression,
						exprName.getMembers()
					)
				) {
					return;
				}
			}
			this.walkExpression(expression.right);
			this.walkExpression(expression.left);
		} else {
			this.walkExpression(expression.right);
			this.walkExpression(expression.left);
		}
	}

	// 遍历 条件表达式
	walkConditionalExpression(expression) {
		const result = this.hooks.expressionConditionalOperator.call(expression);
		if (result === undefined) {
			this.walkExpression(expression.test);
			this.walkExpression(expression.consequent);
			if (expression.alternate) {
				this.walkExpression(expression.alternate);
			}
		} else {
			if (result) {
				this.walkExpression(expression.consequent);
			} else if (expression.alternate) {
				this.walkExpression(expression.alternate);
			}
		}
	}

	// 遍历 new表达式
	walkNewExpression(expression) {
		const result = this.callHooksForExpression(
			this.hooks.new,
			expression.callee,
			expression
		);
		if (result === true) return;
		this.walkExpression(expression.callee);
		if (expression.arguments) {
			this.walkExpressions(expression.arguments);
		}
	}

	// 遍历 Yield表达式
	walkYieldExpression(expression) {
		if (expression.argument) {
			this.walkExpression(expression.argument);
		}
	}

	// 遍历 模板字面量表达式
	walkTemplateLiteral(expression) {
		if (expression.expressions) {
			this.walkExpressions(expression.expressions);
		}
	}

	// 遍历 标签模板字面量表达式
	walkTaggedTemplateExpression(expression) {
		if (expression.tag) {
			this.walkExpression(expression.tag);
		}
		if (expression.quasi && expression.quasi.expressions) {
			this.walkExpressions(expression.quasi.expressions);
		}
	}

	// 遍历 类表达式
	walkClassExpression(expression) {
		this.walkClass(expression);
	}

	// 遍历 链式表达式( a.b?.c es2020)
	walkChainExpression(expression) {
		const result = this.hooks.optionalChaining.call(expression);

		if (result === undefined) {
			if (expression.expression.type === "CallExpression") {
				this.walkCallExpression(expression.expression);
			} else {
				this.walkMemberExpression(expression.expression);
			}
		}
	}

	_walkIIFE(functionExpression, options, currentThis) {
		const getVarInfo = argOrThis => {
			const renameIdentifier = this.getRenameIdentifier(argOrThis);
			if (renameIdentifier) {
				if (
					this.callHooksForInfo(
						this.hooks.canRename,
						renameIdentifier,
						argOrThis
					)
				) {
					if (
						!this.callHooksForInfo(
							this.hooks.rename,
							renameIdentifier,
							argOrThis
						)
					) {
						return this.getVariableInfo(renameIdentifier);
					}
				}
			}
			this.walkExpression(argOrThis);
		};
		const { params, type } = functionExpression;
		const arrow = type === "ArrowFunctionExpression";
		const renameThis = currentThis ? getVarInfo(currentThis) : null;
		const varInfoForArgs = options.map(getVarInfo);
		const wasTopLevel = this.scope.topLevelScope;
		this.scope.topLevelScope = wasTopLevel && arrow ? "arrow" : false;
		const scopeParams = params.filter(
			(identifier, idx) => !varInfoForArgs[idx]
		);

		// Add function name in scope for recursive calls
		if (functionExpression.id) {
			scopeParams.push(functionExpression.id.name);
		}

		this.inFunctionScope(true, scopeParams, () => {
			if (renameThis && !arrow) {
				this.setVariable("this", renameThis);
			}
			for (let i = 0; i < varInfoForArgs.length; i++) {
				const varInfo = varInfoForArgs[i];
				if (!varInfo) continue;
				if (!params[i] || params[i].type !== "Identifier") continue;
				this.setVariable(params[i].name, varInfo);
			}
			if (functionExpression.body.type === "BlockStatement") {
				this.detectMode(functionExpression.body.body);
				const prev = this.prevStatement;
				this.preWalkStatement(functionExpression.body);
				this.prevStatement = prev;
				this.walkStatement(functionExpression.body);
			} else {
				this.walkExpression(functionExpression.body);
			}
		});
		this.scope.topLevelScope = wasTopLevel;
	}

	// 遍历 import表达式
	walkImportExpression(expression) {
		let result = this.hooks.importCall.call(expression);
		if (result === true) return;

		this.walkExpression(expression.source);
	}

	// 遍历 调用表达式
	walkCallExpression(expression) {
		const isSimpleFunction = fn => {
			return fn.params.every(p => p.type === "Identifier");
		};
		if (
			expression.callee.type === "MemberExpression" &&
			expression.callee.object.type.endsWith("FunctionExpression") &&
			!expression.callee.computed &&
			(expression.callee.property.name === "call" ||
				expression.callee.property.name === "bind") &&
			expression.arguments.length > 0 &&
			isSimpleFunction(expression.callee.object)
		) {
			// (function(…) { }.call/bind(?, …))
			this._walkIIFE(
				expression.callee.object,
				expression.arguments.slice(1),
				expression.arguments[0]
			);
		} else if (
			expression.callee.type.endsWith("FunctionExpression") &&
			isSimpleFunction(expression.callee)
		) {
			// (function(…) { }(…))
			this._walkIIFE(expression.callee, expression.arguments, null);
		} else {
			if (expression.callee.type === "MemberExpression") {
				const exprInfo = this.getMemberExpressionInfo(
					expression.callee,
					ALLOWED_MEMBER_TYPES_CALL_EXPRESSION
				);
				if (exprInfo && exprInfo.type === "call") {
					const result = this.callHooksForInfo(
						this.hooks.callMemberChainOfCallMemberChain,
						exprInfo.rootInfo,
						expression,
						exprInfo.getCalleeMembers(),
						exprInfo.call,
						exprInfo.getMembers()
					);
					if (result === true) return;
				}
			}
			const callee = this.evaluateExpression(expression.callee);
			if (callee.isIdentifier()) {
				// (myObj.anyFunc())
				const result1 = this.callHooksForInfo(
					this.hooks.callMemberChain,
					callee.rootInfo,
					expression,
					callee.getMembers()
				);
				if (result1 === true) return;
				// (sayHello())
				const result2 = this.callHooksForInfo(
					this.hooks.call,
					callee.identifier,
					expression
				);
				if (result2 === true) return;
			}

			if (expression.callee) {
				if (expression.callee.type === "MemberExpression") {
					// because of call context we need to walk the call context as expression
					this.walkExpression(expression.callee.object);
					if (expression.callee.computed === true)
						this.walkExpression(expression.callee.property);
				} else {
					this.walkExpression(expression.callee);
				}
			}
			if (expression.arguments) this.walkExpressions(expression.arguments);
		}
	}

	// 遍历 成员表达式
	walkMemberExpression(expression) {
		const exprInfo = this.getMemberExpressionInfo(
			expression,
			ALLOWED_MEMBER_TYPES_ALL
		);
		if (exprInfo) {
			switch (exprInfo.type) {
				case "expression": {
					const result1 = this.callHooksForInfo(
						this.hooks.expression,
						exprInfo.name,
						expression
					);
					if (result1 === true) return;
					const members = exprInfo.getMembers();
					const result2 = this.callHooksForInfo(
						this.hooks.expressionMemberChain,
						exprInfo.rootInfo,
						expression,
						members
					);
					if (result2 === true) return;
					this.walkMemberExpressionWithExpressionName(
						expression,
						exprInfo.name,
						exprInfo.rootInfo,
						members.slice(),
						() =>
							this.callHooksForInfo(
								this.hooks.unhandledExpressionMemberChain,
								exprInfo.rootInfo,
								expression,
								members
							)
					);
					return;
				}
				case "call": {
					const result = this.callHooksForInfo(
						this.hooks.memberChainOfCallMemberChain,
						exprInfo.rootInfo,
						expression,
						exprInfo.getCalleeMembers(),
						exprInfo.call,
						exprInfo.getMembers()
					);
					if (result === true) return;
					// Fast skip over the member chain as we already called memberChainOfCallMemberChain
					// and call computed property are literals anyway
					this.walkExpression(exprInfo.call);
					return;
				}
			}
		}
		this.walkExpression(expression.object);
		if (expression.computed === true) this.walkExpression(expression.property);
	}

	// 
	walkMemberExpressionWithExpressionName(
		expression,
		name,
		rootInfo,
		members,
		onUnhandled
	) {
		if (expression.object.type === "MemberExpression") {
			// optimize the case where expression.object is a MemberExpression too.
			// we can keep info here when calling walkMemberExpression directly
			const property =
				expression.property.name || `${expression.property.value}`;
			name = name.slice(0, -property.length - 1);
			members.pop();
			const result = this.callHooksForInfo(
				this.hooks.expression,
				name,
				expression.object
			);
			if (result === true) return;
			this.walkMemberExpressionWithExpressionName(
				expression.object,
				name,
				rootInfo,
				members,
				onUnhandled
			);
		} else if (!onUnhandled || !onUnhandled()) {
			this.walkExpression(expression.object);
		}
		if (expression.computed === true) this.walkExpression(expression.property);
	}

	// 遍历 this表达式
	walkThisExpression(expression) {
		this.callHooksForName(this.hooks.expression, "this", expression);
	}

	// 遍历 含有标识符 的表达式
	// 调用 parser.hooks.expression.for('identifier')
	walkIdentifier(expression) {
		this.callHooksForName(this.hooks.expression, expression.name, expression);
	}

	// 遍历 元属性(import.meta)
	// 调用 parser.hooks.expression.for('identifier')
	walkMetaProperty(metaProperty) {
		this.hooks.expression.for(getRootName(metaProperty)).call(metaProperty);
	}

	// 调用 表达式 某个特定钩子
	callHooksForExpression(hookMap, expr, ...args) {
		return this.callHooksForExpressionWithFallback(
			hookMap,
			expr,
			undefined,
			undefined,
			...args
		);
	}

	// TODO:
  // 
	callHooksForExpressionWithFallback(
		hookMap,
		expr,
		fallback,
		defined,
		...args
	) {
		const exprName = this.getMemberExpressionInfo(
			expr,
			ALLOWED_MEMBER_TYPES_EXPRESSION
		);
		if (exprName !== undefined) {
			const members = exprName.getMembers();
			return this.callHooksForInfoWithFallback(
				hookMap,
				members.length === 0 ? exprName.rootInfo : exprName.name,
				fallback &&
					(name => fallback(name, exprName.rootInfo, exprName.getMembers)),
				defined && (() => defined(exprName.name)),
				...args
			);
		}
	}

	// 返回 特定钩子映射中 某个具名钩子调用后的返回值
	// 即: hookMap.for(name).call(....)
	callHooksForName(hookMap, name, ...args) {
		return this.callHooksForNameWithFallback(
			hookMap,
			name,
			undefined,
			undefined,
			...args
		);
	}

	// 返回 特定钩子映射中 某个具名钩子调用后的返回值
	// 即: hookMap.for(name).call(....)
	callHooksForInfo(hookMap, info, ...args) {
		return this.callHooksForInfoWithFallback(
			hookMap,
			info,
			undefined,
			undefined,
			...args
		);
	}

	// 最终调用
	// 如果 钩子存在 返回 特定钩子映射中 某个具名钩子调用后的返回值
	// 即: hookMap.for(name).call(....)
	callHooksForInfoWithFallback(hookMap, info, fallback, defined, ...args) {
		let name;
		if (typeof info === "string") {
			name = info;
		} else {
			if (!(info instanceof VariableInfo)) {
				if (defined !== undefined) {
					return defined();
				}
				return;
			}
			let tagInfo = info.tagInfo;
			while (tagInfo !== undefined) {
				const hook = hookMap.get(tagInfo.tag);
				if (hook !== undefined) {
					this.currentTagData = tagInfo.data;
					const result = hook.call(...args);
					this.currentTagData = undefined;
					if (result !== undefined) return result;
				}
				tagInfo = tagInfo.next;
			}
			if (info.freeName === true) {
				if (defined !== undefined) {
					return defined();
				}
				return;
			}
			name = info.freeName;
		}
		// 如果调用钩子后有返回值 则直接返回当前返回值
		const hook = hookMap.get(name);
		if (hook !== undefined) {
			const result = hook.call(...args);
			if (result !== undefined) return result;
		}
		// 返回回调函数返回值
		if (fallback !== undefined) {
			return fallback(name);
		}
	}

	// 返回 特定钩子映射中 某个具名钩子调用后的返回值
	// 即: hookMap.for(name).call(....)
	callHooksForNameWithFallback(hookMap, name, fallback, defined, ...args) {
		return this.callHooksForInfoWithFallback(
			hookMap,
			this.getVariableInfo(name),
			fallback,
			defined,
			...args
		);
	}

	/**
	 * @deprecated
	 * @param {any} params scope params
	 * @param {function(): void} fn inner function
	 * @returns {void}
	 */
	inScope(params, fn) {
		const oldScope = this.scope;
		this.scope = {
			topLevelScope: oldScope.topLevelScope,
			inTry: false,
			inShorthand: false,
			isStrict: oldScope.isStrict,
			isAsmJs: oldScope.isAsmJs,
			definitions: oldScope.definitions.createChild()
		};

		this.undefineVariable("this");

		this.enterPatterns(params, (ident, pattern) => {
			this.defineVariable(ident);
		});

		fn();

		this.scope = oldScope;
	}

	// 绑定 函数作用域
	inFunctionScope(hasThis, params, fn) {
		const oldScope = this.scope;
		this.scope = {
			topLevelScope: oldScope.topLevelScope,
			inTry: false,
			inShorthand: false,
			isStrict: oldScope.isStrict,
			isAsmJs: oldScope.isAsmJs,
			definitions: oldScope.definitions.createChild()
		};

		if (hasThis) {
			this.undefineVariable("this");
		}

		this.enterPatterns(params, (ident, pattern) => {
			this.defineVariable(ident);
		});

		fn();

		this.scope = oldScope;
	}

	// 绑定 块作用域
	inBlockScope(fn) {
		const oldScope = this.scope;
		this.scope = {
			topLevelScope: oldScope.topLevelScope,
			inTry: oldScope.inTry,
			inShorthand: false,
			isStrict: oldScope.isStrict,
			isAsmJs: oldScope.isAsmJs,
			definitions: oldScope.definitions.createChild()
		};

		fn();

		this.scope = oldScope;
	}

	// 检查当前JS文件是否是严格模式(use strict)或者use asm
	// 设置 parser.scope.isStrict | parser.scope.isAsmJs
	detectMode(statements) {
		const isLiteral =
			statements.length >= 1 &&
			statements[0].type === "ExpressionStatement" &&
			statements[0].expression.type === "Literal";
		// 判断文件中的 第一个语句 的类型 和 值
		if (isLiteral && statements[0].expression.value === "use strict") {
			this.scope.isStrict = true;
		}
		if (isLiteral && statements[0].expression.value === "use asm") {
			this.scope.isAsmJs = true;
		}
	}

	// 进入 所有的模式
	enterPatterns(patterns, onIdent) {
		for (const pattern of patterns) {
			if (typeof pattern !== "string") {
				this.enterPattern(pattern, onIdent);
			} else if (pattern) {
				onIdent(pattern);
			}
		}
	}

	// 进入 单个模式
	enterPattern(pattern, onIdent) {
		if (!pattern) return;
		// 数组模式
		// 赋值模式
		// 标识符
		// 对象模式
		// 剩余参数模式
		// 属性
		switch (pattern.type) {
			case "ArrayPattern":
				this.enterArrayPattern(pattern, onIdent);
				break;
			case "AssignmentPattern":
				this.enterAssignmentPattern(pattern, onIdent);
				break;
			case "Identifier":
				this.enterIdentifier(pattern, onIdent);
				break;
			case "ObjectPattern":
				this.enterObjectPattern(pattern, onIdent);
				break;
			case "RestElement":
				// 剩余参数
				this.enterRestElement(pattern, onIdent);
				break;
			case "Property":
				if (pattern.shorthand && pattern.value.type === "Identifier") {
					this.scope.inShorthand = pattern.value.name;
					this.enterIdentifier(pattern.value, onIdent);
					this.scope.inShorthand = false;
				} else {
					this.enterPattern(pattern.value, onIdent);
				}
				break;
		}
	}

	// 进入 标识符模式
	enterIdentifier(pattern, onIdent) {
		if (!this.callHooksForName(this.hooks.pattern, pattern.name, pattern)) {
			onIdent(pattern.name, pattern);
		}
	}

	// 进入 对象模式
	enterObjectPattern(pattern, onIdent) {
		for (
			let propIndex = 0, len = pattern.properties.length;
			propIndex < len;
			propIndex++
		) {
			const prop = pattern.properties[propIndex];
			this.enterPattern(prop, onIdent);
		}
	}

	// 进入 数组模式
	enterArrayPattern(pattern, onIdent) {
		for (
			let elementIndex = 0, len = pattern.elements.length;
			elementIndex < len;
			elementIndex++
		) {
			const element = pattern.elements[elementIndex];
			this.enterPattern(element, onIdent);
		}
	}

	// 进入 剩余参数模式
	enterRestElement(pattern, onIdent) {
		this.enterPattern(pattern.argument, onIdent);
	}

	// 进入 赋值模式
	enterAssignmentPattern(pattern, onIdent) {
		this.enterPattern(pattern.left, onIdent);
	}

	// 求值 表达式
	// 主要是调用 表达式类型 对应的钩子(parser.hooks.evaluate.for('ExpressionType')) 返回钩子求值后的结果
	// 返回 BasicEvaluatedExpression 的实例
	evaluateExpression(expression) {
		try {
			const hook = this.hooks.evaluate.get(expression.type);
			if (hook !== undefined) {
				const result = hook.call(expression);
				if (result !== undefined) {
					if (result) {
						result.setExpression(expression);
					}
					return result;
				}
			}
		} catch (e) {
			console.warn(e);
			// ignore error
		}
		return new BasicEvaluatedExpression()
			.setRange(expression.range)
			.setExpression(expression);
	}

	// 分析表达式中的字符串
	parseString(expression) {
		switch (expression.type) {
			case "BinaryExpression":
				if (expression.operator === "+") {
					return (
						this.parseString(expression.left) +
						this.parseString(expression.right)
					);
				}
				break;
			case "Literal":
				return expression.value + "";
		}
		throw new Error(
			expression.type + " is not supported as parameter for require"
		);
	}

	parseCalculatedString(expression) {
		switch (expression.type) {
			case "BinaryExpression":
				if (expression.operator === "+") {
					const left = this.parseCalculatedString(expression.left);
					const right = this.parseCalculatedString(expression.right);
					if (left.code) {
						return {
							range: left.range,
							value: left.value,
							code: true,
							conditional: false
						};
					} else if (right.code) {
						return {
							range: [
								left.range[0],
								right.range ? right.range[1] : left.range[1]
							],
							value: left.value + right.value,
							code: true,
							conditional: false
						};
					} else {
						return {
							range: [left.range[0], right.range[1]],
							value: left.value + right.value,
							code: false,
							conditional: false
						};
					}
				}
				break;
			case "ConditionalExpression": {
				const consequent = this.parseCalculatedString(expression.consequent);
				const alternate = this.parseCalculatedString(expression.alternate);
				const items = [];
				if (consequent.conditional) {
					items.push(...consequent.conditional);
				} else if (!consequent.code) {
					items.push(consequent);
				} else {
					break;
				}
				if (alternate.conditional) {
					items.push(...alternate.conditional);
				} else if (!alternate.code) {
					items.push(alternate);
				} else {
					break;
				}
				return {
					range: undefined,
					value: "",
					code: true,
					conditional: items
				};
			}
			case "Literal":
				return {
					range: expression.range,
					value: expression.value + "",
					code: false,
					conditional: false
				};
		}
		return {
			range: undefined,
			value: "",
			code: true,
			conditional: false
		};
	}

	// 分析源代码的词法、语法作用域后 返回分析器状态
	parse(source, state) {
		let ast;
		let comments;
		const semicolons = new Set();
		if (source === null) {
			throw new Error("source must not be null");
		}
		if (Buffer.isBuffer(source)) {
			source = source.toString("utf-8");
		}
		if (typeof source === "object") {
			ast = /** @type {ProgramNode} */ (source);
			comments = source.comments;
		} else {
			comments = [];
			ast = JavascriptParser._parse(source, {
				sourceType: this.sourceType,
				onComment: comments,
				onInsertedSemicolon: pos => semicolons.add(pos)
			});
		}

		const oldScope = this.scope;
		const oldState = this.state;
		const oldComments = this.comments;
		const oldSemicolons = this.semicolons;
		const oldStatementPath = this.statementPath;
		const oldPrevStatement = this.prevStatement;
		// 作用域
		this.scope = {
			topLevelScope: true, // 是否是全局作用域
			inTry: false, // 是否在 try 代码块中
			inShorthand: false, // 对象属性prop
			isStrict: false, // 是否是标准的ES模块 或者 使用严格模式
			isAsmJs: false,  // 是否是 asm 模块
			definitions: new StackedMap() // 
		};
		/** @type {ParserState} */
		this.state = state;
		this.comments = comments;
		this.semicolons = semicolons;
		this.statementPath = [];
		this.prevStatement = undefined;

		/**
		 * 1. 预遍历语句: 绑定作用域
		 * 		1.1 先预遍历 所有的语句()   作用: 绑定全局作用域
		 * 		1.2 再预遍历 含有块作用域的关键字 的语句(export import const let class) 作用: 绑定块作用域
		 * 2. 遍历语句
		 * 		遍历所有的表达式(在表达式中 调用 相关钩子)
		 */

		// HarmonyDetectionParserPlugin
		// UseStrictPlugin
		// DefinePlugin
		// InnerGraphPlugin
		// SideEffectsFlagPlugin
		if (this.hooks.program.call(ast, comments) === undefined) {
			// 检查当前JS文件是否是严格模式(use strict)或者use asm
			this.detectMode(ast.body);
			// 预遍历 所有的语句
			// 作用: 为所有的 变量声明 设置 作用域(此时只有全局作用域)
			this.preWalkStatements(ast.body);
			this.prevStatement = undefined;
			// 块预遍历 所有的导入导出语句
			// 作用: 为具有块作用域的关键字(export、import、class、const、let) 声明的变量 设置作用域
			this.blockPreWalkStatements(ast.body);
			this.prevStatement = undefined;
			// 遍历 所有的语句
			this.walkStatements(ast.body);
		}

		// JavascriptParser
		// JavascriptMetaInfoPlugin
		this.hooks.finish.call(ast, comments);
		this.scope = oldScope;
		/** @type {ParserState} */
		this.state = oldState;
		this.comments = oldComments;
		this.semicolons = oldSemicolons;
		this.statementPath = oldStatementPath;
		this.prevStatement = oldPrevStatement;
		return state;
	}

	// 求值包含表达式的源代码(非语句) 并返回 BasicEvaluatedExpression 的实例
	evaluate(source) {
		// 1. 分析 源代码 后返回对应的 ast
		const ast = JavascriptParser._parse("(" + source + ")", {
			sourceType: this.sourceType,
			locations: false
		});
		if (ast.body.length !== 1 || ast.body[0].type !== "ExpressionStatement") {
			throw new Error("evaluate: Source is not a expression");
		}
		// 2. 调用 表达式类型 对应的钩子 并返回钩子求值后的结果
		return this.evaluateExpression(ast.body[0].expression);
	}

	/**
	 * @param {ExpressionNode | DeclarationNode | PrivateIdentifierNode | null | undefined} expr an expression
	 * @param {number} commentsStartPos source position from which annotation comments are checked
	 * @returns {boolean} true, when the expression is pure
	 */
	isPure(expr, commentsStartPos) {
		if (!expr) return true;
		const result = this.hooks.isPure
			.for(expr.type)
			.call(expr, commentsStartPos);
		if (typeof result === "boolean") return result;
		switch (expr.type) {
			case "ClassDeclaration":
			case "ClassExpression": {
				if (expr.body.type !== "ClassBody") return false;
				if (expr.superClass && !this.isPure(expr.superClass, expr.range[0])) {
					return false;
				}
				const items =
					/** @type {(MethodDefinitionNode | PropertyDefinitionNode)[]} */ (
						expr.body.body
					);
				return items.every(
					item =>
						(!item.computed ||
							!item.key ||
							this.isPure(item.key, item.range[0])) &&
						(!item.static ||
							!item.value ||
							this.isPure(
								item.value,
								item.key ? item.key.range[1] : item.range[0]
							))
				);
			}

			case "FunctionDeclaration":
			case "FunctionExpression":
			case "ArrowFunctionExpression":
			case "Literal":
			case "PrivateIdentifier":
				return true;

			case "VariableDeclaration":
				return expr.declarations.every(decl =>
					this.isPure(decl.init, decl.range[0])
				);

			case "ConditionalExpression":
				return (
					this.isPure(expr.test, commentsStartPos) &&
					this.isPure(expr.consequent, expr.test.range[1]) &&
					this.isPure(expr.alternate, expr.consequent.range[1])
				);

			case "SequenceExpression":
				return expr.expressions.every(expr => {
					const pureFlag = this.isPure(expr, commentsStartPos);
					commentsStartPos = expr.range[1];
					return pureFlag;
				});

			case "CallExpression": {
				const pureFlag =
					expr.range[0] - commentsStartPos > 12 &&
					this.getComments([commentsStartPos, expr.range[0]]).some(
						comment =>
							comment.type === "Block" &&
							/^\s*(#|@)__PURE__\s*$/.test(comment.value)
					);
				if (!pureFlag) return false;
				commentsStartPos = expr.callee.range[1];
				return expr.arguments.every(arg => {
					if (arg.type === "SpreadElement") return false;
					const pureFlag = this.isPure(arg, commentsStartPos);
					commentsStartPos = arg.range[1];
					return pureFlag;
				});
			}
		}
		const evaluated = this.evaluateExpression(expr);
		return !evaluated.couldHaveSideEffects();
	}

	// 返回 特定位置范围的注释
	getComments(range) {
		const [rangeStart, rangeEnd] = range;
		const compare = (comment, needle) => comment.range[0] - needle;
		let idx = binarySearchBounds.ge(this.comments, rangeStart, compare);
		let commentsInRange = [];
		while (this.comments[idx] && this.comments[idx].range[1] <= rangeEnd) {
			commentsInRange.push(this.comments[idx]);
			idx++;
		}

		return commentsInRange;
	}

	/**
	 * @param {number} pos source code position
	 * @returns {boolean} true when a semicolon has been inserted before this position, false if not
	 */
	isAsiPosition(pos) {
		const currentStatement = this.statementPath[this.statementPath.length - 1];
		if (currentStatement === undefined) throw new Error("Not in statement");
		return (
			// Either asking directly for the end position of the current statement
			(currentStatement.range[1] === pos && this.semicolons.has(pos)) ||
			// Or asking for the start position of the current statement,
			// here we have to check multiple things
			(currentStatement.range[0] === pos &&
				// is there a previous statement which might be relevant?
				this.prevStatement !== undefined &&
				// is the end position of the previous statement an ASI position?
				this.semicolons.has(this.prevStatement.range[1]))
		);
	}

	/**
	 * @param {number} pos source code position
	 * @returns {void}
	 */
	unsetAsiPosition(pos) {
		this.semicolons.delete(pos);
	}

	isStatementLevelExpression(expr) {
		const currentStatement = this.statementPath[this.statementPath.length - 1];
		return (
			expr === currentStatement ||
			(currentStatement.type === "ExpressionStatement" &&
				currentStatement.expression === expr)
		);
	}

	// 
	getTagData(name, tag) {
		const info = this.scope.definitions.get(name);
		if (info instanceof VariableInfo) {
			let tagInfo = info.tagInfo;
			while (tagInfo !== undefined) {
				if (tagInfo.tag === tag) return tagInfo.data;
				tagInfo = tagInfo.next;
			}
		}
	}

	// 设置标签变量信息
	// CompatibilityPlugin
	// HarmonyImportDependencyParserPlugin
	// InnerGraph
	tagVariable(name, tag, data) {
		const oldInfo = this.scope.definitions.get(name);
		/** @type {VariableInfo} */
		let newInfo;
		if (oldInfo === undefined) {
			newInfo = new VariableInfo(this.scope, name, {
				tag,
				data,
				next: undefined
			});
		} else if (oldInfo instanceof VariableInfo) {
			newInfo = new VariableInfo(oldInfo.declaredScope, oldInfo.freeName, {
				tag,
				data,
				next: oldInfo.tagInfo
			});
		} else {
			newInfo = new VariableInfo(oldInfo, true, {
				tag,
				data,
				next: undefined
			});
		}
		this.scope.definitions.set(name, newInfo);
	}

	// 定义当前变量 及 对应作用域
	defineVariable(name) {
		const oldInfo = this.scope.definitions.get(name);
		// Don't redefine variable in same scope to keep existing tags
		if (oldInfo instanceof VariableInfo && oldInfo.declaredScope === this.scope)
			return;
		this.scope.definitions.set(name, this.scope);
	}

	// 删除当前变量 及 对应作用域
	undefineVariable(name) {
		this.scope.definitions.delete(name);
	}

	// 判断 当前变量 是否被定义
	isVariableDefined(name) {
		const info = this.scope.definitions.get(name);
		if (info === undefined) return false;
		if (info instanceof VariableInfo) {
			return info.freeName === true;
		}
		return true;
	}

	// 返回 当前变量 对应的 作用域
	getVariableInfo(name) {
		const value = this.scope.definitions.get(name);
		if (value === undefined) {
			return name;
		} else {
			return value;
		}
	}

	// 设置变量
	setVariable(name, variableInfo) {
		if (typeof variableInfo === "string") {
			if (variableInfo === name) {
				this.scope.definitions.delete(name);
			} else {
				this.scope.definitions.set(
					name,
					new VariableInfo(this.scope, variableInfo, undefined)
				);
			}
		} else {
			this.scope.definitions.set(name, variableInfo);
		}
	}

	// 分析 注释
	parseCommentOptions(range) {
		const comments = this.getComments(range);
		if (comments.length === 0) {
			return EMPTY_COMMENT_OPTIONS;
		}
		let options = {};
		let errors = [];
		for (const comment of comments) {
			const { value } = comment;
			if (value && webpackCommentRegExp.test(value)) {
				// try compile only if webpack options comment is present
				try {
					const val = vm.runInNewContext(`(function(){return {${value}};})()`);
					Object.assign(options, val);
				} catch (e) {
					e.comment = comment;
					errors.push(e);
				}
			}
		}
		return { options, errors };
	}

	/**
	 * @param {MemberExpressionNode} expression a member expression
	 * @returns {{ members: string[], object: ExpressionNode | SuperNode }} member names (reverse order) and remaining object
	 */
	extractMemberExpressionChain(expression) {
		/** @type {AnyNode} */
		let expr = expression;
		const members = [];
		while (expr.type === "MemberExpression") {
			if (expr.computed) {
				if (expr.property.type !== "Literal") break;
				members.push(`${expr.property.value}`);
			} else {
				if (expr.property.type !== "Identifier") break;
				members.push(expr.property.name);
			}
			expr = expr.object;
		}
		return {
			members,
			object: expr
		};
	}

	/**
	 * @param {string} varName variable name
	 * @returns {{name: string, info: VariableInfo | string}} name of the free variable and variable info for that
	 */
	getFreeInfoFromVariable(varName) {
		const info = this.getVariableInfo(varName);
		let name;
		if (info instanceof VariableInfo) {
			name = info.freeName;
			if (typeof name !== "string") return undefined;
		} else if (typeof info !== "string") {
			return undefined;
		} else {
			name = info;
		}
		return { info, name };
	}

	/** @typedef {{ type: "call", call: CallExpressionNode, calleeName: string, rootInfo: string | VariableInfo, getCalleeMembers: () => string[], name: string, getMembers: () => string[]}} CallExpressionInfo */
	/** @typedef {{ type: "expression", rootInfo: string | VariableInfo, name: string, getMembers: () => string[]}} ExpressionExpressionInfo */

	/**
	 * @param {MemberExpressionNode} expression a member expression
	 * @param {number} allowedTypes which types should be returned, presented in bit mask
	 * @returns {CallExpressionInfo | ExpressionExpressionInfo | undefined} expression info
	 */
	// 从 表达式 中 返回 成员表达式信息
	getMemberExpressionInfo(expression, allowedTypes) {
		const { object, members } = this.extractMemberExpressionChain(expression);
		switch (object.type) {
			case "CallExpression": {
				if ((allowedTypes & ALLOWED_MEMBER_TYPES_CALL_EXPRESSION) === 0)
					return undefined;
				let callee = object.callee;
				let rootMembers = EMPTY_ARRAY;
				if (callee.type === "MemberExpression") {
					({ object: callee, members: rootMembers } =
						this.extractMemberExpressionChain(callee));
				}
				const rootName = getRootName(callee);
				if (!rootName) return undefined;
				const result = this.getFreeInfoFromVariable(rootName);
				if (!result) return undefined;
				const { info: rootInfo, name: resolvedRoot } = result;
				const calleeName = objectAndMembersToName(resolvedRoot, rootMembers);
				return {
					type: "call",
					call: object,
					calleeName,
					rootInfo,
					getCalleeMembers: memoize(() => rootMembers.reverse()),
					name: objectAndMembersToName(`${calleeName}()`, members),
					getMembers: memoize(() => members.reverse())
				};
			}
			case "Identifier":
			case "MetaProperty":
			case "ThisExpression": {
				if ((allowedTypes & ALLOWED_MEMBER_TYPES_EXPRESSION) === 0)
					return undefined;
				const rootName = getRootName(object);
				if (!rootName) return undefined;

				const result = this.getFreeInfoFromVariable(rootName);
				if (!result) return undefined;
				const { info: rootInfo, name: resolvedRoot } = result;
				return {
					type: "expression",
					name: objectAndMembersToName(resolvedRoot, members),
					rootInfo,
					getMembers: memoize(() => members.reverse())
				};
			}
		}
	}

	/**
	 * @param {MemberExpressionNode} expression an expression
	 * @returns {{ name: string, rootInfo: ExportedVariableInfo, getMembers: () => string[]}} name info
	 */
	getNameForExpression(expression) {
		return this.getMemberExpressionInfo(
			expression,
			ALLOWED_MEMBER_TYPES_EXPRESSION
		);
	}

	// 运行 acorn.parse 返回 ast
	static _parse(code, options) {
		const type = options ? options.sourceType : "module";
		/** @type {AcornOptions} */
		const parserOptions = {
			...defaultParserOptions,
			allowReturnOutsideFunction: type === "script",
			...options,
			sourceType: type === "auto" ? "module" : type
		};

		/** @type {AnyNode} */
		let ast;
		let error;
		let threw = false;
		try {
			ast = /** @type {AnyNode} */ (parser.parse(code, parserOptions));
		} catch (e) {
			error = e;
			threw = true;
		}

		if (threw && type === "auto") {
			parserOptions.sourceType = "script";
			if (!("allowReturnOutsideFunction" in options)) {
				parserOptions.allowReturnOutsideFunction = true;
			}
			if (Array.isArray(parserOptions.onComment)) {
				parserOptions.onComment.length = 0;
			}
			try {
				ast = /** @type {AnyNode} */ (parser.parse(code, parserOptions));
				threw = false;
			} catch (e) {
				// we use the error from first parse try
				// so nothing to do here
			}
		}

		if (threw) {
			throw error;
		}

		return /** @type {ProgramNode} */ (ast);
	}
}

module.exports = JavascriptParser;
module.exports.ALLOWED_MEMBER_TYPES_ALL = ALLOWED_MEMBER_TYPES_ALL;
module.exports.ALLOWED_MEMBER_TYPES_EXPRESSION =
	ALLOWED_MEMBER_TYPES_EXPRESSION;
module.exports.ALLOWED_MEMBER_TYPES_CALL_EXPRESSION =
	ALLOWED_MEMBER_TYPES_CALL_EXPRESSION;
