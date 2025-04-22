const { engines: { node: engines }, version } = require('../../package.json')
const npm = `v${version}`

// 验证引擎
module.exports = (process, getCli) => {
  const node = process.version

  // 版本 不支持
  const unsupportedMessage = `npm ${npm} does not support Node.js ${node}. This version of npm supports the following node versions: \`${engines}\`. You can find the latest version at https://nodejs.org/.`

  const brokenMessage = `ERROR: npm ${npm} is known not to run on Node.js ${node}.  This version of npm supports the following node versions: \`${engines}\`. You can find the latest version at https://nodejs.org/.`

  // coverage ignored because this is only hit in very unsupported node versions
  // and it's a best effort attempt to show something nice in those cases
  const syntaxErrorHandler = (err) => {
    if (err instanceof SyntaxError) {
      console.error(`${brokenMessage}\n\nERROR:`)
      console.error(err)
      return process.exit(1)
    }
    throw err
  }

  process.on('uncaughtException', syntaxErrorHandler)
  process.on('unhandledRejection', syntaxErrorHandler)

  const cli = getCli()
  return cli(process, {
    node,
    npm,
    engines,
    unsupportedMessage,
    off: () => {
      process.off('uncaughtException', syntaxErrorHandler)
      process.off('unhandledRejection', syntaxErrorHandler)
    },
  })
}
