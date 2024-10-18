"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = loader;
exports.raw = void 0;

var _path = _interopRequireDefault(require("path"));

var _loaderUtils = require("loader-utils");

var _schemaUtils = require("schema-utils");

var _mimeTypes = _interopRequireDefault(require("mime-types"));

var _normalizeFallback = _interopRequireDefault(require("./utils/normalizeFallback"));

var _options = _interopRequireDefault(require("./options.json"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// 判断当前文件是否需要进行转换
// 默认转换
function shouldTransform(limit, size) {
  // 字段limit是boolean时 返回当前boolean
  if (typeof limit === 'boolean') {
    return limit;
  }

  // 当文件size不超出限制时
  if (typeof limit === 'string') {
    return size <= parseInt(limit, 10);
  }
  if (typeof limit === 'number') {
    return size <= limit;
  }

  // 默认转换
  return true;
}

// 返回文件类型
function getMimetype(mimetype, resourcePath) {
  if (typeof mimetype === 'boolean') {
    if (mimetype) {
      const resolvedMimeType = _mimeTypes.default.contentType(_path.default.extname(resourcePath));

      if (!resolvedMimeType) {
        return '';
      }

      return resolvedMimeType.replace(/;\s+charset/i, ';charset');
    }

    return '';
  }

  if (typeof mimetype === 'string') {
    return mimetype;
  }

  const resolvedMimeType = _mimeTypes.default.contentType(_path.default.extname(resourcePath));

  if (!resolvedMimeType) {
    return '';
  }

  return resolvedMimeType.replace(/;\s+charset/i, ';charset');
}

// 返回编码方式 默认base64
function getEncoding(encoding) {
  if (typeof encoding === 'boolean') {
    return encoding ? 'base64' : '';
  }

  if (typeof encoding === 'string') {
    return encoding;
  }

  return 'base64';
}

// 按照特定编码 返回编码后的文件
function getEncodedData(generator, mimetype, encoding, content, resourcePath) {
  if (generator) {
    return generator(content, mimetype, encoding, resourcePath);
  }

  return `data:${mimetype}${encoding ? `;${encoding}` : ''},${content.toString( // eslint-disable-next-line no-undefined
  encoding || undefined)}`;
}

// 将文件作为 data URI 内联到 bundle 中
function loader(content) {
  // 获取当前Loader Options
  // 该选项注册在Webpack.options Module.Rule.options中
  const options = (0, _loaderUtils.getOptions)(this) || {};

  // 验证
  (0, _schemaUtils.validate)(_options.default, options, {
    name: 'URL Loader',
    baseDataPath: 'options'
  }); // No limit or within the specified limit

  /**
   * 当当前文件需要进行转换时
   * 1. limit = true
   * 2. 文件size 不超过限制
   */
  if (shouldTransform(options.limit, content.length)) {
    const {
      resourcePath
    } = this;

    // 文件类型
    const mimetype = getMimetype(options.mimetype, resourcePath);
    // 编码类型
    const encoding = getEncoding(options.encoding);

    if (typeof content === 'string') {
      // eslint-disable-next-line no-param-reassign
      content = Buffer.from(content);
    }

    // 编码后的数据
    const encodedData = getEncodedData(options.generator, mimetype, encoding, content, resourcePath);

    // 模块导出方式 
    // 默认esm
    const esModule = typeof options.esModule !== 'undefined' ? options.esModule : true;

    // 导出模块
    return `${esModule ? 'export default' : 'module.exports ='} ${JSON.stringify(encodedData)}`;
  }

  const {
    loader: fallbackLoader,
    options: fallbackOptions
  } = (0, _normalizeFallback.default)(options.fallback, options); // Require the fallback.
  // eslint-disable-next-line global-require, import/no-dynamic-require

  // 加载file-loader
  const fallback = require(fallbackLoader); 

  // 上下文
  const fallbackLoaderContext = Object.assign({}, this, {
    query: fallbackOptions
  });
  return fallback.call(fallbackLoaderContext, content);
}

const raw = true;
exports.raw = raw;