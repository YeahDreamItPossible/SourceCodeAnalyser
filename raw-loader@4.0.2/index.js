import { getOptions } from 'loader-utils';
import { validate } from 'schema-utils';

import schema from './options.json';

/**
 * 将资源文件转换成UTF-8字符串
 */
export default function rawLoader(source) {
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
  // 转义行分隔符和段落分隔符
  const json = JSON.stringify(source)
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

  const esModule =
    typeof options.esModule !== 'undefined' ? options.esModule : true;

  return `${esModule ? 'export default' : 'module.exports ='} ${json};`;
}
