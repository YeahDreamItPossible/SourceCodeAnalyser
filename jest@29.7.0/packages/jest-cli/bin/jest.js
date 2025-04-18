const importLocal = require('import-local');

// 执行 run 函数
if (!importLocal(__filename)) {
  if (process.env.NODE_ENV == null) {
    process.env.NODE_ENV = 'test';
  }

  require('..').run();
}
