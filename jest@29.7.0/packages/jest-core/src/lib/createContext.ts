import type {TestContext} from '@jest/test-result';
import type {Config} from '@jest/types';
import type {IHasteFS, IModuleMap} from 'jest-haste-map';
import Runtime from 'jest-runtime';

type HasteContext = {hasteFS: IHasteFS; moduleMap: IModuleMap};

export default function createContext(
  config: Config.ProjectConfig,
  {hasteFS, moduleMap}: HasteContext,
): TestContext {
  return {
    config,
    hasteFS,
    moduleMap,
    resolver: Runtime.createResolver(config, moduleMap),
  };
}
