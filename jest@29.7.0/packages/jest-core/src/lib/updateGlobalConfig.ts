import type {Config} from '@jest/types';
import {replacePathSepForRegex} from 'jest-regex-util';
import type {AllowedConfigOptions} from 'jest-watcher';

type ExtraConfigOptions = Partial<
  Pick<Config.GlobalConfig, 'noSCM' | 'passWithNoTests'>
>;

// 根据 选项 更新 GlobalConfig
export default function updateGlobalConfig(
  globalConfig: Config.GlobalConfig,
  options: AllowedConfigOptions & ExtraConfigOptions = {},
): Config.GlobalConfig {
  const newConfig: Config.GlobalConfig = {...globalConfig};

  if (options.mode === 'watch') {
    newConfig.watch = true;
    newConfig.watchAll = false;
  } else if (options.mode === 'watchAll') {
    newConfig.watch = false;
    newConfig.watchAll = true;
  }

  if (options.testNamePattern !== undefined) {
    newConfig.testNamePattern = options.testNamePattern || '';
  }

  if (options.testPathPattern !== undefined) {
    newConfig.testPathPattern =
      replacePathSepForRegex(options.testPathPattern) || '';
  }

  newConfig.onlyChanged =
    !newConfig.watchAll &&
    !newConfig.testNamePattern &&
    !newConfig.testPathPattern;

  if (typeof options.bail === 'boolean') {
    newConfig.bail = options.bail ? 1 : 0;
  } else if (options.bail !== undefined) {
    newConfig.bail = options.bail;
  }

  if (options.changedSince !== undefined) {
    newConfig.changedSince = options.changedSince;
  }

  if (options.collectCoverage !== undefined) {
    newConfig.collectCoverage = options.collectCoverage || false;
  }

  if (options.collectCoverageFrom !== undefined) {
    newConfig.collectCoverageFrom = options.collectCoverageFrom;
  }

  if (options.coverageDirectory !== undefined) {
    newConfig.coverageDirectory = options.coverageDirectory;
  }

  if (options.coverageReporters !== undefined) {
    newConfig.coverageReporters = options.coverageReporters;
  }

  if (options.findRelatedTests !== undefined) {
    newConfig.findRelatedTests = options.findRelatedTests;
  }

  if (options.nonFlagArgs !== undefined) {
    newConfig.nonFlagArgs = options.nonFlagArgs;
  }

  if (options.noSCM) {
    newConfig.noSCM = true;
  }

  if (options.notify !== undefined) {
    newConfig.notify = options.notify || false;
  }

  if (options.notifyMode !== undefined) {
    newConfig.notifyMode = options.notifyMode;
  }

  if (options.onlyFailures !== undefined) {
    newConfig.onlyFailures = options.onlyFailures || false;
  }

  if (options.passWithNoTests !== undefined) {
    newConfig.passWithNoTests = true;
  }

  if (options.reporters !== undefined) {
    newConfig.reporters = options.reporters;
  }

  if (options.updateSnapshot !== undefined) {
    newConfig.updateSnapshot = options.updateSnapshot;
  }

  if (options.verbose !== undefined) {
    newConfig.verbose = options.verbose || false;
  }

  return Object.freeze(newConfig);
}
