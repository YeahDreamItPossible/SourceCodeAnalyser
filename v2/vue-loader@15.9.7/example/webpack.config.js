const path = require('path')
const VueLoaderPlugin = require('../lib/plugin')

module.exports = {
  mode: 'development',
  entry: path.resolve(__dirname, './main.js'),
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
    publicPath: '/dist/'
  },
  // devServer: {
  //   stats: "minimal",
  //   contentBase: __dirname
  // },
  module: {
    rules: [
      // { loader: require.resolve('./debugger') },
      {
        test: /\.vue$/,
        loader: 'vue-loader'
      },
      // example to apply loader to a custom block without lang="xxx"
      // this rule applies to <foo> blocks
      {
        resourceQuery: /blockType=foo/,
        loader: 'babel-loader'
      },
      // example configuring preprocessor for <template lang="pug">
      // example configuring CSS Modules
      {
        test: /\.css$/,
        oneOf: [
          // this applies to <style module>
          {
            resourceQuery: /module/,
            use: [
              'vue-style-loader',
              {
                loader: 'css-loader',
                options: {
                  modules: true,
                  localIdentName: '[local]_[hash:base64:8]'
                }
              }
            ]
          },
          // this applies to <style> or <style scoped>
          {
            use: [
              'vue-style-loader',
              'css-loader'
            ]
          }
        ]
      },
      // exmaple configration for <style lang="scss">
    ]
  },
  resolveLoader: {
    alias: {
      'vue-loader': require.resolve('../lib')
    }
  },
  plugins: [
    // new VueLoaderPlugin()
  ]
}
