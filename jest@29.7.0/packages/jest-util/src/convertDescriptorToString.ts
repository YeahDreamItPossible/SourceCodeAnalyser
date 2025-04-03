import type {Global} from '@jest/types';

// 将 test 中 测试名称 转换成 字符串
export default function convertDescriptorToString(
  descriptor: Global.BlockNameLike | undefined,
): string {
  switch (typeof descriptor) {
    case 'function':
      if (descriptor.name) {
        return descriptor.name;
      }
      break;

    case 'number':
    case 'undefined':
      return `${descriptor}`;

    case 'string':
      return descriptor;
  }

  throw new Error(
    `Invalid first argument, ${descriptor}. It must be a named class, named function, number, or string.`,
  );
}
