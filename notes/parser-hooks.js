const JavascriptParserHooks = `

// CompatibilityPlugin
// InnerGraphPlugin
preStatement(statement)

// InnerGraphPlugin
blockPreStatement(statement)

// InnerGraphPlugin
// SideEffectsFlagPlugin
statement(statement)

// JavascriptParser
// JavascriptMetaInfoPlugin
finish(ast, comments)
`