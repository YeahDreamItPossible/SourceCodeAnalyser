import type {Config} from '@jest/types';

// 返回 项目显示名称
export default function getProjectDisplayName(
  projectConfig: Config.ProjectConfig,
): string | undefined {
  return projectConfig.displayName?.name || undefined;
}
