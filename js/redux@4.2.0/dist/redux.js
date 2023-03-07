// 逐行阅读源码

/**
 * 名词介绍
 * state tree         =>      当前状态树
 * current node state =>      当前节点状态
 * shallow copy       =>      浅复制
 */

(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
      (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.Redux = {}));
})(this, (function (exports) {
  'use strict';

  // 常量:
  var $$observable = (function () {
    return typeof Symbol === 'function' && Symbol.observable || '@@observable';
  })();

  // 获取随机字串
  var randomString = function randomString() {
    // Number.prototype.toString(36) 转换成36进制
    return Math.random().toString(36).substring(7).split('').join('.');
  };

  // 常量: action type 用于内部逻辑
  // 测试用户reducer是否合理
  var ActionTypes = {
    INIT: "@@redux/INIT" + randomString(),
    REPLACE: "@@redux/REPLACE" + randomString(),
    PROBE_UNKNOWN_ACTION: function PROBE_UNKNOWN_ACTION() {
      return "@@redux/PROBE_UNKNOWN_ACTION" + randomString();
    }
  };
  var ActionTypes$1 = ActionTypes;

  // 类型断言: 判断当前值是否是Object
  function isPlainObject(obj) {
    if (typeof obj !== 'object' || obj === null) return false;
    var proto = obj;
    while (Object.getPrototypeOf(proto) !== null) {
      proto = Object.getPrototypeOf(proto);
    }
    return Object.getPrototypeOf(obj) === proto;
  }

  // 获取数据类型
  // (kindO(https://github.com/jonschlinkert/kind-of)简易实现)
  function miniKindOf(val) {
    if (val === void 0) return 'undefined';
    if (val === null) return 'null';
    var type = typeof val;
    switch (type) {
      case 'boolean':
      case 'string':
      case 'number':
      case 'symbol':
      case 'function':
        {
          return type;
        }
    }
    if (Array.isArray(val)) return 'array';
    if (isDate(val)) return 'date';
    if (isError(val)) return 'error';
    var constructorName = ctorName(val);
    switch (constructorName) {
      case 'Symbol':
      case 'Promise':
      case 'WeakMap':
      case 'WeakSet':
      case 'Map':
      case 'Set':
        return constructorName;
    }

    // other
    return type.slice(8, -1).toLowerCase().replace(/\s/g, '');
  }

  // 获取构造函数名
  function ctorName(val) {
    return typeof val.constructor === 'function' ? val.constructor.name : null;
  }

  // 类型断言: 判断当前值是否是Error Instance
  function isError(val) {
    return val instanceof Error || typeof val.message === 'string' && val.constructor && typeof val.constructor.stackTraceLimit === 'number';
  }

  // 类型断言: 判断当前值是否是Date Instance
  function isDate(val) {
    if (val instanceof Date) return true;
    return typeof val.toDateString === 'function' && typeof val.getDate === 'function' && typeof val.setDate === 'function';
  }

  // 获取数据类型
  function kindOf(val) {
    var typeOfVal = typeof val;
    {
      typeOfVal = miniKindOf(val);
    }
    return typeOfVal;
  }

  // 创建store
  function createStore(reducer, preloadedState, enhancer) {
    var _ref2;
    // 正常化参数,并做版本兼容
    if (typeof preloadedState === 'function' && typeof enhancer === 'function' || typeof enhancer === 'function' && typeof arguments[3] === 'function') {
      throw new Error('It looks like you are passing several store enhancers to ' + 'createStore(). This is not supported. Instead, compose them ' + 'together to a single function. See https://redux.js.org/tutorials/fundamentals/part-4-store#creating-a-store-with-enhancers for an example.');
    }
    if (typeof preloadedState === 'function' && typeof enhancer === 'undefined') {
      enhancer = preloadedState;
      preloadedState = undefined;
    }
    // enhancer(插件)必须是函数
    if (typeof enhancer !== 'undefined') {
      if (typeof enhancer !== 'function') {
        throw new Error("Expected the enhancer to be a function. Instead, received: '" + kindOf(enhancer) + "'");
      }

      // 使用中间件
      return enhancer(createStore)(reducer, preloadedState);
    }
    // reducer必须是函数
    if (typeof reducer !== 'function') {
      throw new Error("Expected the root reducer to be a function. Instead, received: '" + kindOf(reducer) + "'");
    }

    // 应用reducer
    var currentReducer = reducer;

    // state tree
    var currentState = preloadedState;

    var currentListeners = [];

    // 应用监听队列
    var nextListeners = currentListeners;

    // 状态标识: 标识当前处于dispatch阶段
    var isDispatching = false;

    // 浅复制监听队列
    function ensureCanMutateNextListeners() {
      if (nextListeners === currentListeners) {
        nextListeners = currentListeners.slice();
      }
    }

    // 获取当前状态树
    function getState() {
      // 处于 dispatch 阶段时 因为state tree此时经过reducer可能发生变更
      if (isDispatching) {
        throw new Error('You may not call store.getState() while the reducer is executing. ' + 'The reducer has already received the state as an argument. ' + 'Pass it down from the top reducer instead of reading it from the store.');
      }
      return currentState;
    }

    // 监听状态变更
    function subscribe(listener) {
      // 监听者必须是函数
      if (typeof listener !== 'function') {
        throw new Error("Expected the listener to be a function. Instead, received: '" + kindOf(listener) + "'");
      }
      if (isDispatching) {
        throw new Error('You may not call store.subscribe() while the reducer is executing. ' + 'If you would like to be notified after the store has been updated, subscribe from a ' + 'component and invoke store.getState() in the callback to access the latest state. ' + 'See https://redux.js.org/api/store#subscribelistener for more details.');
      }
      var isSubscribed = true;
      ensureCanMutateNextListeners();
      nextListeners.push(listener);

      // 返回值: 移除监听者,移除监听队列中的当前监听者
      return function unsubscribe() {
        if (!isSubscribed) {
          return;
        }
        if (isDispatching) {
          throw new Error('You may not unsubscribe from a store listener while the reducer is executing. ' + 'See https://redux.js.org/api/store#subscribelistener for more details.');
        }
        isSubscribed = false;
        ensureCanMutateNextListeners();
        var index = nextListeners.indexOf(listener);
        nextListeners.splice(index, 1);
        currentListeners = null;
      };
    }

    // 中间件核心: 就是包装dispatch方法
    function dispatch(action) {
      // action 必须是对象
      if (!isPlainObject(action)) {
        throw new Error("Actions must be plain objects. Instead, the actual type was: '" + kindOf(action) + "'. You may need to add middleware to your store setup to handle dispatching other values, such as 'redux-thunk' to handle dispatching functions. See https://redux.js.org/tutorials/fundamentals/part-4-store#middleware and https://redux.js.org/tutorials/fundamentals/part-6-async-logic#using-the-redux-thunk-middleware for examples.");
      }
      // action.type 必须存在,一般是常量
      // TODO: 主要是 reducer 混合后的
      if (typeof action.type === 'undefined') {
        throw new Error('Actions may not have an undefined "type" property. You may have misspelled an action type string constant.');
      }

      if (isDispatching) {
        throw new Error('Reducers may not dispatch actions.');
      }
      try {
        isDispatching = true;
        currentState = currentReducer(currentState, action);
      } finally {
        isDispatching = false;
      }

      // 在状态变更后 监听
      var listeners = currentListeners = nextListeners;
      for (var i = 0; i < listeners.length; i++) {
        var listener = listeners[i];
        listener();
      }

      // TODO: 返回用户自定义的action 是实现中间件的
      // 之前我觉得这个地方应该返回 store 便于链式编程
      // 但是看了中间件之后 觉得返回action 简直是神来之笔
      return action;
    }

    // 替换当前应用reducer
    function replaceReducer(nextReducer) {
      if (typeof nextReducer !== 'function') {
        throw new Error("Expected the nextReducer to be a function. Instead, received: '" + kindOf(nextReducer));
      }
      currentReducer = nextReducer;

      // 初始化(但是仍然保存之前的state tree)
      dispatch({
        type: ActionTypes$1.REPLACE
      });
    }

    // 在状态变更前和变更后分别监听
    function observable() {
      var _ref;
      var outerSubscribe = subscribe;
      return _ref = {
        subscribe: function subscribe(observer) {
          if (typeof observer !== 'object' || observer === null) {
            throw new Error("Expected the observer to be an object. Instead, received: '" + kindOf(observer) + "'");
          }
          function observeState() {
            if (observer.next) {
              observer.next(getState());
            }
          }
          observeState();
          var unsubscribe = outerSubscribe(observeState);
          return {
            unsubscribe: unsubscribe
          };
        }
      }, _ref[$$observable] = function () {
        return this;
      }, _ref;
    }

    // 初始化 获取初始状态
    dispatch({
      type: ActionTypes$1.INIT
    });

    return _ref2 = {
      dispatch: dispatch,
      subscribe: subscribe,
      getState: getState,
      replaceReducer: replaceReducer
    }, _ref2[$$observable] = observable, _ref2;
  }

  // 前缀legacy是为了以后版本升级
  var legacy_createStore = createStore;

  // 输出错误
  function warning(message) {
    if (typeof console !== 'undefined' && typeof console.error === 'function') {
      console.error(message);
    }
    try {
      throw new Error(message);
    } catch (e) { }
  }

  // 收集错误
  // 1. 无效的混合后的reducers错误
  // 2. 无效的state错误(非对象)
  // 3. 混合后的reducers的key 与 state tree 中key 可能存在不一致
  function getUnexpectedStateShapeWarningMessage(inputState, reducers, action, unexpectedKeyCache) {
    var reducerKeys = Object.keys(reducers);
    var argumentName = action && action.type === ActionTypes$1.INIT ? 'preloadedState argument passed to createStore' : 'previous state received by the reducer';

    // 无效的reducers错误
    if (reducerKeys.length === 0) {
      return 'Store does not have a valid reducer. Make sure the argument passed ' + 'to combineReducers is an object whose values are reducers.';
    }

    // 无效的state错误()
    if (!isPlainObject(inputState)) {
      return "The " + argumentName + " has unexpected type of \"" + kindOf(inputState) + "\". Expected argument to be an object with the following " + ("keys: \"" + reducerKeys.join('", "') + "\"");
    }

    // 混合后的reducers的key 与 state tree 中key 可能存在不一致
    var unexpectedKeys = Object.keys(inputState).filter(function (key) {
      return !reducers.hasOwnProperty(key) && !unexpectedKeyCache[key];
    });
    unexpectedKeys.forEach(function (key) {
      unexpectedKeyCache[key] = true;
    });
    if (action && action.type === ActionTypes$1.REPLACE) return;
    if (unexpectedKeys.length > 0) {
      return "Unexpected " + (unexpectedKeys.length > 1 ? 'keys' : 'key') + " " + ("\"" + unexpectedKeys.join('", "') + "\" found in " + argumentName + ". ") + "Expected to find one of the known reducer keys instead: " + ("\"" + reducerKeys.join('", "') + "\". Unexpected keys will be ignored.");
    }
  }

  // 断言: 保证reducer函数的初始状态不能为undefined,否则抛出Error
  function assertReducerShape(reducers) {
    Object.keys(reducers).forEach(function (key) {
      var reducer = reducers[key];
      var initialState = reducer(undefined, {
        type: ActionTypes$1.INIT
      });

      // 保证reducer中的初始状态值不能为undefined
      if (typeof initialState === 'undefined') {
        throw new Error("The slice reducer for key \"" + key + "\" returned undefined during initialization. " + "If the state passed to the reducer is undefined, you must " + "explicitly return the initial state. The initial state may " + "not be undefined. If you don't want to set a value for this reducer, " + "you can use null instead of undefined.");
      }

      // 感觉没啥意义
      if (typeof reducer(undefined, {
        type: ActionTypes$1.PROBE_UNKNOWN_ACTION()
      }) === 'undefined') {
        throw new Error("The slice reducer for key \"" + key + "\" returned undefined when probed with a random type. " + ("Don't try to handle '" + ActionTypes$1.INIT + "' or other actions in \"redux/*\" ") + "namespace. They are considered private. Instead, you must return the " + "current state for any unknown actions, unless it is undefined, " + "in which case you must return the initial state, regardless of the " + "action type. The initial state may not be undefined, but can be null.");
      }
    });
  }

  // 混合reducer
  // 1. 筛选符合特定类型<Function>的reducer
  // 2. 保证每个reducer的初始状态不能为undefined,否则抛出Error
  function combineReducers(reducers) {
    // reducers类型: Map<String, Function>
    var reducerKeys = Object.keys(reducers);

    // 筛选后的reducers
    var finalReducers = {};

    // 筛选(保证reducer<Function>类型)
    for (var i = 0; i < reducerKeys.length; i++) {
      var key = reducerKeys[i];
      {
        if (typeof reducers[key] === 'undefined') {
          warning("No reducer provided for key \"" + key + "\"");
        }
      }
      if (typeof reducers[key] === 'function') {
        finalReducers[key] = reducers[key];
      }
    }

    // 筛选后reducers对应的key
    var finalReducerKeys = Object.keys(finalReducers);

    var unexpectedKeyCache;
    {
      unexpectedKeyCache = {};
    }

    // 收集Error(某个reducer的初始状态为undefined)
    var shapeAssertionError;
    try {
      assertReducerShape(finalReducers);
    } catch (e) {
      shapeAssertionError = e;
    }

    // 返回混合后的reducer
    return function combination(state, action) {
      if (state === void 0) {
        state = {};
      }

      // 抛出某个reducer的初始状态为undefined的错误
      if (shapeAssertionError) {
        throw shapeAssertionError;
      }

      // 再次输入错误
      {
        var warningMessage = getUnexpectedStateShapeWarningMessage(state, finalReducers, action, unexpectedKeyCache);
        if (warningMessage) {
          warning(warningMessage);
        }
      }

      var hasChanged = false;
      var nextState = {};
      for (var _i = 0; _i < finalReducerKeys.length; _i++) {
        var _key = finalReducerKeys[_i];
        var reducer = finalReducers[_key];

        // 某个reducer初始状态
        var previousStateForKey = state[_key];

        // 某个reducer后的状态
        var nextStateForKey = reducer(previousStateForKey, action);

        // 保证每个reducer后的状态不能是undefined
        if (typeof nextStateForKey === 'undefined') {
          var actionType = action && action.type;
          throw new Error("When called with an action of type " + (actionType ? "\"" + String(actionType) + "\"" : '(unknown type)') + ", the slice reducer for key \"" + _key + "\" returned undefined. " + "To ignore an action, you must explicitly return the previous state. " + "If you want this reducer to hold no value, you can return null instead of undefined.");
        }

        // 局部变更state tree中某个节点状态
        nextState[_key] = nextStateForKey;

        // 标识: state tree是否发生变更(通过判断state tree 和 current node state )
        hasChanged = hasChanged || nextStateForKey !== previousStateForKey;
      }

      // 标识: state tree是否发生变更
      hasChanged = hasChanged || finalReducerKeys.length !== Object.keys(state).length;

      // 缓存: 如果state tree某个节点update 则替换掉整个state tree 否则则返回当前 state tree
      return hasChanged ? nextState : state;
    };
  }

  // 绑定单个actioin
  function bindActionCreator(actionCreator, dispatch) {
    return function () {
      return dispatch(actionCreator.apply(this, arguments));
    };
  }

  // 绑定多个action
  function bindActionCreators(actionCreators, dispatch) {
    if (typeof actionCreators === 'function') {
      return bindActionCreator(actionCreators, dispatch);
    }
    if (typeof actionCreators !== 'object' || actionCreators === null) {
      throw new Error("bindActionCreators expected an object or a function, but instead received: '" + kindOf(actionCreators) + "'. " + "Did you write \"import ActionCreators from\" instead of \"import * as ActionCreators from\"?");
    }
    var boundActionCreators = {};
    for (var key in actionCreators) {
      var actionCreator = actionCreators[key];
      if (typeof actionCreator === 'function') {
        boundActionCreators[key] = bindActionCreator(actionCreator, dispatch);
      }
    }
    return boundActionCreators;
  }

  // 返回当前对象所拥有的key
  // enumerableOnly<Boolean>: 是否返回可遍历的symbol类型的key
  function ownKeys(object, enumerableOnly) {
    var keys = Object.keys(object);
    if (Object.getOwnPropertySymbols) {
      var symbols = Object.getOwnPropertySymbols(object);
      // 返回可遍历的symbol类型的key
      enumerableOnly && (symbols = symbols.filter(function (sym) {
        return Object.getOwnPropertyDescriptor(object, sym).enumerable;
      })), keys.push.apply(keys, symbols);
    }
    return keys;
  }

  // 对象扩展
  function _objectSpread2(target) {
    for (var i = 1; i < arguments.length; i++) {
      var source = null != arguments[i] ? arguments[i] : {};
      i % 2 ? ownKeys(Object(source), !0).forEach(function (key) {
        _defineProperty(target, key, source[key]);
      }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) {
        Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
      });
    }
    return target;
  }

  // 对某个对象扩展key 并赋值
  function _defineProperty(obj, key, value) {
    key = _toPropertyKey(key);
    if (key in obj) {
      Object.defineProperty(obj, key, {
        value: value,
        enumerable: true,
        configurable: true,
        writable: true
      });
    } else {
      obj[key] = value;
    }
    return obj;
  }

  //
  function _toPrimitive(input, hint) {
    if (typeof input !== "object" || input === null) return input;
    var prim = input[Symbol.toPrimitive];
    if (prim !== undefined) {
      var res = prim.call(input, hint || "default");
      if (typeof res !== "object") return res;
      throw new TypeError("@@toPrimitive must return a primitive value.");
    }
    return (hint === "string" ? String : Number)(input);
  }

  // 序列化key
  function _toPropertyKey(arg) {
    var key = _toPrimitive(arg, "string");
    return typeof key === "symbol" ? key : String(key);
  }

  // 函数组合(中间件的基础)
  function compose() {
    for (var _len = arguments.length, funcs = new Array(_len), _key = 0; _key < _len; _key++) {
      funcs[_key] = arguments[_key];
    }
    if (funcs.length === 0) {
      return function (arg) {
        return arg;
      };
    }
    if (funcs.length === 1) {
      return funcs[0];
    }
    return funcs.reduce(function (a, b) {
      return function () {
        return a(b.apply(void 0, arguments));
      };
    });
  }

  /**
   * Creates a store enhancer that applies middleware to the dispatch method
   * of the Redux store. This is handy for a variety of tasks, such as expressing
   * asynchronous actions in a concise manner, or logging every action payload.
   *
   * See `redux-thunk` package as an example of the Redux middleware.
   *
   * Because middleware is potentially asynchronous, this should be the first
   * store enhancer in the composition chain.
   *
   * Note that each middleware will be given the `dispatch` and `getState` functions
   * as named arguments.
   *
   * @param {...Function} middlewares The middleware chain to be applied.
   * @returns {Function} A store enhancer applying the middleware.
   */
  // 使用中间件
  // Middleware 只是包装了 store 的 dispatch 方法
  function applyMiddleware() {
    // 1. 先把用户入参解析成插件数组
    for (var _len = arguments.length, middlewares = new Array(_len), _key = 0; _key < _len; _key++) {
      middlewares[_key] = arguments[_key];
    }

    // 2. 函数柯里化
    // 2.1 (createStore) => _createStore
    // 2.2 (reducer, state) => store
    // 包装store的dispatch方法是在步骤2.2生成store后
    return function (createStore) {
      return function () {
        var store = createStore.apply(void 0, arguments);
        // _dispatch作用: 保证在获得chain时返回的必须是一个函数
        var _dispatch = function dispatch() {
          throw new Error('Dispatching while constructing your middleware is not allowed. ' + 'Other middleware would not be applied to this dispatch.');
        };
        var middlewareAPI = {
          getState: store.getState,
          dispatch: function dispatch() {
            return _dispatch.apply(void 0, arguments);
          }
        };
        var chain = middlewares.map(function (middleware) {
          return middleware(middlewareAPI);
        });

        // 绑定用户包装后的dispatch函数
        _dispatch = compose.apply(void 0, chain)(store.dispatch);

        // 扩展store中dispatch
        return _objectSpread2(_objectSpread2({}, store), {}, {
          dispatch: _dispatch
        });
      };
    };
  }

  // 通过dummy fn(伪函数)来测试生产环境 代码是否被压缩混淆
  function isCrushed() { }
  if (typeof isCrushed.name === 'string' && isCrushed.name !== 'isCrushed') {
    warning('You are currently using minified code outside of NODE_ENV === "production". ' + 'This means that you are running a slower development build of Redux. ' + 'You can use loose-envify (https://github.com/zertosh/loose-envify) for browserify ' + 'or setting mode to production in webpack (https://webpack.js.org/concepts/mode/) ' + 'to ensure you have the correct code for your production build.');
  }

  exports.__DO_NOT_USE__ActionTypes = ActionTypes$1;
  exports.applyMiddleware = applyMiddleware;
  exports.bindActionCreators = bindActionCreators;
  exports.combineReducers = combineReducers;
  exports.compose = compose;
  exports.createStore = createStore;
  exports.legacy_createStore = legacy_createStore;

  Object.defineProperty(exports, '__esModule', { value: true });

}));
