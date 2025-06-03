import type {Config as ConfigTypes} from '@jest/types';

export {
  SearchSource,
  createTestScheduler,
  getVersion,
  runCLI,
} from '@jest/core';

export {run} from 'jest-cli';

export type Config = ConfigTypes.InitialOptions;
