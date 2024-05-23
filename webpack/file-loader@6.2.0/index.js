"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = loader;
exports.raw = void 0;

var _path = _interopRequireDefault(require("path"));

var _loaderUtils = require("loader-utils");

var _schemaUtils = require("schema-utils");

var _options = _interopRequireDefault(require("./options.json"));

var _utils = require("./utils");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
/**
 * 逗号分隔符
 * 对它的每个操作对象求值(从左到右) 然后返回最后一个操作对象的值
 * (0, fn)() 改变fn的this绑定
 */

// 将文件按照特定格式输出到特定目录中
function loader(content) {
  // 获取当前Loader options
  // 该选项注册在Webpack.Config Module.Rule.options中
  const options = (0, _loaderUtils.getOptions)(this);

  // 验证
  (0, _schemaUtils.validate)(_options.default, options, {
    name: 'File Loader',
    baseDataPath: 'options'
  });

  const context = options.context || this.rootContext;
  const name = options.name || '[contenthash].[ext]';

  // 返回文件路径
  // 如: ./src/images/cache.png?type=phone
  const url = (0, _loaderUtils.interpolateName)(this, name, {
    context,
    content,
    regExp: options.regExp
  });

  let outputPath = url;

  // 指定文件路径
  if (options.outputPath) {
    if (typeof options.outputPath === 'function') {
      outputPath = options.outputPath(url, this.resourcePath, context);
    } else {
      outputPath = _path.default.posix.join(options.outputPath, url);
    }
  }

  let publicPath = `__webpack_public_path__ + ${JSON.stringify(outputPath)}`;

  // 公共前缀
  if (options.publicPath) {
    if (typeof options.publicPath === 'function') {
      publicPath = options.publicPath(url, this.resourcePath, context);
    } else {
      publicPath = `${options.publicPath.endsWith('/') ? options.publicPath : `${options.publicPath}/`}${url}`;
    }

    publicPath = JSON.stringify(publicPath);
  }

  // 自定义转化公共路径
  if (options.postTransformPublicPath) {
    publicPath = options.postTransformPublicPath(publicPath);
  }

  // 调用loaderContext.emitFile
  // 缓存到NormalModule.buildInfo.assets和NormalModule.buildInfo.assetsInfo中
  if (typeof options.emitFile === 'undefined' || options.emitFile) {
    const assetInfo = {};

    if (typeof name === 'string') {
      let normalizedName = name;
      const idx = normalizedName.indexOf('?');

      if (idx >= 0) {
        normalizedName = normalizedName.substr(0, idx);
      }

      const isImmutable = /\[([^:\]]+:)?(hash|contenthash)(:[^\]]+)?]/gi.test(normalizedName);

      if (isImmutable === true) {
        assetInfo.immutable = true;
      }
    }

    assetInfo.sourceFilename = (0, _utils.normalizePath)(_path.default.relative(this.rootContext, this.resourcePath));

    // 缓存到NormalModule中 
    // 在编译结束后 将文件按照特定格式输出特定目录中
    this.emitFile(outputPath, content, null, assetInfo);
  }

  // 模块导出方式 
  // 默认esm
  const esModule = typeof options.esModule !== 'undefined' ? options.esModule : true;

  // 导出模块
  return `${esModule ? 'export default' : 'module.exports ='} ${publicPath};`;
}

const raw = true;
exports.raw = raw;