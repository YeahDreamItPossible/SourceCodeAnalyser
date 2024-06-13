import { getOptions } from 'loader-utils';
import { validate } from 'schema-utils';

import schema from './options.json';

// 将 资源内容 转换成 字符串
export default function rawLoader(source) {
  // 获取当前Loader options
  // 该选项注册在Webpack.Config Module.Rule.options中
  const options = getOptions(this);

  // 验证选项是否符合webpack options要求
  validate(schema, options, {
    name: 'Raw Loader',
    baseDataPath: 'options',
  });

  /**
   * \u2028 行分隔符
   * \u2029 段落分隔符
   */
  // 序列化
  // 转义行分隔符和段落分隔符
  const json = JSON.stringify(source)
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

  // 模块导出方式 
  // 默认esm
  const esModule =
    typeof options.esModule !== 'undefined' ? options.esModule : true;

  // 导出模块
  return `${esModule ? 'export default' : 'module.exports ='} ${json};`;
}
