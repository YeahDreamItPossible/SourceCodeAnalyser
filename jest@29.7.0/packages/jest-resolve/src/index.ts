import Resolver from './resolver';

export type {
  AsyncResolver,
  SyncResolver,
  PackageFilter,
  PathFilter,
  ResolverOptions,
} from './defaultResolver';
export type {
  FindNodeModuleConfig,
  ResolveModuleConfig,
  ResolverObject as JestResolver,
} from './resolver';
export type {PackageJSON} from './types';
export * from './utils';

export default Resolver;
