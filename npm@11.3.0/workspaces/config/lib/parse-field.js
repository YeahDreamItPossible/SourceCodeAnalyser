// Parse a field, coercing it to the best type available.
const typeDefs = require('./type-defs.js')
const envReplace = require('./env-replace.js')
const { resolve } = require('node:path')

const { parse: umaskParse } = require('./umask.js')

// 该函数 `parseField` 用于解析一个字段，并将其转换为最合适的数据类型。以下是对该函数的逐行解释：

// 定义函数 parseField，接收四个参数：
// f: 待解析的字段值，可以是字符串或数组
// key: 字段的键名
// opts: 包含解析所需配置信息的对象，如平台信息、类型定义、用户主目录路径和环境变量等
// listElement: 布尔值，指示当前字段是否为列表元素，默认为 false
const parseField = (f, key, opts, listElement = false) => {
  // 检查 f 是否既不是字符串也不是数组，如果是，则直接返回 f，因为不需要进行解析转换
  if (typeof f !== 'string' && !Array.isArray(f)) {
    return f
  }

  // 从 opts 对象中解构出所需的配置信息
  const { platform, types, home, env } = opts

  // 将 types[key] 转换为数组，并使用 Set 去重，得到一个包含字段可能类型的集合
  const typeList = new Set([].concat(types[key]))
  // 检查类型集合中是否包含路径类型
  const isPath = typeList.has(typeDefs.path.type)
  // 检查类型集合中是否包含布尔类型
  const isBool = typeList.has(typeDefs.Boolean.type)
  // 检查类型集合中是否包含字符串类型或路径类型（路径类型也属于字符串类型的一种特殊情况）
  const isString = isPath || typeList.has(typeDefs.String.type)
  // 检查类型集合中是否包含掩码类型
  const isUmask = typeList.has(typeDefs.Umask.type)
  // 检查类型集合中是否包含数字类型
  const isNumber = typeList.has(typeDefs.Number.type)
  // 检查类型集合中是否包含数组类型，并且当前字段不是列表元素
  const isList = !listElement && typeList.has(Array)
  // 检查类型集合中是否包含日期类型
  const isDate = typeList.has(typeDefs.Date.type)

  // 如果 f 是数组
  if (Array.isArray(f)) {
    // 如果不是列表类型，则直接返回 f；否则，递归调用 parseField 函数处理数组中的每个元素
    return !isList ? f : f.map(field => parseField(field, key, opts, true))
  }

  // 执行到这里说明 f 是字符串，去除字符串两端的空白字符
  f = f.trim()

  // 列表类型在环境变量中使用双换行符分隔
  // 通常单换行符就足够了，但证书配置可能包含换行符和多个条目
  if (isList) {
    // 将字符串按双换行符分割成数组，并递归调用 parseField 函数处理
    return parseField(f.split('\n\n'), key, opts)
  }

  // 对于布尔类型，如果输入字符串为空，则视为 true
  if (isBool && !isString && f === '') {
    return true
  }

  // 对于非字符串、非路径和非数字类型，解析特殊字符串值
  if (!isString && !isPath && !isNumber) {
    switch (f) {
      case 'true': return true
      case 'false': return false
      case 'null': return null
      case 'undefined': return undefined
    }
  }

  // 使用环境变量替换字符串中的占位符
  f = envReplace(f, env)

  // 如果是日期类型，将字符串转换为 Date 对象
  if (isDate) {
    return new Date(f)
  }

  // 如果是路径类型
  if (isPath) {
    // 根据不同的平台定义匹配用户主目录路径的正则表达式
    const homePattern = platform === 'win32' ? /^~(\/|\\)/ : /^~\//
    // 如果字符串以 ~/ 或 ~\（Windows 平台）开头，并且提供了用户主目录路径
    if (homePattern.test(f) && home) {
      // 将 ~ 替换为用户主目录路径，并解析为绝对路径
      f = resolve(home, f.slice(2))
    } else {
      // 否则，直接解析为绝对路径
      f = resolve(f)
    }
  }

  // 如果是掩码类型
  if (isUmask) {
    try {
      // 调用 umaskParse 函数解析掩码
      return umaskParse(f)
    } catch (er) {
      // 解析失败时，暂时返回原始字符串，后续验证时再发出警告
      return f
    }
  }

  // 如果是数字类型，并且字符串可以转换为数字
  if (isNumber && !isNaN(f)) {
    // 将字符串转换为数字
    f = +f
  }

  // 返回最终解析后的结果
  return f
}

// 总结：该函数 `parseField` 的主要作用是根据给定的字段类型定义，将输入的字段值（字符串或数组）转换为最合适的数据类型。
// 支持的类型包括布尔值、字符串、路径、掩码、数字、数组和日期等。在转换过程中，会处理环境变量替换、路径解析等操作。

module.exports = parseField
const parseField = (f, key, opts, listElement = false) => {
  if (typeof f !== 'string' && !Array.isArray(f)) {
    return f
  }

  const { platform, types, home, env } = opts

  // type can be array or a single thing.  coerce to array.
  const typeList = new Set([].concat(types[key]))
  const isPath = typeList.has(typeDefs.path.type)
  const isBool = typeList.has(typeDefs.Boolean.type)
  const isString = isPath || typeList.has(typeDefs.String.type)
  const isUmask = typeList.has(typeDefs.Umask.type)
  const isNumber = typeList.has(typeDefs.Number.type)
  const isList = !listElement && typeList.has(Array)
  const isDate = typeList.has(typeDefs.Date.type)

  if (Array.isArray(f)) {
    return !isList ? f : f.map(field => parseField(field, key, opts, true))
  }

  // now we know it's a string
  f = f.trim()

  // list types get put in the environment separated by double-\n
  // usually a single \n would suffice, but ca/cert configs can contain
  // line breaks and multiple entries.
  if (isList) {
    return parseField(f.split('\n\n'), key, opts)
  }

  // --foo is like --foo=true for boolean types
  if (isBool && !isString && f === '') {
    return true
  }

  // string types can be the string 'true', 'false', etc.
  // otherwise, parse these values out
  if (!isString && !isPath && !isNumber) {
    switch (f) {
      case 'true': return true
      case 'false': return false
      case 'null': return null
      case 'undefined': return undefined
    }
  }

  f = envReplace(f, env)

  if (isDate) {
    return new Date(f)
  }

  if (isPath) {
    const homePattern = platform === 'win32' ? /^~(\/|\\)/ : /^~\//
    if (homePattern.test(f) && home) {
      f = resolve(home, f.slice(2))
    } else {
      f = resolve(f)
    }
  }

  if (isUmask) {
    try {
      return umaskParse(f)
    } catch (er) {
      // let it warn later when we validate
      return f
    }
  }

  if (isNumber && !isNaN(f)) {
    f = +f
  }

  return f
}

module.exports = parseField
