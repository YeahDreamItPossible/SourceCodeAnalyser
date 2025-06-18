"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.replaceProperty = exports.mocked = exports.spyOn = exports.fn = exports.ModuleMocker = void 0;
var jest_util_1 = require("jest-util");
var MOCK_CONSTRUCTOR_NAME = 'mockConstructor';
var FUNCTION_NAME_RESERVED_PATTERN = /[\s!-/:-@[-`{-~]/;
var FUNCTION_NAME_RESERVED_REPLACE = new RegExp(FUNCTION_NAME_RESERVED_PATTERN.source, 'g');
var RESERVED_KEYWORDS = new Set([
  'arguments',
  'await',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'debugger',
  'default',
  'delete',
  'do',
  'else',
  'enum',
  'eval',
  'export',
  'extends',
  'false',
  'finally',
  'for',
  'function',
  'if',
  'implements',
  'import',
  'in',
  'instanceof',
  'interface',
  'let',
  'new',
  'null',
  'package',
  'private',
  'protected',
  'public',
  'return',
  'static',
  'super',
  'switch',
  'this',
  'throw',
  'true',
  'try',
  'typeof',
  'var',
  'void',
  'while',
  'with',
  'yield',
]);
function matchArity(fn, length) {
  var mockConstructor;
  switch (length) {
    case 1:
      mockConstructor = function (_a) {
        return fn.apply(this, arguments);
      };
      break;
    case 2:
      mockConstructor = function (_a, _b) {
        return fn.apply(this, arguments);
      };
      break;
    case 3:
      mockConstructor = function (_a, _b, _c) {
        return fn.apply(this, arguments);
      };
      break;
    case 4:
      mockConstructor = function (_a, _b, _c, _d) {
        return fn.apply(this, arguments);
      };
      break;
    case 5:
      mockConstructor = function (_a, _b, _c, _d, _e) {
        return fn.apply(this, arguments);
      };
      break;
    case 6:
      mockConstructor = function (_a, _b, _c, _d, _e, _f) {
        return fn.apply(this, arguments);
      };
      break;
    case 7:
      mockConstructor = function (_a, _b, _c, _d, _e, _f, _g) {
        return fn.apply(this, arguments);
      };
      break;
    case 8:
      mockConstructor = function (_a, _b, _c, _d, _e, _f, _g, _h) {
        return fn.apply(this, arguments);
      };
      break;
    case 9:
      mockConstructor = function (_a, _b, _c, _d, _e, _f, _g, _h, _i) {
        return fn.apply(this, arguments);
      };
      break;
    default:
      mockConstructor = function () {
        return fn.apply(this, arguments);
      };
      break;
  }
  return mockConstructor;
}
function getObjectType(value) {
  return Object.prototype.toString.apply(value).slice(8, -1);
}
function getType(ref) {
  var typeName = getObjectType(ref);
  if (typeName === 'Function' ||
    typeName === 'AsyncFunction' ||
    typeName === 'GeneratorFunction' ||
    typeName === 'AsyncGeneratorFunction') {
    return 'function';
  }
  else if (Array.isArray(ref)) {
    return 'array';
  }
  else if (typeName === 'Object' || typeName === 'Module') {
    return 'object';
  }
  else if (typeName === 'Number' ||
    typeName === 'String' ||
    typeName === 'Boolean' ||
    typeName === 'Symbol') {
    return 'constant';
  }
  else if (typeName === 'Map' ||
    typeName === 'WeakMap' ||
    typeName === 'Set') {
    return 'collection';
  }
  else if (typeName === 'RegExp') {
    return 'regexp';
  }
  else if (ref === undefined) {
    return 'undefined';
  }
  else if (ref === null) {
    return 'null';
  }
  else {
    return null;
  }
}
function isReadonlyProp(object, prop) {
  if (prop === 'arguments' ||
    prop === 'caller' ||
    prop === 'callee' ||
    prop === 'name' ||
    prop === 'length') {
    var typeName = getObjectType(object);
    return (typeName === 'Function' ||
      typeName === 'AsyncFunction' ||
      typeName === 'GeneratorFunction' ||
      typeName === 'AsyncGeneratorFunction');
  }
  if (prop === 'source' ||
    prop === 'global' ||
    prop === 'ignoreCase' ||
    prop === 'multiline') {
    return getObjectType(object) === 'RegExp';
  }
  return false;
}
// 模块模拟器
// 作用：
// 模拟模块
var ModuleMocker = /** @class */ (function () {
  function ModuleMocker(global) {
    // 运行时全局对象
    this._environmentGlobal = global;
    // 
    this._mockState = new WeakMap();
    // 
    this._mockConfigRegistry = new WeakMap();
    // 
    this._spyState = new Set();
    // 
    this._invocationCallCounter = 1;
  }
  // 
  ModuleMocker.prototype._getSlots = function (object) {
    if (!object) {
      return [];
    }
    var slots = new Set();
    var EnvObjectProto = this._environmentGlobal.Object.prototype;
    var EnvFunctionProto = this._environmentGlobal.Function.prototype;
    var EnvRegExpProto = this._environmentGlobal.RegExp.prototype;
    // Also check the builtins in the current context as they leak through
    // core node modules.
    var ObjectProto = Object.prototype;
    var FunctionProto = Function.prototype;
    var RegExpProto = RegExp.prototype;
    // Properties of Object.prototype, Function.prototype and RegExp.prototype
    // are never reported as slots
    while (object != null &&
      object !== EnvObjectProto &&
      object !== EnvFunctionProto &&
      object !== EnvRegExpProto &&
      object !== ObjectProto &&
      object !== FunctionProto &&
      object !== RegExpProto) {
      var ownNames = Object.getOwnPropertyNames(object);
      for (var i = 0; i < ownNames.length; i++) {
        var prop = ownNames[i];
        if (!isReadonlyProp(object, prop)) {
          var propDesc = Object.getOwnPropertyDescriptor(object, prop);
          if ((propDesc !== undefined && !propDesc.get) || object.__esModule) {
            slots.add(prop);
          }
        }
      }
      object = Object.getPrototypeOf(object);
    }
    return Array.from(slots);
  };
  // 保证返回 模拟配置
  ModuleMocker.prototype._ensureMockConfig = function (f) {
    var config = this._mockConfigRegistry.get(f);
    if (!config) {
      config = this._defaultMockConfig();
      this._mockConfigRegistry.set(f, config);
    }
    return config;
  };
  // 保证返回 模拟状态
  ModuleMocker.prototype._ensureMockState = function (f) {
    var state = this._mockState.get(f);
    if (!state) {
      state = this._defaultMockState();
      this._mockState.set(f, state);
    }
    if (state.calls.length > 0) {
      state.lastCall = state.calls[state.calls.length - 1];
    }
    return state;
  };
  // 默认 模拟配置
  ModuleMocker.prototype._defaultMockConfig = function () {
    return {
      mockImpl: undefined,
      mockName: 'jest.fn()',
      specificMockImpls: [],
    };
  };
  // 默认 模拟状态
  ModuleMocker.prototype._defaultMockState = function () {
    return {
      calls: [],
      contexts: [],
      instances: [],
      invocationCallOrder: [],
      results: [],
    };
  };
  // 
  ModuleMocker.prototype._makeComponent = function (metadata, restore) {
    var _this = this;
    if (metadata.type === 'object') {
      return new this._environmentGlobal.Object();
    }
    else if (metadata.type === 'array') {
      return new this._environmentGlobal.Array();
    }
    else if (metadata.type === 'regexp') {
      return new this._environmentGlobal.RegExp('');
    }
    else if (metadata.type === 'constant' ||
      metadata.type === 'collection' ||
      metadata.type === 'null' ||
      metadata.type === 'undefined') {
      return metadata.value;
    }
    else if (metadata.type === 'function') {
      var prototype_1 = (metadata.members &&
        metadata.members.prototype &&
        metadata.members.prototype.members) ||
        {};
      var prototypeSlots_1 = this._getSlots(prototype_1);
      var mocker_1 = this;
      var mockConstructor = matchArity(function () {
        var _this = this;
        var args = [];
        for (var _j = 0; _j < arguments.length; _j++) {
          args[_j] = arguments[_j];
        }
        var mockState = mocker_1._ensureMockState(f_1);
        var mockConfig = mocker_1._ensureMockConfig(f_1);
        mockState.instances.push(this);
        mockState.contexts.push(this);
        mockState.calls.push(args);
        // Create and record an "incomplete" mock result immediately upon
        // calling rather than waiting for the mock to return. This avoids
        // issues caused by recursion where results can be recorded in the
        // wrong order.
        var mockResult = {
          type: 'incomplete',
          value: undefined,
        };
        mockState.results.push(mockResult);
        mockState.invocationCallOrder.push(mocker_1._invocationCallCounter++);
        // Will be set to the return value of the mock if an error is not thrown
        var finalReturnValue;
        // Will be set to the error that is thrown by the mock (if it throws)
        var thrownError;
        // Will be set to true if the mock throws an error. The presence of a
        // value in `thrownError` is not a 100% reliable indicator because a
        // function could throw a value of undefined.
        var callDidThrowError = false;
        try {
          // The bulk of the implementation is wrapped in an immediately
          // executed arrow function so the return value of the mock function
          // can be easily captured and recorded, despite the many separate
          // return points within the logic.
          finalReturnValue = (function () {
            if (_this instanceof f_1) {
              // This is probably being called as a constructor
              prototypeSlots_1.forEach(function (slot) {
                // Copy prototype methods to the instance to make
                // it easier to interact with mock instance call and
                // return values
                if (prototype_1[slot].type === 'function') {
                  // @ts-expect-error no index signature
                  var protoImpl = _this[slot];
                  // @ts-expect-error no index signature
                  _this[slot] = mocker_1.generateFromMetadata(prototype_1[slot]);
                  // @ts-expect-error no index signature
                  _this[slot]._protoImpl = protoImpl;
                }
              });
              // Run the mock constructor implementation
              var mockImpl = mockConfig.specificMockImpls.length
                ? mockConfig.specificMockImpls.shift()
                : mockConfig.mockImpl;
              return mockImpl && mockImpl.apply(_this, arguments);
            }
            // If mockImplementationOnce()/mockImplementation() is last set,
            // implementation use the mock
            var specificMockImpl = mockConfig.specificMockImpls.shift();
            if (specificMockImpl === undefined) {
              specificMockImpl = mockConfig.mockImpl;
            }
            if (specificMockImpl) {
              return specificMockImpl.apply(_this, arguments);
            }
            // Otherwise use prototype implementation
            if (f_1._protoImpl) {
              return f_1._protoImpl.apply(_this, arguments);
            }
            return undefined;
          })();
        }
        catch (error) {
          // Store the thrown error so we can record it, then re-throw it.
          thrownError = error;
          callDidThrowError = true;
          throw error;
        }
        finally {
          // Record the result of the function.
          // NOTE: Intentionally NOT pushing/indexing into the array of mock
          //       results here to avoid corrupting results data if mockClear()
          //       is called during the execution of the mock.
          // @ts-expect-error reassigning 'incomplete'
          mockResult.type = callDidThrowError ? 'throw' : 'return';
          mockResult.value = callDidThrowError ? thrownError : finalReturnValue;
        }
        return finalReturnValue;
      }, metadata.length || 0);
      var f_1 = this._createMockFunction(metadata, mockConstructor);
      // 标识： 是否是模拟函数
      f_1._isMockFunction = true;
      f_1.getMockImplementation = function () { return _this._ensureMockConfig(f_1).mockImpl; };
      if (typeof restore === 'function') {
        this._spyState.add(restore);
      }
      // 
      this._mockState.set(f_1, this._defaultMockState());
      this._mockConfigRegistry.set(f_1, this._defaultMockConfig());
      Object.defineProperty(f_1, 'mock', {
        configurable: false,
        enumerable: true,
        get: function () { return _this._ensureMockState(f_1); },
        set: function (val) { return _this._mockState.set(f_1, val); },
      });
      f_1.mockClear = function () {
        _this._mockState.delete(f_1);
        return f_1;
      };
      f_1.mockReset = function () {
        f_1.mockClear();
        _this._mockConfigRegistry.delete(f_1);
        return f_1;
      };
      f_1.mockRestore = function () {
        f_1.mockReset();
        return restore ? restore() : undefined;
      };
      f_1.mockReturnValueOnce = function (value) {
        // next function call will return this value or default return value
        return f_1.mockImplementationOnce(function () { return value; });
      };
      f_1.mockResolvedValueOnce = function (value) {
        return f_1.mockImplementationOnce(function () {
          return _this._environmentGlobal.Promise.resolve(value);
        });
      };
      f_1.mockRejectedValueOnce = function (value) {
        return f_1.mockImplementationOnce(function () {
          return _this._environmentGlobal.Promise.reject(value);
        });
      };
      f_1.mockReturnValue = function (value) {
        // next function call will return specified return value or this one
        return f_1.mockImplementation(function () { return value; });
      };
      f_1.mockResolvedValue = function (value) {
        return f_1.mockImplementation(function () {
          return _this._environmentGlobal.Promise.resolve(value);
        });
      };
      f_1.mockRejectedValue = function (value) {
        return f_1.mockImplementation(function () {
          return _this._environmentGlobal.Promise.reject(value);
        });
      };
      f_1.mockImplementationOnce = function (fn) {
        // next function call will use this mock implementation return value
        // or default mock implementation return value
        var mockConfig = _this._ensureMockConfig(f_1);
        mockConfig.specificMockImpls.push(fn);
        return f_1;
      };
      f_1.withImplementation = withImplementation.bind(this);
      function withImplementation(fn, callback) {
        // Remember previous mock implementation, then set new one
        var mockConfig = this._ensureMockConfig(f_1);
        var previousImplementation = mockConfig.mockImpl;
        var previousSpecificImplementations = mockConfig.specificMockImpls;
        mockConfig.mockImpl = fn;
        mockConfig.specificMockImpls = [];
        var returnedValue = callback();
        if ((0, jest_util_1.isPromise)(returnedValue)) {
          return returnedValue.then(function () {
            mockConfig.mockImpl = previousImplementation;
            mockConfig.specificMockImpls = previousSpecificImplementations;
          });
        }
        else {
          mockConfig.mockImpl = previousImplementation;
          mockConfig.specificMockImpls = previousSpecificImplementations;
        }
      }
      f_1.mockImplementation = function (fn) {
        // next function call will use mock implementation return value
        var mockConfig = _this._ensureMockConfig(f_1);
        mockConfig.mockImpl = fn;
        return f_1;
      };
      f_1.mockReturnThis = function () {
        return f_1.mockImplementation(function () {
          return this;
        });
      };
      f_1.mockName = function (name) {
        if (name) {
          var mockConfig = _this._ensureMockConfig(f_1);
          mockConfig.mockName = name;
        }
        return f_1;
      };
      f_1.getMockName = function () {
        var mockConfig = _this._ensureMockConfig(f_1);
        return mockConfig.mockName || 'jest.fn()';
      };
      if (metadata.mockImpl) {
        f_1.mockImplementation(metadata.mockImpl);
      }
      return f_1;
    }
    else {
      var unknownType = metadata.type || 'undefined type';
      throw new Error("Unrecognized type ".concat(unknownType));
    }
  };
  // 创建模拟函数
  ModuleMocker.prototype._createMockFunction = function (metadata, mockConstructor) {
    var name = metadata.name;
    if (!name) {
      return mockConstructor;
    }
    // Preserve `name` property of mocked function.
    var boundFunctionPrefix = 'bound ';
    var bindCall = '';
    // if-do-while for perf reasons. The common case is for the if to fail.
    if (name.startsWith(boundFunctionPrefix)) {
      do {
        name = name.substring(boundFunctionPrefix.length);
        // Call bind() just to alter the function name.
        bindCall = '.bind(null)';
      } while (name && name.startsWith(boundFunctionPrefix));
    }
    // Special case functions named `mockConstructor` to guard for infinite loops
    if (name === MOCK_CONSTRUCTOR_NAME) {
      return mockConstructor;
    }
    if (
      // It's a syntax error to define functions with a reserved keyword as name
      RESERVED_KEYWORDS.has(name) ||
      // It's also a syntax error to define functions with a name that starts with a number
      /^\d/.test(name)) {
      name = "$".concat(name);
    }
    // It's also a syntax error to define a function with a reserved character
    // as part of it's name.
    if (FUNCTION_NAME_RESERVED_PATTERN.test(name)) {
      name = name.replace(FUNCTION_NAME_RESERVED_REPLACE, '$');
    }
    var body = "return function ".concat(name, "() {") +
      "  return ".concat(MOCK_CONSTRUCTOR_NAME, ".apply(this,arguments);") +
      "}".concat(bindCall);
    var createConstructor = new this._environmentGlobal.Function(MOCK_CONSTRUCTOR_NAME, body);
    return createConstructor(mockConstructor);
  };
  ModuleMocker.prototype._generateMock = function (metadata, callbacks, refs) {
    var _this = this;
    // metadata not compatible but it's the same type, maybe problem with
    // overloading of _makeComponent and not _generateMock?
    // @ts-expect-error - unsure why TSC complains here?
    var mock = this._makeComponent(metadata);
    if (metadata.refID != null) {
      refs[metadata.refID] = mock;
    }
    this._getSlots(metadata.members).forEach(function (slot) {
      var slotMetadata = (metadata.members && metadata.members[slot]) || {};
      if (slotMetadata.ref != null) {
        callbacks.push((function (ref) {
          return function () { return (mock[slot] = refs[ref]); };
        })(slotMetadata.ref));
      }
      else {
        mock[slot] = _this._generateMock(slotMetadata, callbacks, refs);
      }
    });
    if (metadata.type !== 'undefined' &&
      metadata.type !== 'null' &&
      mock.prototype &&
      typeof mock.prototype === 'object') {
      mock.prototype.constructor = mock;
    }
    return mock;
  };
  /**
   * Check whether the given property of an object has been already replaced.
   */
  ModuleMocker.prototype._findReplacedProperty = function (object, propertyKey) {
    for (var _j = 0, _k = this._spyState; _j < _k.length; _j++) {
      var spyState = _k[_j];
      if ('object' in spyState &&
        'property' in spyState &&
        spyState.object === object &&
        spyState.property === propertyKey) {
        return spyState;
      }
    }
    return;
  };
  /**
   * @see README.md
   * @param metadata Metadata for the mock in the schema returned by the
   * getMetadata method of this module.
   */
  ModuleMocker.prototype.generateFromMetadata = function (metadata) {
    var callbacks = [];
    var refs = {};
    var mock = this._generateMock(metadata, callbacks, refs);
    callbacks.forEach(function (setter) { return setter(); });
    return mock;
  };
  /**
   * @see README.md
   * @param component The component for which to retrieve metadata.
   */
  ModuleMocker.prototype.getMetadata = function (component, _refs) {
    var _this = this;
    var refs = _refs || new Map();
    var ref = refs.get(component);
    if (ref != null) {
      return { ref: ref };
    }
    var type = getType(component);
    if (!type) {
      return null;
    }
    var metadata = { type: type };
    if (type === 'constant' ||
      type === 'collection' ||
      type === 'undefined' ||
      type === 'null') {
      metadata.value = component;
      return metadata;
    }
    else if (type === 'function') {
      // @ts-expect-error component is a function so it has a name, but not
      // necessarily a string: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/name#function_names_in_classes
      var componentName = component.name;
      if (typeof componentName === 'string') {
        metadata.name = componentName;
      }
      if (this.isMockFunction(component)) {
        metadata.mockImpl = component.getMockImplementation();
      }
    }
    metadata.refID = refs.size;
    refs.set(component, metadata.refID);
    var members = null;
    // Leave arrays alone
    if (type !== 'array') {
      // @ts-expect-error component is object
      this._getSlots(component).forEach(function (slot) {
        if (type === 'function' &&
          _this.isMockFunction(component) &&
          slot.match(/^mock/)) {
          return;
        }
        // @ts-expect-error no index signature
        var slotMetadata = _this.getMetadata(component[slot], refs);
        if (slotMetadata) {
          if (!members) {
            members = {};
          }
          members[slot] = slotMetadata;
        }
      });
    }
    if (members) {
      metadata.members = members;
    }
    return metadata;
  };
  // 是否是模拟函数
  ModuleMocker.prototype.isMockFunction = function (fn) {
    return fn != null && fn._isMockFunction === true;
  };
  ModuleMocker.prototype.fn = function (implementation) {
    var length = implementation ? implementation.length : 0;
    var fn = this._makeComponent({
      length: length,
      type: 'function',
    });
    if (implementation) {
      fn.mockImplementation(implementation);
    }
    return fn;
  };
  ModuleMocker.prototype.spyOn = function (object, methodKey, accessType) {
    if (object == null ||
      (typeof object !== 'object' && typeof object !== 'function')) {
      throw new Error("Cannot use spyOn on a primitive value; ".concat(this._typeOf(object), " given"));
    }
    if (methodKey == null) {
      throw new Error('No property name supplied');
    }
    if (accessType) {
      return this._spyOnProperty(object, methodKey, accessType);
    }
    var original = object[methodKey];
    if (!original) {
      throw new Error("Property `".concat(String(methodKey), "` does not exist in the provided object"));
    }
    if (!this.isMockFunction(original)) {
      if (typeof original !== 'function') {
        throw new Error("Cannot spy on the `".concat(String(methodKey), "` property because it is not a function; ").concat(this._typeOf(original), " given instead.").concat(typeof original !== 'object'
          ? " If you are trying to mock a property, use `jest.replaceProperty(object, '".concat(String(methodKey), "', value)` instead.")
          : ''));
      }
      var isMethodOwner_1 = Object.prototype.hasOwnProperty.call(object, methodKey);
      var descriptor_1 = Object.getOwnPropertyDescriptor(object, methodKey);
      var proto = Object.getPrototypeOf(object);
      while (!descriptor_1 && proto !== null) {
        descriptor_1 = Object.getOwnPropertyDescriptor(proto, methodKey);
        proto = Object.getPrototypeOf(proto);
      }
      var mock_1;
      if (descriptor_1 && descriptor_1.get) {
        var originalGet_1 = descriptor_1.get;
        mock_1 = this._makeComponent({ type: 'function' }, function () {
          descriptor_1.get = originalGet_1;
          Object.defineProperty(object, methodKey, descriptor_1);
        });
        descriptor_1.get = function () { return mock_1; };
        Object.defineProperty(object, methodKey, descriptor_1);
      }
      else {
        mock_1 = this._makeComponent({ type: 'function' }, function () {
          if (isMethodOwner_1) {
            object[methodKey] = original;
          }
          else {
            delete object[methodKey];
          }
        });
        // @ts-expect-error overriding original method with a Mock
        object[methodKey] = mock_1;
      }
      mock_1.mockImplementation(function () {
        return original.apply(this, arguments);
      });
    }
    return object[methodKey];
  };
  ModuleMocker.prototype._spyOnProperty = function (object, propertyKey, accessType) {
    var descriptor = Object.getOwnPropertyDescriptor(object, propertyKey);
    var proto = Object.getPrototypeOf(object);
    while (!descriptor && proto !== null) {
      descriptor = Object.getOwnPropertyDescriptor(proto, propertyKey);
      proto = Object.getPrototypeOf(proto);
    }
    if (!descriptor) {
      throw new Error("Property `".concat(String(propertyKey), "` does not exist in the provided object"));
    }
    if (!descriptor.configurable) {
      throw new Error("Property `".concat(String(propertyKey), "` is not declared configurable"));
    }
    if (!descriptor[accessType]) {
      throw new Error("Property `".concat(String(propertyKey), "` does not have access type ").concat(accessType));
    }
    var original = descriptor[accessType];
    if (!this.isMockFunction(original)) {
      if (typeof original !== 'function') {
        throw new Error("Cannot spy on the ".concat(String(propertyKey), " property because it is not a function; ").concat(this._typeOf(original), " given instead.").concat(typeof original !== 'object'
          ? " If you are trying to mock a property, use `jest.replaceProperty(object, '".concat(String(propertyKey), "', value)` instead.")
          : ''));
      }
      descriptor[accessType] = this._makeComponent({ type: 'function' }, function () {
        // @ts-expect-error: mock is assignable
        descriptor[accessType] = original;
        Object.defineProperty(object, propertyKey, descriptor);
      });
      descriptor[accessType].mockImplementation(function () {
        // @ts-expect-error - wrong context
        return original.apply(this, arguments);
      });
    }
    Object.defineProperty(object, propertyKey, descriptor);
    return descriptor[accessType];
  };
  ModuleMocker.prototype.replaceProperty = function (object, propertyKey, value) {
    var _this = this;
    if (object == null ||
      (typeof object !== 'object' && typeof object !== 'function')) {
      throw new Error("Cannot use replaceProperty on a primitive value; ".concat(this._typeOf(object), " given"));
    }
    if (propertyKey == null) {
      throw new Error('No property name supplied');
    }
    var descriptor = Object.getOwnPropertyDescriptor(object, propertyKey);
    var proto = Object.getPrototypeOf(object);
    while (!descriptor && proto !== null) {
      descriptor = Object.getOwnPropertyDescriptor(proto, propertyKey);
      proto = Object.getPrototypeOf(proto);
    }
    if (!descriptor) {
      throw new Error("Property `".concat(String(propertyKey), "` does not exist in the provided object"));
    }
    if (!descriptor.configurable) {
      throw new Error("Property `".concat(String(propertyKey), "` is not declared configurable"));
    }
    if (descriptor.get !== undefined) {
      throw new Error("Cannot replace the `".concat(String(propertyKey), "` property because it has a getter. Use `jest.spyOn(object, '").concat(String(propertyKey), "', 'get').mockReturnValue(value)` instead."));
    }
    if (descriptor.set !== undefined) {
      throw new Error("Cannot replace the `".concat(String(propertyKey), "` property because it has a setter. Use `jest.spyOn(object, '").concat(String(propertyKey), "', 'set').mockReturnValue(value)` instead."));
    }
    if (typeof descriptor.value === 'function') {
      throw new Error("Cannot replace the `".concat(String(propertyKey), "` property because it is a function. Use `jest.spyOn(object, '").concat(String(propertyKey), "')` instead."));
    }
    var existingRestore = this._findReplacedProperty(object, propertyKey);
    if (existingRestore) {
      return existingRestore.replaced.replaceValue(value);
    }
    var isPropertyOwner = Object.prototype.hasOwnProperty.call(object, propertyKey);
    var originalValue = descriptor.value;
    var restore = function () {
      if (isPropertyOwner) {
        object[propertyKey] = originalValue;
      }
      else {
        delete object[propertyKey];
      }
    };
    var replaced = {
      replaceValue: function (value) {
        object[propertyKey] = value;
        return replaced;
      },
      restore: function () {
        restore();
        _this._spyState.delete(restore);
      },
    };
    restore.object = object;
    restore.property = propertyKey;
    restore.replaced = replaced;
    this._spyState.add(restore);
    return replaced.replaceValue(value);
  };
  ModuleMocker.prototype.clearAllMocks = function () {
    this._mockState = new WeakMap();
  };
  ModuleMocker.prototype.resetAllMocks = function () {
    this._mockConfigRegistry = new WeakMap();
    this._mockState = new WeakMap();
  };
  ModuleMocker.prototype.restoreAllMocks = function () {
    this._spyState.forEach(function (restore) { return restore(); });
    this._spyState = new Set();
  };
  ModuleMocker.prototype._typeOf = function (value) {
    return value == null ? "".concat(value) : typeof value;
  };
  ModuleMocker.prototype.mocked = function (source, _options) {
    return source;
  };
  return ModuleMocker;
}());
exports.ModuleMocker = ModuleMocker;
var JestMock = new ModuleMocker(globalThis);
exports.fn = JestMock.fn.bind(JestMock);
exports.spyOn = JestMock.spyOn.bind(JestMock);
exports.mocked = JestMock.mocked.bind(JestMock);
exports.replaceProperty = JestMock.replaceProperty.bind(JestMock);
