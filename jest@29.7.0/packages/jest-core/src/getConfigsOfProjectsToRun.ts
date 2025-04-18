import type {Config} from '@jest/types';
import getProjectDisplayName from './getProjectDisplayName';

// 筛选 项目配置
export default function getConfigsOfProjectsToRun(
  projectConfigs: Array<Config.ProjectConfig>,
  opts: {
    ignoreProjects: Array<string> | undefined;
    selectProjects: Array<string> | undefined;
  },
): Array<Config.ProjectConfig> {
  const projectFilter = createProjectFilter(opts);
  return projectConfigs.filter(config => {
    const name = getProjectDisplayName(config);
    return projectFilter(name);
  });
}

// 创建项目筛选器
function createProjectFilter(opts: {
  ignoreProjects: Array<string> | undefined;
  selectProjects: Array<string> | undefined;
}) {
  const {selectProjects, ignoreProjects} = opts;

  const always = () => true;

  const selected = selectProjects
    ? (name: string | undefined) => name && selectProjects.includes(name)
    : always;

  const notIgnore = ignoreProjects
    ? (name: string | undefined) => !(name && ignoreProjects.includes(name))
    : always;

  function test(name: string | undefined) {
    return selected(name) && notIgnore(name);
  }

  return test;
}
