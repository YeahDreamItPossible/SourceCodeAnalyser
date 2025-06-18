"use strict";
var __extends = (this && this.__extends) || (function () {
  var extendStatics = function (d, b) {
    extendStatics = Object.setPrototypeOf ||
      ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
      function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
    return extendStatics(d, b);
  };
  return function (d, b) {
    if (typeof b !== "function" && b !== null)
      throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
    extendStatics(d, b);
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
  };
})();
var __assign = (this && this.__assign) || function () {
  __assign = Object.assign || function (t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
      s = arguments[i];
      for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
        t[p] = s[p];
    }
    return t;
  };
  return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
  function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
  return new (P || (P = Promise))(function (resolve, reject) {
    function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
    function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
    function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
    step((generator = generator.apply(thisArg, _arguments || [])).next());
  });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
  var _ = { label: 0, sent: function () { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
  return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function () { return this; }), g;
  function verb(n) { return function (v) { return step([n, v]); }; }
  function step(op) {
    if (f) throw new TypeError("Generator is already executing.");
    while (g && (g = 0, op[0] && (_ = 0)), _) try {
      if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
      if (y = 0, t) op = [op[0] & 2, t.value];
      switch (op[0]) {
        case 0: case 1: t = op; break;
        case 4: _.label++; return { value: op[1], done: false };
        case 5: _.label++; y = op[1]; op = [0]; continue;
        case 7: op = _.ops.pop(); _.trys.pop(); continue;
        default:
          if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
          if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
          if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
          if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
          if (t[2]) _.ops.pop();
          _.trys.pop(); continue;
      }
      op = body.call(thisArg, _);
    } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
    if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
  }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
  if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
    if (ar || !(i in from)) {
      if (!ar) ar = Array.prototype.slice.call(from, 0, i);
      ar[i] = from[i];
    }
  }
  return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
var nativeModule = require("module");
var path = require("path");
var url_1 = require("url");
var vm_1 = require("vm");
var cjs_module_lexer_1 = require("cjs-module-lexer");
var collect_v8_coverage_1 = require("collect-v8-coverage");
var fs = require("graceful-fs");
var slash = require("slash");
var stripBOM = require("strip-bom");
var transform_1 = require("@jest/transform");
var jest_haste_map_1 = require("jest-haste-map");
var jest_message_util_1 = require("jest-message-util");
var jest_regex_util_1 = require("jest-regex-util");
var jest_resolve_1 = require("jest-resolve");
var jest_snapshot_1 = require("jest-snapshot");
var jest_util_1 = require("jest-util");
var helpers_1 = require("./helpers");
var esmIsAvailable = typeof vm_1.SourceTextModule === 'function';
var dataURIRegex = /^data:(?<mime>text\/javascript|application\/json|application\/wasm)(?:;(?<encoding>charset=utf-8|base64))?,(?<code>.*)$/;
var defaultTransformOptions = {
  isInternalModule: false,
  supportsDynamicImport: esmIsAvailable,
  supportsExportNamespaceFrom: false,
  supportsStaticESM: false,
  supportsTopLevelAwait: false,
};
// These are modules that we know
// * are safe to require from the outside (not stateful, not prone to errors passing in instances from different realms), and
// * take sufficiently long to require to warrant an optimization.
// When required from the outside, they use the worker's require cache and are thus
// only loaded once per worker, not once per test file.
// Use /benchmarks/test-file-overhead to measure the impact.
// Note that this only applies when they are required in an internal context;
// users who require one of these modules in their tests will still get the module from inside the VM.
// Prefer listing a module here only if it is impractical to use the jest-resolve-outside-vm-option where it is required,
// e.g. because there are many require sites spread across the dependency graph.
var INTERNAL_MODULE_REQUIRE_OUTSIDE_OPTIMIZED_MODULES = new Set(['chalk']);
var JEST_RESOLVE_OUTSIDE_VM_OPTION = Symbol.for('jest-resolve-outside-vm-option');
var testTimeoutSymbol = Symbol.for('TEST_TIMEOUT_SYMBOL');
var retryTimesSymbol = Symbol.for('RETRY_TIMES');
var logErrorsBeforeRetrySymbol = Symbol.for('LOG_ERRORS_BEFORE_RETRY');
var NODE_MODULES = "".concat(path.sep, "node_modules").concat(path.sep);
var getModuleNameMapper = function (config) {
  if (Array.isArray(config.moduleNameMapper) &&
    config.moduleNameMapper.length) {
    return config.moduleNameMapper.map(function (_a) {
      var regex = _a[0], moduleName = _a[1];
      return ({
        moduleName: moduleName,
        regex: new RegExp(regex),
      });
    });
  }
  return null;
};
var isWasm = function (modulePath) { return modulePath.endsWith('.wasm'); };
var unmockRegExpCache = new WeakMap();
var EVAL_RESULT_VARIABLE = 'Object.<anonymous>';
var runtimeSupportsVmModules = typeof vm_1.SyntheticModule === 'function';
var supportsNodeColonModulePrefixInRequire = (function () {
  try {
    require('node:fs');
    return true;
  }
  catch (_a) {
    return false;
  }
})();
// 运行时
// 作用：
// 加载模块 并运行模块
var Runtime = /** @class */ (function () {
  function Runtime(config, environment, resolver, transformer, cacheFS, coverageOptions, testPath,
    // TODO: make mandatory in Jest 30
    globalConfig) {
    var _this = this;
    var _a, _b, _c;
    this._cacheFSBuffer = new Map();
    this.isTornDown = false;
    this._cacheFS = cacheFS;
    this._config = config;
    this._coverageOptions = coverageOptions;
    this._currentlyExecutingModulePath = '';
    this._environment = environment;
    this._globalConfig = globalConfig;
    this._explicitShouldMock = new Map();
    this._explicitShouldMockModule = new Map();
    this._internalModuleRegistry = new Map();
    this._isCurrentlyExecutingManualMock = null;
    this._mainModule = null;
    this._mockFactories = new Map();
    this._mockRegistry = new Map();
    this._moduleMockRegistry = new Map();
    this._moduleMockFactories = new Map();
    (0, jest_util_1.invariant)(this._environment.moduleMocker, '`moduleMocker` must be set on an environment when created');
    this._moduleMocker = this._environment.moduleMocker;
    this._isolatedModuleRegistry = null;
    this._isolatedMockRegistry = null;
    this._moduleRegistry = new Map();
    this._esmoduleRegistry = new Map();
    this._cjsNamedExports = new Map();
    this._esmModuleLinkingMap = new WeakMap();
    this._testPath = testPath;
    this._resolver = resolver;
    this._scriptTransformer = transformer;
    this._shouldAutoMock = config.automock;
    this._sourceMapRegistry = new Map();
    this._fileTransforms = new Map();
    this._fileTransformsMutex = new Map();
    this._virtualMocks = new Map();
    this._virtualModuleMocks = new Map();
    this.jestObjectCaches = new Map();
    this._mockMetaDataCache = new Map();
    this._shouldMockModuleCache = new Map();
    this._shouldUnmockTransitiveDependenciesCache = new Map();
    this._transitiveShouldMock = new Map();
    this._fakeTimersImplementation = config.fakeTimers.legacyFakeTimers
      ? this._environment.fakeTimers
      : this._environment.fakeTimersModern;
    this._unmockList = unmockRegExpCache.get(config);
    if (!this._unmockList && config.unmockedModulePathPatterns) {
      this._unmockList = new RegExp(config.unmockedModulePathPatterns.join('|'));
      unmockRegExpCache.set(config, this._unmockList);
    }
    var envExportConditions = (_c = (_b = (_a = this._environment).exportConditions) === null || _b === void 0 ? void 0 : _b.call(_a)) !== null && _c !== void 0 ? _c : [];
    this.esmConditions = Array.from(new Set(__spreadArray(['import', 'default'], envExportConditions, true)));
    this.cjsConditions = Array.from(new Set(__spreadArray(['require', 'default'], envExportConditions, true)));
    if (config.automock) {
      config.setupFiles.forEach(function (filePath) {
        if (filePath.includes(NODE_MODULES)) {
          var moduleID = _this._resolver.getModuleID(_this._virtualMocks, filePath, undefined,
            // shouldn't really matter, but in theory this will make sure the caching is correct
            {
              conditions: _this.unstable_shouldLoadAsEsm(filePath)
                ? _this.esmConditions
                : _this.cjsConditions,
            });
          _this._transitiveShouldMock.set(moduleID, false);
        }
      });
    }
    this.resetModules();
  }
  Runtime.createContext = function (config, options) {
    return __awaiter(this, void 0, void 0, function () {
      var instance, hasteMap;
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            (0, jest_util_1.createDirectory)(config.cacheDirectory);
            return [4 /*yield*/, Runtime.createHasteMap(config, {
              console: options.console,
              maxWorkers: options.maxWorkers,
              resetCache: !config.cache,
              watch: options.watch,
              watchman: options.watchman,
            })];
          case 1:
            instance = _a.sent();
            return [4 /*yield*/, instance.build()];
          case 2:
            hasteMap = _a.sent();
            return [2 /*return*/, {
              config: config,
              hasteFS: hasteMap.hasteFS,
              moduleMap: hasteMap.moduleMap,
              resolver: Runtime.createResolver(config, hasteMap.moduleMap),
            }];
        }
      });
    });
  };
  Runtime.createHasteMap = function (config, options) {
    var ignorePatternParts = __spreadArray(__spreadArray(__spreadArray([], config.modulePathIgnorePatterns, true), (options && options.watch ? config.watchPathIgnorePatterns : []), true), [
      config.cacheDirectory.startsWith(config.rootDir + path.sep) &&
      config.cacheDirectory,
    ], false).filter(Boolean);
    var ignorePattern = ignorePatternParts.length > 0
      ? new RegExp(ignorePatternParts.join('|'))
      : undefined;
    return jest_haste_map_1.default.create({
      cacheDirectory: config.cacheDirectory,
      computeSha1: config.haste.computeSha1,
      console: options === null || options === void 0 ? void 0 : options.console,
      dependencyExtractor: config.dependencyExtractor,
      enableSymlinks: config.haste.enableSymlinks,
      extensions: [jest_snapshot_1.EXTENSION].concat(config.moduleFileExtensions),
      forceNodeFilesystemAPI: config.haste.forceNodeFilesystemAPI,
      hasteImplModulePath: config.haste.hasteImplModulePath,
      hasteMapModulePath: config.haste.hasteMapModulePath,
      id: config.id,
      ignorePattern: ignorePattern,
      maxWorkers: (options === null || options === void 0 ? void 0 : options.maxWorkers) || 1,
      mocksPattern: (0, jest_regex_util_1.escapePathForRegex)("".concat(path.sep, "__mocks__").concat(path.sep)),
      platforms: config.haste.platforms || ['ios', 'android'],
      resetCache: options === null || options === void 0 ? void 0 : options.resetCache,
      retainAllFiles: config.haste.retainAllFiles || false,
      rootDir: config.rootDir,
      roots: config.roots,
      throwOnModuleCollision: config.haste.throwOnModuleCollision,
      useWatchman: options === null || options === void 0 ? void 0 : options.watchman,
      watch: options === null || options === void 0 ? void 0 : options.watch,
      workerThreads: options === null || options === void 0 ? void 0 : options.workerThreads,
    });
  };
  Runtime.createResolver = function (config, moduleMap) {
    return new jest_resolve_1.default(moduleMap, {
      defaultPlatform: config.haste.defaultPlatform,
      extensions: config.moduleFileExtensions.map(function (extension) { return ".".concat(extension); }),
      hasCoreModules: true,
      moduleDirectories: config.moduleDirectories,
      moduleNameMapper: getModuleNameMapper(config),
      modulePaths: config.modulePaths,
      platforms: config.haste.platforms,
      resolver: config.resolver,
      rootDir: config.rootDir,
    });
  };
  Runtime.runCLI = function () {
    return __awaiter(this, void 0, void 0, function () {
      return __generator(this, function (_a) {
        throw new Error('The jest-runtime CLI has been moved into jest-repl');
      });
    });
  };
  Runtime.getCLIOptions = function () {
    throw new Error('The jest-runtime CLI has been moved into jest-repl');
  };
  // 是否是 ESM
  Runtime.prototype.unstable_shouldLoadAsEsm = function (modulePath) {
    return (isWasm(modulePath) ||
      jest_resolve_1.default.unstable_shouldLoadAsEsm(modulePath, this._config.extensionsToTreatAsEsm));
  };
  // 返回 加载后的ES模块
  Runtime.prototype.loadEsmModule = function (modulePath_1) {
    return __awaiter(this, arguments, void 0, function (modulePath, query) {
      var cacheKey, registry, context, transformResolve_1, transformReject_1, wasm, core, transformedCode_1, module_1, module;
      var _this = this;
      if (query === void 0) { query = ''; }
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            cacheKey = modulePath + query;
            registry = this._isolatedModuleRegistry
              ? this._isolatedModuleRegistry
              : this._esmoduleRegistry;
            if (!this._fileTransformsMutex.has(cacheKey)) return [3 /*break*/, 2];
            return [4 /*yield*/, this._fileTransformsMutex.get(cacheKey)];
          case 1:
            _a.sent();
            _a.label = 2;
          case 2:
            if (!!registry.has(cacheKey)) return [3 /*break*/, 4];
            (0, jest_util_1.invariant)(typeof this._environment.getVmContext === 'function', 'ES Modules are only supported if your test environment has the `getVmContext` function');
            context = this._environment.getVmContext();
            (0, jest_util_1.invariant)(context, 'Test environment has been torn down');
            this._fileTransformsMutex.set(cacheKey, new Promise(function (resolve, reject) {
              transformResolve_1 = resolve;
              transformReject_1 = reject;
            }));
            (0, jest_util_1.invariant)(transformResolve_1 && transformReject_1, 'Promise initialization should be sync - please report this bug to Jest!');
            if (isWasm(modulePath)) {
              wasm = this._importWasmModule(this.readFileBuffer(modulePath), modulePath, context);
              registry.set(cacheKey, wasm);
              transformResolve_1();
              return [2 /*return*/, wasm];
            }
            // 内置模块
            if (this._resolver.isCoreModule(modulePath)) {
              core = this._importCoreModule(modulePath, context);
              registry.set(cacheKey, core);
              transformResolve_1();
              return [2 /*return*/, core];
            }
            return [4 /*yield*/, this.transformFileAsync(modulePath, {
              isInternalModule: false,
              supportsDynamicImport: true,
              supportsExportNamespaceFrom: true,
              supportsStaticESM: true,
              supportsTopLevelAwait: true,
            })];
          case 3:
            transformedCode_1 = _a.sent();
            try {
              if (modulePath.endsWith('.json')) {
                module_1 = new vm_1.SyntheticModule(['default'], function () {
                  var obj = JSON.parse(transformedCode_1);
                  // @ts-expect-error: TS doesn't know what `this` is
                  this.setExport('default', obj);
                }, { context: context, identifier: modulePath });
              }
              else {
                module_1 = new vm_1.SourceTextModule(transformedCode_1, {
                  context: context,
                  identifier: modulePath,
                  importModuleDynamically: function (specifier, referencingModule) {
                    return __awaiter(_this, void 0, void 0, function () {
                      var module;
                      return __generator(this, function (_a) {
                        switch (_a.label) {
                          case 0:
                            (0, jest_util_1.invariant)(runtimeSupportsVmModules, 'You need to run with a version of node that supports ES Modules in the VM API. See https://jestjs.io/docs/ecmascript-modules');
                            return [4 /*yield*/, this.resolveModule(specifier, referencingModule.identifier, referencingModule.context)];
                          case 1:
                            module = _a.sent();
                            return [2 /*return*/, this.linkAndEvaluateModule(module)];
                        }
                      });
                    });
                  },
                  initializeImportMeta: function (meta) {
                    meta.url = (0, url_1.pathToFileURL)(modulePath).href;
                    var jest = _this.jestObjectCaches.get(modulePath);
                    if (!jest) {
                      jest = _this._createJestObjectFor(modulePath);
                      _this.jestObjectCaches.set(modulePath, jest);
                    }
                    meta.jest = jest;
                  },
                });
              }
              (0, jest_util_1.invariant)(!registry.has(cacheKey), "Module cache already has entry ".concat(cacheKey, ". This is a bug in Jest, please report it!"));
              registry.set(cacheKey, module_1);
              transformResolve_1();
            }
            catch (error) {
              transformReject_1(error);
              throw error;
            }
            _a.label = 4;
          case 4:
            module = registry.get(cacheKey);
            (0, jest_util_1.invariant)(module, 'Module cache does not contain module. This is a bug in Jest, please open up an issue');
            return [2 /*return*/, module];
        }
      });
    });
  };
  // 解析模块
  Runtime.prototype.resolveModule = function (specifier, referencingIdentifier, context) {
    return __awaiter(this, void 0, void 0, function () {
      var registry, fromCache, globals, fromCache, match, mime, encoding, module, code_1, _a, path, query, resolved;
      var _this = this;
      return __generator(this, function (_b) {
        switch (_b.label) {
          case 0:
            if (this.isTornDown) {
              this._logFormattedReferenceError('You are trying to `import` a file after the Jest environment has been torn down.');
              process.exitCode = 1;
              // @ts-expect-error - exiting
              return [2 /*return*/];
            }
            registry = this._isolatedModuleRegistry
              ? this._isolatedModuleRegistry
              : this._esmoduleRegistry;
            if (specifier === '@jest/globals') {
              fromCache = registry.get('@jest/globals');
              if (fromCache) {
                return [2 /*return*/, fromCache];
              }
              globals = this.getGlobalsForEsm(referencingIdentifier, context);
              registry.set('@jest/globals', globals);
              return [2 /*return*/, globals];
            }
            if (!specifier.startsWith('data:')) return [3 /*break*/, 5];
            return [4 /*yield*/, this._shouldMockModule(referencingIdentifier, specifier, this._explicitShouldMockModule)];
          case 1:
            if (_b.sent()) {
              return [2 /*return*/, this.importMock(referencingIdentifier, specifier, context)];
            }
            fromCache = registry.get(specifier);
            if (fromCache) {
              return [2 /*return*/, fromCache];
            }
            match = specifier.match(dataURIRegex);
            if (!match || !match.groups) {
              throw new Error('Invalid data URI');
            }
            mime = match.groups.mime;
            encoding = match.groups.encoding;
            module = void 0;
            if (!(mime === 'application/wasm')) return [3 /*break*/, 3];
            if (!encoding) {
              throw new Error('Missing data URI encoding');
            }
            if (encoding !== 'base64') {
              throw new Error("Invalid data URI encoding: ".concat(encoding));
            }
            return [4 /*yield*/, this._importWasmModule(Buffer.from(match.groups.code, 'base64'), specifier, context)];
          case 2:
            module = _b.sent();
            return [3 /*break*/, 4];
          case 3:
            code_1 = match.groups.code;
            if (!encoding || encoding === 'charset=utf-8') {
              code_1 = decodeURIComponent(code_1);
            }
            else if (encoding === 'base64') {
              code_1 = Buffer.from(code_1, 'base64').toString();
            }
            else {
              throw new Error("Invalid data URI encoding: ".concat(encoding));
            }
            if (mime === 'application/json') {
              module = new vm_1.SyntheticModule(['default'], function () {
                var obj = JSON.parse(code_1);
                // @ts-expect-error: TS doesn't know what `this` is
                this.setExport('default', obj);
              }, { context: context, identifier: specifier });
            }
            else {
              module = new vm_1.SourceTextModule(code_1, {
                context: context,
                identifier: specifier,
                importModuleDynamically: function (specifier, referencingModule) {
                  return __awaiter(_this, void 0, void 0, function () {
                    var module;
                    return __generator(this, function (_a) {
                      switch (_a.label) {
                        case 0:
                          (0, jest_util_1.invariant)(runtimeSupportsVmModules, 'You need to run with a version of node that supports ES Modules in the VM API. See https://jestjs.io/docs/ecmascript-modules');
                          return [4 /*yield*/, this.resolveModule(specifier, referencingModule.identifier, referencingModule.context)];
                        case 1:
                          module = _a.sent();
                          return [2 /*return*/, this.linkAndEvaluateModule(module)];
                      }
                    });
                  });
                },
                initializeImportMeta: function (meta) {
                  // no `jest` here as it's not loaded in a file
                  meta.url = specifier;
                },
              });
            }
            _b.label = 4;
          case 4:
            registry.set(specifier, module);
            return [2 /*return*/, module];
          case 5:
            if (specifier.startsWith('file://')) {
              specifier = (0, url_1.fileURLToPath)(specifier);
            }
            _a = specifier.split('?'), path = _a[0], query = _a[1];
            return [4 /*yield*/, this._shouldMockModule(referencingIdentifier, path, this._explicitShouldMockModule)];
          case 6:
            if (_b.sent()) {
              return [2 /*return*/, this.importMock(referencingIdentifier, path, context)];
            }
            return [4 /*yield*/, this._resolveModule(referencingIdentifier, path)];
          case 7:
            resolved = _b.sent();
            if (
              // json files are modules when imported in modules
              resolved.endsWith('.json') ||
              this._resolver.isCoreModule(resolved) ||
              this.unstable_shouldLoadAsEsm(resolved)) {
              return [2 /*return*/, this.loadEsmModule(resolved, query)];
            }
            return [2 /*return*/, this.loadCjsAsEsm(referencingIdentifier, resolved, context)];
        }
      });
    });
  };
  // 关联并评估模块
  Runtime.prototype.linkAndEvaluateModule = function (module) {
    return __awaiter(this, void 0, void 0, function () {
      var _this = this;
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            if (this.isTornDown) {
              this._logFormattedReferenceError('You are trying to `import` a file after the Jest environment has been torn down.');
              process.exitCode = 1;
              return [2 /*return*/];
            }
            if (module.status === 'unlinked') {
              // since we might attempt to link the same module in parallel, stick the promise in a weak map so every call to
              // this method can await it
              this._esmModuleLinkingMap.set(module, module.link(function (specifier, referencingModule) {
                return _this.resolveModule(specifier, referencingModule.identifier, referencingModule.context);
              }));
            }
            return [4 /*yield*/, this._esmModuleLinkingMap.get(module)];
          case 1:
            _a.sent();
            if (!(module.status === 'linked')) return [3 /*break*/, 3];
            return [4 /*yield*/, module.evaluate()];
          case 2:
            _a.sent();
            _a.label = 3;
          case 3: return [2 /*return*/, module];
        }
      });
    });
  };
  // 加载模块(该方法不稳定)
  Runtime.prototype.unstable_importModule = function (from, moduleName) {
    return __awaiter(this, void 0, void 0, function () {
      var _a, path, query, modulePath, module;
      return __generator(this, function (_b) {
        switch (_b.label) {
          case 0:
            (0, jest_util_1.invariant)(runtimeSupportsVmModules, 'You need to run with a version of node that supports ES Modules in the VM API. See https://jestjs.io/docs/ecmascript-modules');
            _a = (moduleName !== null && moduleName !== void 0 ? moduleName : '').split('?'), path = _a[0], query = _a[1];
            return [4 /*yield*/, this._resolveModule(from, path)];
          case 1:
            modulePath = _b.sent();
            return [4 /*yield*/, this.loadEsmModule(modulePath, query)];
          case 2:
            module = _b.sent();
            return [2 /*return*/, this.linkAndEvaluateModule(module)];
        }
      });
    });
  };
  Runtime.prototype.loadCjsAsEsm = function (from, modulePath, context) {
    // CJS loaded via `import` should share cache with other CJS: https://github.com/nodejs/modules/issues/503
    var cjs = this.requireModuleOrMock(from, modulePath);
    var parsedExports = this.getExportsOfCjs(modulePath);
    var cjsExports = __spreadArray([], parsedExports, true).filter(function (exportName) {
      // we don't wanna respect any exports _named_ default as a named export
      if (exportName === 'default') {
        return false;
      }
      return Object.hasOwnProperty.call(cjs, exportName);
    });
    var module = new vm_1.SyntheticModule(__spreadArray(__spreadArray([], cjsExports, true), ['default'], false), function () {
      var _this = this;
      cjsExports.forEach(function (exportName) {
        // @ts-expect-error: TS doesn't know what `this` is
        _this.setExport(exportName, cjs[exportName]);
      });
      // @ts-expect-error: TS doesn't know what `this` is
      this.setExport('default', cjs);
    }, { context: context, identifier: modulePath });
    return evaluateSyntheticModule(module);
  };
  // 导入 被模拟的模块
  Runtime.prototype.importMock = function (from, moduleName, context) {
    return __awaiter(this, void 0, void 0, function () {
      var moduleID, invokedFactory_1, module;
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0: return [4 /*yield*/, this._resolver.getModuleIDAsync(this._virtualModuleMocks, from, moduleName, { conditions: this.esmConditions })];
          case 1:
            moduleID = _a.sent();
            if (this._moduleMockRegistry.has(moduleID)) {
              return [2 /*return*/, this._moduleMockRegistry.get(moduleID)];
            }
            if (!this._moduleMockFactories.has(moduleID)) return [3 /*break*/, 3];
            return [4 /*yield*/, this._moduleMockFactories.get(moduleID)()];
          case 2:
            invokedFactory_1 = _a.sent();
            module = new vm_1.SyntheticModule(Object.keys(invokedFactory_1), function () {
              var _this = this;
              Object.entries(invokedFactory_1).forEach(function (_a) {
                var key = _a[0], value = _a[1];
                // @ts-expect-error: TS doesn't know what `this` is
                _this.setExport(key, value);
              });
            }, { context: context, identifier: moduleName });
            this._moduleMockRegistry.set(moduleID, module);
            return [2 /*return*/, evaluateSyntheticModule(module)];
          case 3: throw new Error('Attempting to import a mock without a factory');
        }
      });
    });
  };
  Runtime.prototype.getExportsOfCjs = function (modulePath) {
    var _this = this;
    var _a, _b;
    var cachedNamedExports = this._cjsNamedExports.get(modulePath);
    if (cachedNamedExports) {
      return cachedNamedExports;
    }
    var transformedCode = (_b = (_a = this._fileTransforms.get(modulePath)) === null || _a === void 0 ? void 0 : _a.code) !== null && _b !== void 0 ? _b : this.readFile(modulePath);
    var _c = (0, cjs_module_lexer_1.parse)(transformedCode), exports = _c.exports, reexports = _c.reexports;
    var namedExports = new Set(exports);
    reexports.forEach(function (reexport) {
      if (_this._resolver.isCoreModule(reexport)) {
        var exports_1 = _this.requireModule(modulePath, reexport);
        if (exports_1 !== null && typeof exports_1 === 'object') {
          Object.keys(exports_1).forEach(namedExports.add, namedExports);
        }
      }
      else {
        var resolved = _this._resolveCjsModule(modulePath, reexport);
        var exports_2 = _this.getExportsOfCjs(resolved);
        exports_2.forEach(namedExports.add, namedExports);
      }
    });
    this._cjsNamedExports.set(modulePath, namedExports);
    return namedExports;
  };
  // 加载 cjs 模块
  Runtime.prototype.requireModule = function (from, moduleName, options, isRequireActual) {
    var _a;
    if (isRequireActual === void 0) { isRequireActual = false; }
    var isInternal = (_a = options === null || options === void 0 ? void 0 : options.isInternalModule) !== null && _a !== void 0 ? _a : false;
    var moduleID = this._resolver.getModuleID(this._virtualMocks, from, moduleName, { conditions: this.cjsConditions });
    var modulePath;
    // Some old tests rely on this mocking behavior. Ideally we'll change this
    // to be more explicit.
    var moduleResource = moduleName && this._resolver.getModule(moduleName);
    var manualMock = moduleName && this._resolver.getMockModule(from, moduleName);
    if (!(options === null || options === void 0 ? void 0 : options.isInternalModule) &&
      !isRequireActual &&
      !moduleResource &&
      manualMock &&
      manualMock !== this._isCurrentlyExecutingManualMock &&
      this._explicitShouldMock.get(moduleID) !== false) {
      modulePath = manualMock;
    }
    if (moduleName && this._resolver.isCoreModule(moduleName)) {
      return this._requireCoreModule(moduleName, supportsNodeColonModulePrefixInRequire);
    }
    if (!modulePath) {
      modulePath = this._resolveCjsModule(from, moduleName);
    }
    if (this.unstable_shouldLoadAsEsm(modulePath)) {
      // Node includes more info in the message
      var error = new Error("Must use import to load ES Module: ".concat(modulePath));
      error.code = 'ERR_REQUIRE_ESM';
      throw error;
    }
    var moduleRegistry;
    if (isInternal) {
      moduleRegistry = this._internalModuleRegistry;
    }
    else if (this._isolatedModuleRegistry) {
      moduleRegistry = this._isolatedModuleRegistry;
    }
    else {
      moduleRegistry = this._moduleRegistry;
    }
    var module = moduleRegistry.get(modulePath);
    if (module) {
      return module.exports;
    }
    // We must register the pre-allocated module object first so that any
    // circular dependencies that may arise while evaluating the module can
    // be satisfied.
    var localModule = {
      children: [],
      exports: {},
      filename: modulePath,
      id: modulePath,
      loaded: false,
      path: path.dirname(modulePath),
    };
    moduleRegistry.set(modulePath, localModule);
    try {
      this._loadModule(localModule, from, moduleName, modulePath, options, moduleRegistry);
    }
    catch (error) {
      moduleRegistry.delete(modulePath);
      throw error;
    }
    return localModule.exports;
  };
  // 加载内置模块
  Runtime.prototype.requireInternalModule = function (from, to) {
    var _a;
    if (to) {
      var require = ((_a = nativeModule.createRequire) !== null && _a !== void 0 ? _a : nativeModule.createRequireFromPath)(from);
      if (INTERNAL_MODULE_REQUIRE_OUTSIDE_OPTIMIZED_MODULES.has(to)) {
        return require(to);
      }
      var outsideJestVmPath = (0, helpers_1.decodePossibleOutsideJestVmPath)(to);
      if (outsideJestVmPath) {
        return require(outsideJestVmPath);
      }
    }
    return this.requireModule(from, to, {
      isInternalModule: true,
      supportsDynamicImport: esmIsAvailable,
      supportsExportNamespaceFrom: false,
      supportsStaticESM: false,
      supportsTopLevelAwait: false,
    });
  };
  Runtime.prototype.requireActual = function (from, moduleName) {
    return this.requireModule(from, moduleName, undefined, true);
  };
  Runtime.prototype.requireMock = function (from, moduleName) {
    var _a;
    var moduleID = this._resolver.getModuleID(this._virtualMocks, from, moduleName, { conditions: this.cjsConditions });
    if ((_a = this._isolatedMockRegistry) === null || _a === void 0 ? void 0 : _a.has(moduleID)) {
      return this._isolatedMockRegistry.get(moduleID);
    }
    else if (this._mockRegistry.has(moduleID)) {
      return this._mockRegistry.get(moduleID);
    }
    var mockRegistry = this._isolatedMockRegistry || this._mockRegistry;
    if (this._mockFactories.has(moduleID)) {
      // has check above makes this ok
      var module = this._mockFactories.get(moduleID)();
      mockRegistry.set(moduleID, module);
      return module;
    }
    var manualMockOrStub = this._resolver.getMockModule(from, moduleName);
    var modulePath = this._resolver.getMockModule(from, moduleName) ||
      this._resolveCjsModule(from, moduleName);
    var isManualMock = manualMockOrStub &&
      !this._resolver.resolveStubModuleName(from, moduleName);
    if (!isManualMock) {
      // If the actual module file has a __mocks__ dir sitting immediately next
      // to it, look to see if there is a manual mock for this file.
      //
      // subDir1/my_module.js
      // subDir1/__mocks__/my_module.js
      // subDir2/my_module.js
      // subDir2/__mocks__/my_module.js
      //
      // Where some other module does a relative require into each of the
      // respective subDir{1,2} directories and expects a manual mock
      // corresponding to that particular my_module.js file.
      var moduleDir = path.dirname(modulePath);
      var moduleFileName = path.basename(modulePath);
      var potentialManualMock = path.join(moduleDir, '__mocks__', moduleFileName);
      if (fs.existsSync(potentialManualMock)) {
        isManualMock = true;
        modulePath = potentialManualMock;
      }
    }
    if (isManualMock) {
      var localModule = {
        children: [],
        exports: {},
        filename: modulePath,
        id: modulePath,
        loaded: false,
        path: path.dirname(modulePath),
      };
      this._loadModule(localModule, from, moduleName, modulePath, undefined, mockRegistry);
      mockRegistry.set(moduleID, localModule.exports);
    }
    else {
      // Look for a real module to generate an automock from
      mockRegistry.set(moduleID, this._generateMock(from, moduleName));
    }
    return mockRegistry.get(moduleID);
  };
  // 加载模块
  Runtime.prototype._loadModule = function (localModule, from, moduleName, modulePath, options, moduleRegistry) {
    if (path.extname(modulePath) === '.json') {
      var text = stripBOM(this.readFile(modulePath));
      var transformedFile = this._scriptTransformer.transformJson(modulePath, this._getFullTransformationOptions(options), text);
      localModule.exports =
        this._environment.global.JSON.parse(transformedFile);
    }
    else if (path.extname(modulePath) === '.node') {
      localModule.exports = require(modulePath);
    }
    else {
      // Only include the fromPath if a moduleName is given. Else treat as root.
      var fromPath = moduleName ? from : null;
      this._execModule(localModule, options, moduleRegistry, fromPath, moduleName);
    }
    localModule.loaded = true;
  };
  Runtime.prototype._getFullTransformationOptions = function (options) {
    if (options === void 0) { options = defaultTransformOptions; }
    return __assign(__assign({}, options), this._coverageOptions);
  };
  // 加载真实模块 或者要模拟的模块
  Runtime.prototype.requireModuleOrMock = function (from, moduleName) {
    // this module is unmockable
    if (moduleName === '@jest/globals') {
      // @ts-expect-error: we don't care that it's not assignable to T
      return this.getGlobalsForCjs(from);
    }
    try {
      if (this._shouldMockCjs(from, moduleName, this._explicitShouldMock)) {
        return this.requireMock(from, moduleName);
      }
      else {
        return this.requireModule(from, moduleName);
      }
    }
    catch (e) {
      var moduleNotFound = jest_resolve_1.default.tryCastModuleNotFoundError(e);
      if (moduleNotFound) {
        if (moduleNotFound.siblingWithSimilarExtensionFound === null ||
          moduleNotFound.siblingWithSimilarExtensionFound === undefined) {
          moduleNotFound.hint = (0, helpers_1.findSiblingsWithFileExtension)(this._config.moduleFileExtensions, from, moduleNotFound.moduleName || moduleName);
          moduleNotFound.siblingWithSimilarExtensionFound = Boolean(moduleNotFound.hint);
        }
        moduleNotFound.buildMessage(this._config.rootDir);
        throw moduleNotFound;
      }
      throw e;
    }
  };
  Runtime.prototype.isolateModules = function (fn) {
    var _a, _b;
    if (this._isolatedModuleRegistry || this._isolatedMockRegistry) {
      throw new Error('isolateModules cannot be nested inside another isolateModules or isolateModulesAsync.');
    }
    this._isolatedModuleRegistry = new Map();
    this._isolatedMockRegistry = new Map();
    try {
      fn();
    }
    finally {
      // might be cleared within the callback
      (_a = this._isolatedModuleRegistry) === null || _a === void 0 ? void 0 : _a.clear();
      (_b = this._isolatedMockRegistry) === null || _b === void 0 ? void 0 : _b.clear();
      this._isolatedModuleRegistry = null;
      this._isolatedMockRegistry = null;
    }
  };
  Runtime.prototype.isolateModulesAsync = function (fn) {
    return __awaiter(this, void 0, void 0, function () {
      var _a, _b;
      return __generator(this, function (_c) {
        switch (_c.label) {
          case 0:
            if (this._isolatedModuleRegistry || this._isolatedMockRegistry) {
              throw new Error('isolateModulesAsync cannot be nested inside another isolateModulesAsync or isolateModules.');
            }
            this._isolatedModuleRegistry = new Map();
            this._isolatedMockRegistry = new Map();
            _c.label = 1;
          case 1:
            _c.trys.push([1, , 3, 4]);
            return [4 /*yield*/, fn()];
          case 2:
            _c.sent();
            return [3 /*break*/, 4];
          case 3:
            // might be cleared within the callback
            (_a = this._isolatedModuleRegistry) === null || _a === void 0 ? void 0 : _a.clear();
            (_b = this._isolatedMockRegistry) === null || _b === void 0 ? void 0 : _b.clear();
            this._isolatedModuleRegistry = null;
            this._isolatedMockRegistry = null;
            return [7 /*endfinally*/];
          case 4: return [2 /*return*/];
        }
      });
    });
  };
  // 重置所有的模块模拟
  Runtime.prototype.resetModules = function () {
    var _a, _b;
    (_a = this._isolatedModuleRegistry) === null || _a === void 0 ? void 0 : _a.clear();
    (_b = this._isolatedMockRegistry) === null || _b === void 0 ? void 0 : _b.clear();
    this._isolatedModuleRegistry = null;
    this._isolatedMockRegistry = null;
    this._mockRegistry.clear();
    this._moduleRegistry.clear();
    this._esmoduleRegistry.clear();
    this._fileTransformsMutex.clear();
    this._cjsNamedExports.clear();
    this._moduleMockRegistry.clear();
    this._cacheFS.clear();
    this._cacheFSBuffer.clear();
    if (this._coverageOptions.collectCoverage &&
      this._coverageOptions.coverageProvider === 'v8' &&
      this._v8CoverageSources) {
      this._v8CoverageSources = new Map(__spreadArray(__spreadArray([], this._v8CoverageSources, true), this._fileTransforms, true));
    }
    this._fileTransforms.clear();
    if (this._environment) {
      if (this._environment.global) {
        var envGlobal_1 = this._environment.global;
        Object.keys(envGlobal_1).forEach(function (key) {
          var globalMock = envGlobal_1[key];
          if (((typeof globalMock === 'object' && globalMock !== null) ||
            typeof globalMock === 'function') &&
            '_isMockFunction' in globalMock &&
            globalMock._isMockFunction === true) {
            globalMock.mockClear();
          }
        });
      }
      if (this._environment.fakeTimers) {
        this._environment.fakeTimers.clearAllTimers();
      }
    }
  };
  Runtime.prototype.collectV8Coverage = function () {
    return __awaiter(this, void 0, void 0, function () {
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            this._v8CoverageInstrumenter = new collect_v8_coverage_1.CoverageInstrumenter();
            this._v8CoverageSources = new Map();
            return [4 /*yield*/, this._v8CoverageInstrumenter.startInstrumenting()];
          case 1:
            _a.sent();
            return [2 /*return*/];
        }
      });
    });
  };
  Runtime.prototype.stopCollectingV8Coverage = function () {
    return __awaiter(this, void 0, void 0, function () {
      var _a;
      return __generator(this, function (_b) {
        switch (_b.label) {
          case 0:
            if (!this._v8CoverageInstrumenter || !this._v8CoverageSources) {
              throw new Error('You need to call `collectV8Coverage` first.');
            }
            _a = this;
            return [4 /*yield*/, this._v8CoverageInstrumenter.stopInstrumenting()];
          case 1:
            _a._v8CoverageResult =
              _b.sent();
            this._v8CoverageSources = new Map(__spreadArray(__spreadArray([], this._v8CoverageSources, true), this._fileTransforms, true));
            return [2 /*return*/];
        }
      });
    });
  };
  Runtime.prototype.getAllCoverageInfoCopy = function () {
    return (0, jest_util_1.deepCyclicCopy)(this._environment.global.__coverage__);
  };
  Runtime.prototype.getAllV8CoverageInfoCopy = function () {
    var _this = this;
    if (!this._v8CoverageResult || !this._v8CoverageSources) {
      throw new Error('You need to call `stopCollectingV8Coverage` first.');
    }
    return this._v8CoverageResult
      .filter(function (res) { return res.url.startsWith('file://'); })
      .map(function (res) { return (__assign(__assign({}, res), { url: (0, url_1.fileURLToPath)(res.url) })); })
      .filter(function (res) {
        // TODO: will this work on windows? It might be better if `shouldInstrument` deals with it anyways
        return res.url.startsWith(_this._config.rootDir) &&
          (0, transform_1.shouldInstrument)(res.url, _this._coverageOptions, _this._config,
                /* loadedFilenames */ Array.from(_this._v8CoverageSources.keys()));
      })
      .map(function (result) {
        var transformedFile = _this._v8CoverageSources.get(result.url);
        return {
          codeTransformResult: transformedFile,
          result: result,
        };
      });
  };
  Runtime.prototype.getSourceMaps = function () {
    return this._sourceMapRegistry;
  };
  Runtime.prototype.setMock = function (from, moduleName, mockFactory, options) {
    if (options === null || options === void 0 ? void 0 : options.virtual) {
      var mockPath = this._resolver.getModulePath(from, moduleName);
      this._virtualMocks.set(mockPath, true);
    }
    var moduleID = this._resolver.getModuleID(this._virtualMocks, from, moduleName, { conditions: this.cjsConditions });
    this._explicitShouldMock.set(moduleID, true);
    this._mockFactories.set(moduleID, mockFactory);
  };
  Runtime.prototype.setModuleMock = function (from, moduleName, mockFactory, options) {
    if (options === null || options === void 0 ? void 0 : options.virtual) {
      var mockPath = this._resolver.getModulePath(from, moduleName);
      this._virtualModuleMocks.set(mockPath, true);
    }
    var moduleID = this._resolver.getModuleID(this._virtualModuleMocks, from, moduleName, { conditions: this.esmConditions });
    this._explicitShouldMockModule.set(moduleID, true);
    this._moduleMockFactories.set(moduleID, mockFactory);
  };
  Runtime.prototype.restoreAllMocks = function () {
    this._moduleMocker.restoreAllMocks();
  };
  Runtime.prototype.resetAllMocks = function () {
    this._moduleMocker.resetAllMocks();
  };
  // 清空所有的模拟
  Runtime.prototype.clearAllMocks = function () {
    this._moduleMocker.clearAllMocks();
  };
  Runtime.prototype.teardown = function () {
    var _a;
    this.restoreAllMocks();
    this.resetModules();
    this._internalModuleRegistry.clear();
    this._mainModule = null;
    this._mockFactories.clear();
    this._moduleMockFactories.clear();
    this._mockMetaDataCache.clear();
    this._shouldMockModuleCache.clear();
    this._shouldUnmockTransitiveDependenciesCache.clear();
    this._explicitShouldMock.clear();
    this._explicitShouldMockModule.clear();
    this._transitiveShouldMock.clear();
    this._virtualMocks.clear();
    this._virtualModuleMocks.clear();
    this._cacheFS.clear();
    this._unmockList = undefined;
    this._sourceMapRegistry.clear();
    this._fileTransforms.clear();
    this.jestObjectCaches.clear();
    (_a = this._v8CoverageSources) === null || _a === void 0 ? void 0 : _a.clear();
    this._v8CoverageResult = [];
    this._v8CoverageInstrumenter = undefined;
    this._moduleImplementation = undefined;
    this.isTornDown = true;
  };
  Runtime.prototype._resolveCjsModule = function (from, to) {
    return to
      ? this._resolver.resolveModule(from, to, {
        conditions: this.cjsConditions,
      })
      : from;
  };
  // TOOD：解析模块路径
  Runtime.prototype._resolveModule = function (from, to) {
    return to
      ? this._resolver.resolveModuleAsync(from, to, {
        conditions: this.esmConditions,
      })
      : from;
  };
  Runtime.prototype._requireResolve = function (from, moduleName, options) {
    if (options === void 0) { options = {}; }
    if (moduleName == null) {
      throw new Error('The first argument to require.resolve must be a string. Received null or undefined.');
    }
    if (path.isAbsolute(moduleName)) {
      var module = this._resolver.resolveModuleFromDirIfExists(moduleName, moduleName, { conditions: this.cjsConditions, paths: [] });
      if (module) {
        return module;
      }
    }
    else {
      var paths = options.paths;
      if (paths) {
        for (var _i = 0, paths_1 = paths; _i < paths_1.length; _i++) {
          var p = paths_1[_i];
          var absolutePath = path.resolve(from, '..', p);
          var module = this._resolver.resolveModuleFromDirIfExists(absolutePath, moduleName,
            // required to also resolve files without leading './' directly in the path
            { conditions: this.cjsConditions, paths: [absolutePath] });
          if (module) {
            return module;
          }
        }
        throw new jest_resolve_1.default.ModuleNotFoundError("Cannot resolve module '".concat(moduleName, "' from paths ['").concat(paths.join("', '"), "'] from ").concat(from));
      }
    }
    try {
      return this._resolveCjsModule(from, moduleName);
    }
    catch (err) {
      var module = this._resolver.getMockModule(from, moduleName);
      if (module) {
        return module;
      }
      else {
        throw err;
      }
    }
  };
  Runtime.prototype._requireResolvePaths = function (from, moduleName) {
    var fromDir = path.resolve(from, '..');
    if (moduleName == null) {
      throw new Error('The first argument to require.resolve.paths must be a string. Received null or undefined.');
    }
    if (!moduleName.length) {
      throw new Error('The first argument to require.resolve.paths must not be the empty string.');
    }
    if (moduleName[0] === '.') {
      return [fromDir];
    }
    if (this._resolver.isCoreModule(moduleName)) {
      return null;
    }
    var modulePaths = this._resolver.getModulePaths(fromDir);
    var globalPaths = this._resolver.getGlobalPaths(moduleName);
    return __spreadArray(__spreadArray([], modulePaths, true), globalPaths, true);
  };
  // 执行模块
  Runtime.prototype._execModule = function (localModule, options, moduleRegistry, from, moduleName) {
    var _this = this;
    if (this.isTornDown) {
      this._logFormattedReferenceError('You are trying to `import` a file after the Jest environment has been torn down.');
      process.exitCode = 1;
      return;
    }
    // If the environment was disposed, prevent this module from being executed.
    if (!this._environment.global) {
      return;
    }
    var module = localModule;
    var filename = module.filename;
    var lastExecutingModulePath = this._currentlyExecutingModulePath;
    this._currentlyExecutingModulePath = filename;
    var origCurrExecutingManualMock = this._isCurrentlyExecutingManualMock;
    this._isCurrentlyExecutingManualMock = filename;
    module.children = [];
    Object.defineProperty(module, 'parent', {
      enumerable: true,
      get: function () {
        var key = from || '';
        return moduleRegistry.get(key) || null;
      },
    });
    var modulePaths = this._resolver.getModulePaths(module.path);
    var globalPaths = this._resolver.getGlobalPaths(moduleName);
    module.paths = __spreadArray(__spreadArray([], modulePaths, true), globalPaths, true);
    Object.defineProperty(module, 'require', {
      value: this._createRequireImplementation(module, options),
    });
    var transformedCode = this.transformFile(filename, options);
    var compiledFunction = null;
    var script = this.createScriptFromCode(transformedCode, filename);
    var runScript = null;
    var vmContext = this._environment.getVmContext();
    if (vmContext) {
      runScript = script.runInContext(vmContext, { filename: filename });
    }
    if (runScript !== null) {
      compiledFunction = runScript[EVAL_RESULT_VARIABLE];
    }
    if (compiledFunction === null) {
      this._logFormattedReferenceError('You are trying to `import` a file after the Jest environment has been torn down.');
      process.exitCode = 1;
      return;
    }
    var jestObject = this._createJestObjectFor(filename);
    this.jestObjectCaches.set(filename, jestObject);
    var lastArgs = __spreadArray([
      this._config.injectGlobals ? jestObject : undefined
    ], this._config.sandboxInjectedGlobals.map(function (globalVariable) {
      if (_this._environment.global[globalVariable]) {
        return _this._environment.global[globalVariable];
      }
      throw new Error("You have requested '".concat(globalVariable, "' as a global variable, but it was not present. Please check your config or your global environment."));
    }), true);
    if (!this._mainModule && filename === this._testPath) {
      this._mainModule = module;
    }
    Object.defineProperty(module, 'main', {
      enumerable: true,
      value: this._mainModule,
    });
    try {
      compiledFunction.call.apply(compiledFunction, __spreadArray([module.exports,
        module, // module object
      module.exports, // module exports
      module.require, // require implementation
      module.path, // __dirname
      module.filename, // __filename
      lastArgs[0]], lastArgs.slice(1).filter(jest_util_1.isNonNullable), false));
    }
    catch (error) {
      this.handleExecutionError(error, module);
    }
    this._isCurrentlyExecutingManualMock = origCurrExecutingManualMock;
    this._currentlyExecutingModulePath = lastExecutingModulePath;
  };
  // 根据 文件路径 读取文件，并返回转换后的代码
  Runtime.prototype.transformFile = function (filename, options) {
    var source = this.readFile(filename);
    if (options === null || options === void 0 ? void 0 : options.isInternalModule) {
      return source;
    }
    var transformedFile = this._scriptTransformer.transform(filename, this._getFullTransformationOptions(options), source);
    this._fileTransforms.set(filename, __assign(__assign({}, transformedFile), { wrapperLength: this.constructModuleWrapperStart().length }));
    if (transformedFile.sourceMapPath) {
      this._sourceMapRegistry.set(filename, transformedFile.sourceMapPath);
    }
    return transformedFile.code;
  };
  // 读取文件，并通过 转换器 异步返回转换后的文件内容
  Runtime.prototype.transformFileAsync = function (filename, options) {
    return __awaiter(this, void 0, void 0, function () {
      var source, transformedFile;
      var _a;
      return __generator(this, function (_b) {
        switch (_b.label) {
          case 0:
            source = this.readFile(filename);
            if (options === null || options === void 0 ? void 0 : options.isInternalModule) {
              return [2 /*return*/, source];
            }
            return [4 /*yield*/, this._scriptTransformer.transformAsync(filename, this._getFullTransformationOptions(options), source)];
          case 1:
            transformedFile = _b.sent();
            if (((_a = this._fileTransforms.get(filename)) === null || _a === void 0 ? void 0 : _a.code) !== transformedFile.code) {
              this._fileTransforms.set(filename, __assign(__assign({}, transformedFile), { wrapperLength: 0 }));
            }
            if (transformedFile.sourceMapPath) {
              this._sourceMapRegistry.set(filename, transformedFile.sourceMapPath);
            }
            return [2 /*return*/, transformedFile.code];
        }
      });
    });
  };
  // 根据 code 返回创建后的 脚本
  Runtime.prototype.createScriptFromCode = function (scriptSource, filename) {
    var _this = this;
    var _a;
    try {
      var scriptFilename_1 = this._resolver.isCoreModule(filename)
        ? "jest-nodejs-core-".concat(filename)
        : filename;
      return new vm_1.Script(this.wrapCodeInModuleWrapper(scriptSource), {
        columnOffset: (_a = this._fileTransforms.get(filename)) === null || _a === void 0 ? void 0 : _a.wrapperLength,
        displayErrors: true,
        filename: scriptFilename_1,
        // @ts-expect-error: Experimental ESM API
        importModuleDynamically: function (specifier) {
          return __awaiter(_this, void 0, void 0, function () {
            var context, module;
            var _a, _b;
            return __generator(this, function (_c) {
              switch (_c.label) {
                case 0:
                  (0, jest_util_1.invariant)(runtimeSupportsVmModules, 'You need to run with a version of node that supports ES Modules in the VM API. See https://jestjs.io/docs/ecmascript-modules');
                  context = (_b = (_a = this._environment).getVmContext) === null || _b === void 0 ? void 0 : _b.call(_a);
                  (0, jest_util_1.invariant)(context, 'Test environment has been torn down');
                  return [4 /*yield*/, this.resolveModule(specifier, scriptFilename_1, context)];
                case 1:
                  module = _c.sent();
                  return [2 /*return*/, this.linkAndEvaluateModule(module)];
              }
            });
          });
        },
      });
    }
    catch (e) {
      throw (0, transform_1.handlePotentialSyntaxError)(e);
    }
  };
  Runtime.prototype._requireCoreModule = function (moduleName, supportPrefix) {
    var moduleWithoutNodePrefix = supportPrefix && moduleName.startsWith('node:')
      ? moduleName.slice('node:'.length)
      : moduleName;
    if (moduleWithoutNodePrefix === 'process') {
      return this._environment.global.process;
    }
    if (moduleWithoutNodePrefix === 'module') {
      return this._getMockedNativeModule();
    }
    return require(moduleName);
  };
  Runtime.prototype._importCoreModule = function (moduleName, context) {
    var required = this._requireCoreModule(moduleName, true);
    var module = new vm_1.SyntheticModule(__spreadArray(['default'], Object.keys(required), true), function () {
      var _this = this;
      // @ts-expect-error: TS doesn't know what `this` is
      this.setExport('default', required);
      Object.entries(required).forEach(function (_a) {
        var key = _a[0], value = _a[1];
        // @ts-expect-error: TS doesn't know what `this` is
        _this.setExport(key, value);
      });
    },
      // should identifier be `node://${moduleName}`?
      { context: context, identifier: moduleName });
    return evaluateSyntheticModule(module);
  };
  Runtime.prototype._importWasmModule = function (source, identifier, context) {
    return __awaiter(this, void 0, void 0, function () {
      var wasmModule, exports, imports, moduleLookup, _i, imports_1, module, resolvedModule, _a, _b, syntheticModule;
      return __generator(this, function (_c) {
        switch (_c.label) {
          case 0: return [4 /*yield*/, WebAssembly.compile(source)];
          case 1:
            wasmModule = _c.sent();
            exports = WebAssembly.Module.exports(wasmModule);
            imports = WebAssembly.Module.imports(wasmModule);
            moduleLookup = {};
            _i = 0, imports_1 = imports;
            _c.label = 2;
          case 2:
            if (!(_i < imports_1.length)) return [3 /*break*/, 6];
            module = imports_1[_i].module;
            if (!(moduleLookup[module] === undefined)) return [3 /*break*/, 5];
            return [4 /*yield*/, this.resolveModule(module, identifier, context)];
          case 3:
            resolvedModule = _c.sent();
            _a = moduleLookup;
            _b = module;
            return [4 /*yield*/, this.linkAndEvaluateModule(resolvedModule)];
          case 4:
            _a[_b] = _c.sent();
            _c.label = 5;
          case 5:
            _i++;
            return [3 /*break*/, 2];
          case 6:
            syntheticModule = new vm_1.SyntheticModule(exports.map(function (_a) {
              var name = _a.name;
              return name;
            }), function () {
              var importsObject = {};
              for (var _i = 0, imports_2 = imports; _i < imports_2.length; _i++) {
                var _a = imports_2[_i], module = _a.module, name_1 = _a.name;
                if (!importsObject[module]) {
                  importsObject[module] = {};
                }
                importsObject[module][name_1] = moduleLookup[module].namespace[name_1];
              }
              var wasmInstance = new WebAssembly.Instance(wasmModule, importsObject);
              for (var _b = 0, exports_3 = exports; _b < exports_3.length; _b++) {
                var name_2 = exports_3[_b].name;
                // @ts-expect-error: TS doesn't know what `this` is
                this.setExport(name_2, wasmInstance.exports[name_2]);
              }
            }, { context: context, identifier: identifier });
            return [2 /*return*/, syntheticModule];
        }
      });
    });
  };
  // 
  Runtime.prototype._getMockedNativeModule = function () {
    var _this = this;
    if (this._moduleImplementation) {
      return this._moduleImplementation;
    }
    var createRequire = function (modulePath) {
      var filename = typeof modulePath === 'string'
        ? modulePath.startsWith('file:///')
          ? (0, url_1.fileURLToPath)(new url_1.URL(modulePath))
          : modulePath
        : (0, url_1.fileURLToPath)(modulePath);
      if (!path.isAbsolute(filename)) {
        var error = new TypeError("The argument 'filename' must be a file URL object, file URL string, or absolute path string. Received '".concat(filename, "'"));
        error.code = 'ERR_INVALID_ARG_TYPE';
        throw error;
      }
      return _this._createRequireImplementation({
        children: [],
        exports: {},
        filename: filename,
        id: filename,
        loaded: false,
        path: path.dirname(filename),
      });
    };
    // should we implement the class ourselves?
    var Module = /** @class */ (function (_super) {
      __extends(Module, _super);
      function Module() {
        return _super !== null && _super.apply(this, arguments) || this;
      }
      return Module;
    }(nativeModule.Module));
    Object.entries(nativeModule.Module).forEach(function (_a) {
      var key = _a[0], value = _a[1];
      // @ts-expect-error: no index signature
      Module[key] = value;
    });
    Module.Module = Module;
    if ('createRequire' in nativeModule) {
      Module.createRequire = createRequire;
    }
    if ('createRequireFromPath' in nativeModule) {
      Module.createRequireFromPath = function createRequireFromPath(filename) {
        if (typeof filename !== 'string') {
          var error = new TypeError("The argument 'filename' must be string. Received '".concat(filename, "'.").concat(filename instanceof url_1.URL
            ? ' Use createRequire for URL filename.'
            : ''));
          error.code = 'ERR_INVALID_ARG_TYPE';
          throw error;
        }
        return createRequire(filename);
      };
    }
    if ('syncBuiltinESMExports' in nativeModule) {
      // cast since TS seems very confused about whether it exists or not
      Module.syncBuiltinESMExports =
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        function syncBuiltinESMExports() { };
    }
    this._moduleImplementation = Module;
    return Module;
  };
  // 生成模拟模块
  Runtime.prototype._generateMock = function (from, moduleName) {
    var modulePath = this._resolver.resolveStubModuleName(from, moduleName) ||
      this._resolveCjsModule(from, moduleName);
    if (!this._mockMetaDataCache.has(modulePath)) {
      // This allows us to handle circular dependencies while generating an
      // automock
      this._mockMetaDataCache.set(modulePath, this._moduleMocker.getMetadata({}) || {});
      // In order to avoid it being possible for automocking to potentially
      // cause side-effects within the module environment, we need to execute
      // the module in isolation. This could cause issues if the module being
      // mocked has calls into side-effectful APIs on another module.
      var origMockRegistry = this._mockRegistry;
      var origModuleRegistry = this._moduleRegistry;
      this._mockRegistry = new Map();
      this._moduleRegistry = new Map();
      var moduleExports = this.requireModule(from, moduleName);
      // Restore the "real" module/mock registries
      this._mockRegistry = origMockRegistry;
      this._moduleRegistry = origModuleRegistry;
      var mockMetadata = this._moduleMocker.getMetadata(moduleExports);
      if (mockMetadata == null) {
        throw new Error("Failed to get mock metadata: ".concat(modulePath, "\n\n") +
          'See: https://jestjs.io/docs/manual-mocks#content');
      }
      this._mockMetaDataCache.set(modulePath, mockMetadata);
    }
    return this._moduleMocker.generateFromMetadata(
      // added above if missing
      this._mockMetaDataCache.get(modulePath));
  };
  // 
  Runtime.prototype._shouldMockCjs = function (from, moduleName, explicitShouldMock) {
    var options = { conditions: this.cjsConditions };
    var moduleID = this._resolver.getModuleID(this._virtualMocks, from, moduleName, options);
    var key = from + path.delimiter + moduleID;
    if (explicitShouldMock.has(moduleID)) {
      // guaranteed by `has` above
      return explicitShouldMock.get(moduleID);
    }
    if (!this._shouldAutoMock ||
      this._resolver.isCoreModule(moduleName) ||
      this._shouldUnmockTransitiveDependenciesCache.get(key)) {
      return false;
    }
    if (this._shouldMockModuleCache.has(moduleID)) {
      // guaranteed by `has` above
      return this._shouldMockModuleCache.get(moduleID);
    }
    var modulePath;
    try {
      modulePath = this._resolveCjsModule(from, moduleName);
    }
    catch (e) {
      var manualMock = this._resolver.getMockModule(from, moduleName);
      if (manualMock) {
        this._shouldMockModuleCache.set(moduleID, true);
        return true;
      }
      throw e;
    }
    if (this._unmockList && this._unmockList.test(modulePath)) {
      this._shouldMockModuleCache.set(moduleID, false);
      return false;
    }
    // transitive unmocking for package managers that store flat packages (npm3)
    var currentModuleID = this._resolver.getModuleID(this._virtualMocks, from, undefined, options);
    if (this._transitiveShouldMock.get(currentModuleID) === false ||
      (from.includes(NODE_MODULES) &&
        modulePath.includes(NODE_MODULES) &&
        ((this._unmockList && this._unmockList.test(from)) ||
          explicitShouldMock.get(currentModuleID) === false))) {
      this._transitiveShouldMock.set(moduleID, false);
      this._shouldUnmockTransitiveDependenciesCache.set(key, true);
      return false;
    }
    this._shouldMockModuleCache.set(moduleID, true);
    return true;
  };
  // 返回 是否应该模拟模块
  Runtime.prototype._shouldMockModule = function (from, moduleName, explicitShouldMock) {
    return __awaiter(this, void 0, void 0, function () {
      var options, moduleID, key, modulePath, e_1, manualMock, currentModuleID;
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            options = { conditions: this.esmConditions };
            return [4 /*yield*/, this._resolver.getModuleIDAsync(this._virtualMocks, from, moduleName, options)];
          case 1:
            moduleID = _a.sent();
            key = from + path.delimiter + moduleID;
            if (explicitShouldMock.has(moduleID)) {
              // guaranteed by `has` above
              return [2 /*return*/, explicitShouldMock.get(moduleID)];
            }
            if (!this._shouldAutoMock ||
              this._resolver.isCoreModule(moduleName) ||
              this._shouldUnmockTransitiveDependenciesCache.get(key)) {
              return [2 /*return*/, false];
            }
            if (this._shouldMockModuleCache.has(moduleID)) {
              // guaranteed by `has` above
              return [2 /*return*/, this._shouldMockModuleCache.get(moduleID)];
            }
            _a.label = 2;
          case 2:
            _a.trys.push([2, 4, , 6]);
            return [4 /*yield*/, this._resolveModule(from, moduleName)];
          case 3:
            modulePath = _a.sent();
            return [3 /*break*/, 6];
          case 4:
            e_1 = _a.sent();
            return [4 /*yield*/, this._resolver.getMockModuleAsync(from, moduleName)];
          case 5:
            manualMock = _a.sent();
            if (manualMock) {
              this._shouldMockModuleCache.set(moduleID, true);
              return [2 /*return*/, true];
            }
            throw e_1;
          case 6:
            if (this._unmockList && this._unmockList.test(modulePath)) {
              this._shouldMockModuleCache.set(moduleID, false);
              return [2 /*return*/, false];
            }
            return [4 /*yield*/, this._resolver.getModuleIDAsync(this._virtualMocks, from, undefined, options)];
          case 7:
            currentModuleID = _a.sent();
            if (this._transitiveShouldMock.get(currentModuleID) === false ||
              (from.includes(NODE_MODULES) &&
                modulePath.includes(NODE_MODULES) &&
                ((this._unmockList && this._unmockList.test(from)) ||
                  explicitShouldMock.get(currentModuleID) === false))) {
              this._transitiveShouldMock.set(moduleID, false);
              this._shouldUnmockTransitiveDependenciesCache.set(key, true);
              return [2 /*return*/, false];
            }
            this._shouldMockModuleCache.set(moduleID, true);
            return [2 /*return*/, true];
        }
      });
    });
  };
  // 创建 require 函数
  Runtime.prototype._createRequireImplementation = function (from, options) {
    var _this = this;
    var resolve = function (moduleName, resolveOptions) {
      var resolved = _this._requireResolve(from.filename, moduleName, resolveOptions);
      if ((resolveOptions === null || resolveOptions === void 0 ? void 0 : resolveOptions[JEST_RESOLVE_OUTSIDE_VM_OPTION]) &&
        (options === null || options === void 0 ? void 0 : options.isInternalModule)) {
        return (0, helpers_1.createOutsideJestVmPath)(resolved);
      }
      return resolved;
    };
    resolve.paths = function (moduleName) {
      return _this._requireResolvePaths(from.filename, moduleName);
    };
    var moduleRequire = ((options === null || options === void 0 ? void 0 : options.isInternalModule)
      ? function (moduleName) {
        return _this.requireInternalModule(from.filename, moduleName);
      }
      : this.requireModuleOrMock.bind(this, from.filename));
    moduleRequire.extensions = Object.create(null);
    moduleRequire.resolve = resolve;
    moduleRequire.cache = (function () {
      // TODO: consider warning somehow that this does nothing. We should support deletions, anyways
      var notPermittedMethod = function () { return true; };
      return new Proxy(Object.create(null), {
        defineProperty: notPermittedMethod,
        deleteProperty: notPermittedMethod,
        get: function (_target, key) {
          return typeof key === 'string' ? _this._moduleRegistry.get(key) : undefined;
        },
        getOwnPropertyDescriptor: function () {
          return {
            configurable: true,
            enumerable: true,
          };
        },
        has: function (_target, key) {
          return typeof key === 'string' && _this._moduleRegistry.has(key);
        },
        ownKeys: function () { return Array.from(_this._moduleRegistry.keys()); },
        set: notPermittedMethod,
      });
    })();
    Object.defineProperty(moduleRequire, 'main', {
      enumerable: true,
      value: this._mainModule,
    });
    return moduleRequire;
  };
  // 创建 全局Jest对象
  Runtime.prototype._createJestObjectFor = function (from) {
    var _this = this;
    var _a, _b;
    var disableAutomock = function () {
      _this._shouldAutoMock = false;
      return jestObject;
    };
    var enableAutomock = function () {
      _this._shouldAutoMock = true;
      return jestObject;
    };
    var unmock = function (moduleName) {
      var moduleID = _this._resolver.getModuleID(_this._virtualMocks, from, moduleName, { conditions: _this.cjsConditions });
      _this._explicitShouldMock.set(moduleID, false);
      return jestObject;
    };
    var deepUnmock = function (moduleName) {
      var moduleID = _this._resolver.getModuleID(_this._virtualMocks, from, moduleName, { conditions: _this.cjsConditions });
      _this._explicitShouldMock.set(moduleID, false);
      _this._transitiveShouldMock.set(moduleID, false);
      return jestObject;
    };
    var mock = function (moduleName, mockFactory, options) {
      if (mockFactory !== undefined) {
        return setMockFactory(moduleName, mockFactory, options);
      }
      var moduleID = _this._resolver.getModuleID(_this._virtualMocks, from, moduleName, { conditions: _this.cjsConditions });
      _this._explicitShouldMock.set(moduleID, true);
      return jestObject;
    };
    var setMockFactory = function (moduleName, mockFactory, options) {
      _this.setMock(from, moduleName, mockFactory, options);
      return jestObject;
    };
    var mockModule = function (moduleName, mockFactory, options) {
      if (typeof mockFactory !== 'function') {
        throw new Error('`unstable_mockModule` must be passed a mock factory');
      }
      _this.setModuleMock(from, moduleName, mockFactory, options);
      return jestObject;
    };
    var clearAllMocks = function () {
      _this.clearAllMocks();
      return jestObject;
    };
    var resetAllMocks = function () {
      _this.resetAllMocks();
      return jestObject;
    };
    var restoreAllMocks = function () {
      _this.restoreAllMocks();
      return jestObject;
    };
    var _getFakeTimers = function () {
      if (_this.isTornDown ||
        !(_this._environment.fakeTimers || _this._environment.fakeTimersModern)) {
        _this._logFormattedReferenceError('You are trying to access a property or method of the Jest environment after it has been torn down.');
        process.exitCode = 1;
      }
      return _this._fakeTimersImplementation;
    };
    var useFakeTimers = function (fakeTimersConfig) {
      fakeTimersConfig = __assign(__assign({}, _this._config.fakeTimers), fakeTimersConfig);
      if (fakeTimersConfig === null || fakeTimersConfig === void 0 ? void 0 : fakeTimersConfig.legacyFakeTimers) {
        _this._fakeTimersImplementation = _this._environment.fakeTimers;
      }
      else {
        _this._fakeTimersImplementation = _this._environment.fakeTimersModern;
      }
      _this._fakeTimersImplementation.useFakeTimers(fakeTimersConfig);
      return jestObject;
    };
    var useRealTimers = function () {
      _getFakeTimers().useRealTimers();
      return jestObject;
    };
    var resetModules = function () {
      _this.resetModules();
      return jestObject;
    };
    var isolateModules = function (fn) {
      _this.isolateModules(fn);
      return jestObject;
    };
    var isolateModulesAsync = function (fn) {
      return _this.isolateModulesAsync(fn);
    };
    var fn = this._moduleMocker.fn.bind(this._moduleMocker);
    var spyOn = this._moduleMocker.spyOn.bind(this._moduleMocker);
    var mocked = (_b = (_a = this._moduleMocker.mocked) === null || _a === void 0 ? void 0 : _a.bind(this._moduleMocker)) !== null && _b !== void 0 ? _b : (function () {
      throw new Error('Your test environment does not support `mocked`, please update it.');
    });
    var replaceProperty = typeof this._moduleMocker.replaceProperty === 'function'
      ? this._moduleMocker.replaceProperty.bind(this._moduleMocker)
      : function () {
        throw new Error('Your test environment does not support `jest.replaceProperty` - please ensure its Jest dependencies are updated to version 29.4 or later');
      };
    var setTimeout = function (timeout) {
      _this._environment.global[testTimeoutSymbol] = timeout;
      return jestObject;
    };
    var retryTimes = function (numTestRetries, options) {
      _this._environment.global[retryTimesSymbol] = numTestRetries;
      _this._environment.global[logErrorsBeforeRetrySymbol] =
        options === null || options === void 0 ? void 0 : options.logErrorsBeforeRetry;
      return jestObject;
    };
    var jestObject = {
      advanceTimersByTime: function (msToRun) {
        return _getFakeTimers().advanceTimersByTime(msToRun);
      },
      advanceTimersByTimeAsync: function (msToRun) {
        return __awaiter(_this, void 0, void 0, function () {
          var fakeTimers;
          return __generator(this, function (_a) {
            switch (_a.label) {
              case 0:
                fakeTimers = _getFakeTimers();
                if (!(fakeTimers === this._environment.fakeTimersModern)) return [3 /*break*/, 2];
                // TODO: remove this check in Jest 30
                if (typeof fakeTimers.advanceTimersByTimeAsync !== 'function') {
                  throw new TypeError('Your test environment does not support async fake timers - please ensure its Jest dependencies are updated to version 29.5 or later');
                }
                return [4 /*yield*/, fakeTimers.advanceTimersByTimeAsync(msToRun)];
              case 1:
                _a.sent();
                return [3 /*break*/, 3];
              case 2: throw new TypeError('`jest.advanceTimersByTimeAsync()` is not available when using legacy fake timers.');
              case 3: return [2 /*return*/];
            }
          });
        });
      },
      advanceTimersToNextTimer: function (steps) {
        return _getFakeTimers().advanceTimersToNextTimer(steps);
      },
      advanceTimersToNextTimerAsync: function (steps) {
        return __awaiter(_this, void 0, void 0, function () {
          var fakeTimers;
          return __generator(this, function (_a) {
            switch (_a.label) {
              case 0:
                fakeTimers = _getFakeTimers();
                if (!(fakeTimers === this._environment.fakeTimersModern)) return [3 /*break*/, 2];
                // TODO: remove this check in Jest 30
                if (typeof fakeTimers.advanceTimersToNextTimerAsync !== 'function') {
                  throw new TypeError('Your test environment does not support async fake timers - please ensure its Jest dependencies are updated to version 29.5 or later');
                }
                return [4 /*yield*/, fakeTimers.advanceTimersToNextTimerAsync(steps)];
              case 1:
                _a.sent();
                return [3 /*break*/, 3];
              case 2: throw new TypeError('`jest.advanceTimersToNextTimerAsync()` is not available when using legacy fake timers.');
              case 3: return [2 /*return*/];
            }
          });
        });
      },
      autoMockOff: disableAutomock,
      autoMockOn: enableAutomock,
      clearAllMocks: clearAllMocks,
      clearAllTimers: function () { return _getFakeTimers().clearAllTimers(); },
      createMockFromModule: function (moduleName) { return _this._generateMock(from, moduleName); },
      deepUnmock: deepUnmock,
      disableAutomock: disableAutomock,
      doMock: mock,
      dontMock: unmock,
      enableAutomock: enableAutomock,
      fn: fn,
      genMockFromModule: function (moduleName) { return _this._generateMock(from, moduleName); },
      getRealSystemTime: function () {
        var fakeTimers = _getFakeTimers();
        if (fakeTimers === _this._environment.fakeTimersModern) {
          return fakeTimers.getRealSystemTime();
        }
        else {
          throw new TypeError('`jest.getRealSystemTime()` is not available when using legacy fake timers.');
        }
      },
      getSeed: function () {
        var _a;
        // TODO: remove this check in Jest 30
        if (((_a = _this._globalConfig) === null || _a === void 0 ? void 0 : _a.seed) === undefined) {
          throw new Error('The seed value is not available. Likely you are using older versions of the jest dependencies.');
        }
        return _this._globalConfig.seed;
      },
      getTimerCount: function () { return _getFakeTimers().getTimerCount(); },
      isEnvironmentTornDown: function () { return _this.isTornDown; },
      isMockFunction: this._moduleMocker.isMockFunction,
      isolateModules: isolateModules,
      isolateModulesAsync: isolateModulesAsync,
      mock: mock,
      mocked: mocked,
      now: function () { return _getFakeTimers().now(); },
      replaceProperty: replaceProperty,
      requireActual: function (moduleName) { return _this.requireActual(from, moduleName); },
      requireMock: function (moduleName) { return _this.requireMock(from, moduleName); },
      resetAllMocks: resetAllMocks,
      resetModules: resetModules,
      restoreAllMocks: restoreAllMocks,
      retryTimes: retryTimes,
      runAllImmediates: function () {
        var fakeTimers = _getFakeTimers();
        if (fakeTimers === _this._environment.fakeTimers) {
          fakeTimers.runAllImmediates();
        }
        else {
          throw new TypeError('`jest.runAllImmediates()` is only available when using legacy fake timers.');
        }
      },
      runAllTicks: function () { return _getFakeTimers().runAllTicks(); },
      runAllTimers: function () { return _getFakeTimers().runAllTimers(); },
      runAllTimersAsync: function () {
        return __awaiter(_this, void 0, void 0, function () {
          var fakeTimers;
          return __generator(this, function (_a) {
            switch (_a.label) {
              case 0:
                fakeTimers = _getFakeTimers();
                if (!(fakeTimers === this._environment.fakeTimersModern)) return [3 /*break*/, 2];
                // TODO: remove this check in Jest 30
                if (typeof fakeTimers.runAllTimersAsync !== 'function') {
                  throw new TypeError('Your test environment does not support async fake timers - please ensure its Jest dependencies are updated to version 29.5 or later');
                }
                return [4 /*yield*/, fakeTimers.runAllTimersAsync()];
              case 1:
                _a.sent();
                return [3 /*break*/, 3];
              case 2: throw new TypeError('`jest.runAllTimersAsync()` is not available when using legacy fake timers.');
              case 3: return [2 /*return*/];
            }
          });
        });
      },
      runOnlyPendingTimers: function () { return _getFakeTimers().runOnlyPendingTimers(); },
      runOnlyPendingTimersAsync: function () {
        return __awaiter(_this, void 0, void 0, function () {
          var fakeTimers;
          return __generator(this, function (_a) {
            switch (_a.label) {
              case 0:
                fakeTimers = _getFakeTimers();
                if (!(fakeTimers === this._environment.fakeTimersModern)) return [3 /*break*/, 2];
                // TODO: remove this check in Jest 30
                if (typeof fakeTimers.runOnlyPendingTimersAsync !== 'function') {
                  throw new TypeError('Your test environment does not support async fake timers - please ensure its Jest dependencies are updated to version 29.5 or later');
                }
                return [4 /*yield*/, fakeTimers.runOnlyPendingTimersAsync()];
              case 1:
                _a.sent();
                return [3 /*break*/, 3];
              case 2: throw new TypeError('`jest.runOnlyPendingTimersAsync()` is not available when using legacy fake timers.');
              case 3: return [2 /*return*/];
            }
          });
        });
      },
      setMock: function (moduleName, mock) { return setMockFactory(moduleName, function () { return mock; }); },
      setSystemTime: function (now) {
        var fakeTimers = _getFakeTimers();
        if (fakeTimers === _this._environment.fakeTimersModern) {
          fakeTimers.setSystemTime(now);
        }
        else {
          throw new TypeError('`jest.setSystemTime()` is not available when using legacy fake timers.');
        }
      },
      setTimeout: setTimeout,
      spyOn: spyOn,
      unmock: unmock,
      unstable_mockModule: mockModule,
      useFakeTimers: useFakeTimers,
      useRealTimers: useRealTimers,
    };
    return jestObject;
  };
  //
  Runtime.prototype._logFormattedReferenceError = function (errorMessage) {
    var testPath = this._testPath
      ? " From ".concat(slash(path.relative(this._config.rootDir, this._testPath)), ".")
      : '';
    var originalStack = new ReferenceError("".concat(errorMessage).concat(testPath))
      .stack.split('\n')
      // Remove this file from the stack (jest-message-utils will keep one line)
      .filter(function (line) { return line.indexOf(__filename) === -1; })
      .join('\n');
    var _a = (0, jest_message_util_1.separateMessageFromStack)(originalStack), message = _a.message, stack = _a.stack;
    console.error("\n".concat(message, "\n").concat((0, jest_message_util_1.formatStackTrace)(stack, this._config, {
      noStackTrace: false,
    })));
  };
  // 包装后的模块代码
  Runtime.prototype.wrapCodeInModuleWrapper = function (content) {
    return "".concat(this.constructModuleWrapperStart() + content, "\n}});");
  };
  // 
  Runtime.prototype.constructModuleWrapperStart = function () {
    var args = this.constructInjectedModuleParameters();
    return "({\"".concat(EVAL_RESULT_VARIABLE, "\":function(").concat(args.join(','), "){");
  };
  // 返回构造函数要注入的模块参数
  Runtime.prototype.constructInjectedModuleParameters = function () {
    return __spreadArray([
      'module',
      'exports',
      'require',
      '__dirname',
      '__filename',
      this._config.injectGlobals ? 'jest' : undefined
    ], this._config.sandboxInjectedGlobals, true).filter(jest_util_1.isNonNullable);
  };
  // 
  Runtime.prototype.handleExecutionError = function (e, module) {
    var moduleNotFoundError = jest_resolve_1.default.tryCastModuleNotFoundError(e);
    if (moduleNotFoundError) {
      if (!moduleNotFoundError.requireStack) {
        moduleNotFoundError.requireStack = [module.filename || module.id];
        for (var cursor = module.parent; cursor; cursor = cursor.parent) {
          moduleNotFoundError.requireStack.push(cursor.filename || cursor.id);
        }
        moduleNotFoundError.buildMessage(this._config.rootDir);
      }
      throw moduleNotFoundError;
    }
    throw e;
  };
  // 返回从 cjs 中获取的 全局变量
  Runtime.prototype.getGlobalsForCjs = function (from) {
    var jest = this.jestObjectCaches.get(from);
    (0, jest_util_1.invariant)(jest, 'There should always be a Jest object already');
    return __assign(__assign({}, this.getGlobalsFromEnvironment()), { jest: jest });
  };
  // 获取 esm 对应的 全局Jest
  Runtime.prototype.getGlobalsForEsm = function (from, context) {
    var jest = this.jestObjectCaches.get(from);
    if (!jest) {
      jest = this._createJestObjectFor(from);
      this.jestObjectCaches.set(from, jest);
    }
    var globals = __assign(__assign({}, this.getGlobalsFromEnvironment()), { jest: jest });
    var module = new vm_1.SyntheticModule(Object.keys(globals), function () {
      var _this = this;
      Object.entries(globals).forEach(function (_a) {
        var key = _a[0], value = _a[1];
        // @ts-expect-error: TS doesn't know what `this` is
        _this.setExport(key, value);
      });
    }, { context: context, identifier: '@jest/globals' });
    return evaluateSyntheticModule(module);
  };
  // 返回从 环境 中获取的 全局变量
  Runtime.prototype.getGlobalsFromEnvironment = function () {
    if (this.jestGlobals) {
      return __assign({}, this.jestGlobals);
    }
    return {
      afterAll: this._environment.global.afterAll,
      afterEach: this._environment.global.afterEach,
      beforeAll: this._environment.global.beforeAll,
      beforeEach: this._environment.global.beforeEach,
      describe: this._environment.global.describe,
      expect: this._environment.global.expect,
      fdescribe: this._environment.global.fdescribe,
      fit: this._environment.global.fit,
      it: this._environment.global.it,
      test: this._environment.global.test,
      xdescribe: this._environment.global.xdescribe,
      xit: this._environment.global.xit,
      xtest: this._environment.global.xtest,
    };
  };
  // 以同步的方式读取文件 并返回Buffer
  Runtime.prototype.readFileBuffer = function (filename) {
    var source = this._cacheFSBuffer.get(filename);
    if (!source) {
      source = fs.readFileSync(filename);
      this._cacheFSBuffer.set(filename, source);
    }
    return source;
  };
  // 根据 文件路径 读取文件 并返回JSON类型的文件
  Runtime.prototype.readFile = function (filename) {
    var source = this._cacheFS.get(filename);
    if (!source) {
      var buffer = this.readFileBuffer(filename);
      source = buffer.toString('utf8');
      this._cacheFS.set(filename, source);
    }
    return source;
  };
  // 设置 jest 全局变量
  Runtime.prototype.setGlobalsForRuntime = function (globals) {
    this.jestGlobals = globals;
  };
  Runtime.shouldInstrument = transform_1.shouldInstrument;
  return Runtime;
}());
exports.default = Runtime;
// 
function evaluateSyntheticModule(module) {
  return __awaiter(this, void 0, void 0, function () {
    return __generator(this, function (_a) {
      switch (_a.label) {
        case 0: return [4 /*yield*/, module.link(function () {
          throw new Error('This should never happen');
        })];
        case 1:
          _a.sent();
          return [4 /*yield*/, module.evaluate()];
        case 2:
          _a.sent();
          return [2 /*return*/, module];
      }
    });
  });
}
