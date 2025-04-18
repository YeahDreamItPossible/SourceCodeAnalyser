import chalk = require('chalk');
import type {Config} from '@jest/types';
import {ChangedFilesPromise, getChangedFilesForRoots} from 'jest-changed-files';
import {formatExecError} from 'jest-message-util';

// 尝试根据当前存储库中哪些文件已更改来确定要运行哪些测试
export default function getChangedFilesPromise(
  globalConfig: Config.GlobalConfig,
  configs: Array<Config.ProjectConfig>,
): ChangedFilesPromise | undefined {
  if (globalConfig.onlyChanged) {
    const allRootsForAllProjects = configs.reduce<Array<string>>(
      (roots, config) => {
        if (config.roots) {
          roots.push(...config.roots);
        }
        return roots;
      },
      [],
    );
    return getChangedFilesForRoots(allRootsForAllProjects, {
      changedSince: globalConfig.changedSince,
      lastCommit: globalConfig.lastCommit,
      withAncestor: globalConfig.changedFilesWithAncestor,
    }).catch(e => {
      const message = formatExecError(e, configs[0], {noStackTrace: true})
        .split('\n')
        .filter(line => !line.includes('Command failed:'))
        .join('\n');

      console.error(chalk.red(`\n\n${message}`));

      process.exit(1);
    });
  }

  return undefined;
}
