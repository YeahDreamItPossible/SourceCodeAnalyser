// 逐行阅读源码

/**
 * 注释中的名词解释
 * store            =>   根状态应用(通过createPinia创建, 一个vue应用中只能有一个根状态应用)
 * substore         =>   子仓库应用(通过defineStore创建,可以有多个,可以共享某个state、getter、action)
 * 
 * options substore =>   选项型子仓库应用(通过defineStore创建, 参数是对象）
 * setup substore   =>   安装型子仓库应用(通过defineStore创建, 参数是setup函数）
 * 
 * root state       =>   根状态(根状态应用中的状态)
 * substate         =>   子仓库(根状态应用中的状态)
 * 
 * subscribe mutation => 主要是通过 watch 来实现
 * subscribe action   => 主要是通过包装action函数来实现
 */

var Pinia = (function (exports, vueDemi) {
  "use strict";

  // 当前激活的store
  let activePinia;
  // 手动设置 当前激活的store
  const setActivePinia = (pinia) => (activePinia = pinia);
  // 获取当前激活的store
  // 1. 可以通过注入的方式
  // 2. 直接获取当前激活的store
  const getActivePinia = () =>
    // 通过注入的方式
    (vueDemi.getCurrentInstance() && vueDemi.inject(piniaSymbol)) ||
    // 直接获取当前激活的store
    activePinia;

  // 标识符: 便于全局提供、注入
  const piniaSymbol = Symbol("pinia");

  // 开发工具调试(可以跳过)
  function getDevtoolsGlobalHook() {
    return getTarget().__VUE_DEVTOOLS_GLOBAL_HOOK__;
  }

  // 获取全局对象
  function getTarget() {
    return typeof navigator !== "undefined" && typeof window !== "undefined"
      ? window
      : typeof global !== "undefined"
      ? global
      : {};
  }

  // 断言: 浏览器是否兼容Proxy
  const isProxyAvailable = typeof Proxy === "function";

  // 开发工具调试(可以跳过)
  const HOOK_SETUP = "devtools-plugin:setup";
  const HOOK_PLUGIN_SETTINGS_SET = "plugin:settings:set";

  // 标识：是否支持window.Performance
  let supported;
  // window.Performance
  let perf;
  // 断言：是否支持window.Performance
  function isPerformanceSupported() {
    var _a;
    if (supported !== undefined) {
      return supported;
    }
    if (typeof window !== "undefined" && window.performance) {
      supported = true;
      perf = window.performance;
    } else if (
      typeof global !== "undefined" &&
      ((_a = global.perf_hooks) === null || _a === void 0
        ? void 0
        : _a.performance)
    ) {
      supported = true;
      perf = global.perf_hooks.performance;
    } else {
      supported = false;
    }
    return supported;
  }
  // 返回当前时间时间戳
  function now() {
    return isPerformanceSupported() ? perf.now() : Date.now();
  }

  class ApiProxy {
    constructor(plugin, hook) {
      this.target = null;
      this.targetQueue = [];
      this.onQueue = [];
      this.plugin = plugin;
      this.hook = hook;
      const defaultSettings = {};
      if (plugin.settings) {
        for (const id in plugin.settings) {
          const item = plugin.settings[id];
          defaultSettings[id] = item.defaultValue;
        }
      }
      const localSettingsSaveId = `__vue-devtools-plugin-settings__${plugin.id}`;
      let currentSettings = Object.assign({}, defaultSettings);
      try {
        const raw = localStorage.getItem(localSettingsSaveId);
        const data = JSON.parse(raw);
        Object.assign(currentSettings, data);
      } catch (e) {
        // noop
      }
      this.fallbacks = {
        getSettings() {
          return currentSettings;
        },
        setSettings(value) {
          try {
            localStorage.setItem(localSettingsSaveId, JSON.stringify(value));
          } catch (e) {
            // noop
          }
          currentSettings = value;
        },
        now() {
          return now();
        },
      };
      if (hook) {
        hook.on(HOOK_PLUGIN_SETTINGS_SET, (pluginId, value) => {
          if (pluginId === this.plugin.id) {
            this.fallbacks.setSettings(value);
          }
        });
      }
      this.proxiedOn = new Proxy(
        {},
        {
          get: (_target, prop) => {
            if (this.target) {
              return this.target.on[prop];
            } else {
              return (...args) => {
                this.onQueue.push({
                  method: prop,
                  args,
                });
              };
            }
          },
        }
      );
      this.proxiedTarget = new Proxy(
        {},
        {
          get: (_target, prop) => {
            if (this.target) {
              return this.target[prop];
            } else if (prop === "on") {
              return this.proxiedOn;
            } else if (Object.keys(this.fallbacks).includes(prop)) {
              return (...args) => {
                this.targetQueue.push({
                  method: prop,
                  args,
                  resolve: () => {},
                });
                return this.fallbacks[prop](...args);
              };
            } else {
              return (...args) => {
                return new Promise((resolve) => {
                  this.targetQueue.push({
                    method: prop,
                    args,
                    resolve,
                  });
                });
              };
            }
          },
        }
      );
    }
    async setRealTarget(target) {
      this.target = target;
      for (const item of this.onQueue) {
        this.target.on[item.method](...item.args);
      }
      for (const item of this.targetQueue) {
        item.resolve(await this.target[item.method](...item.args));
      }
    }
  }

  // 开发工具调试(可以跳过)
  function setupDevtoolsPlugin(pluginDescriptor, setupFn) {
    const descriptor = pluginDescriptor;
    const target = getTarget();
    const hook = getDevtoolsGlobalHook();
    const enableProxy = isProxyAvailable && descriptor.enableEarlyProxy;
    if (
      hook &&
      (target.__VUE_DEVTOOLS_PLUGIN_API_AVAILABLE__ || !enableProxy)
    ) {
      hook.emit(HOOK_SETUP, pluginDescriptor, setupFn);
    } else {
      const proxy = enableProxy ? new ApiProxy(descriptor, hook) : null;
      const list = (target.__VUE_DEVTOOLS_PLUGINS__ =
        target.__VUE_DEVTOOLS_PLUGINS__ || []);
      list.push({
        pluginDescriptor: descriptor,
        setupFn,
        proxy,
      });
      if (proxy) setupFn(proxy.proxiedTarget);
    }
  }

  // 断言: 是否是纯对象(Object的实例)
  function isPlainObject(o) {
    return (
      o &&
      typeof o === "object" &&
      Object.prototype.toString.call(o) === "[object Object]" &&
      typeof o.toJSON !== "function"
    );
  }
  
  // mutation type enum(突变类型枚举)
  exports.MutationType = void 0;
  (function (MutationType) {
    // 标识：直接通过state[key] = value 的方式修改状态
    MutationType["direct"] = "direct";
    
    // 标识: 通过对象($patch({ ... }))的方式修改状态
    MutationType["patchObject"] = "patch object";
    
    // 标识: 通过函数($patch(state => state[key] = value))的方式修改状态
    MutationType["patchFunction"] = "patch function";
    // maybe reset? for $state = {} and $reset
  })(exports.MutationType || (exports.MutationType = {}));

  // 断言: 是否运行于客户端
  const IS_CLIENT = typeof window !== "undefined";
  const USE_DEVTOOLS = IS_CLIENT;

  // 全局对象
  const _global = /*#__PURE__*/ (() =>
    typeof window === "object" && window.window === window
      ? window
      : typeof self === "object" && self.self === self
      ? self
      : typeof global === "object" && global.global === global
      ? global
      : typeof globalThis === "object"
      ? globalThis
      : { HTMLElement: null })();

  // 返回blob
  function bom(blob, { autoBom = false } = {}) {
    // prepend BOM for UTF-8 XML and text/* types (including HTML)
    // note: your browser will automatically convert UTF-16 U+FEFF to EF BB BF
    if (
      autoBom &&
      /^\s*(?:text\/\S*|application\/xml|\S*\/\S*\+xml)\s*;.*charset\s*=\s*utf-8/i.test(blob.type)
    ) {
      return new Blob([String.fromCharCode(0xfeff), blob], { type: blob.type });
    }
    return blob;
  }
  // 下载
  function download(url, name, opts) {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", url);
    xhr.responseType = "blob";
    xhr.onload = function () {
      saveAs(xhr.response, name, opts);
    };
    xhr.onerror = function () {
      console.error("could not download file");
    };
    xhr.send();
  }
  function corsEnabled(url) {
    const xhr = new XMLHttpRequest();
    // use sync to avoid popup blocker
    xhr.open("HEAD", url, false);
    try {
      xhr.send();
    } catch (e) {}
    return xhr.status >= 200 && xhr.status <= 299;
  }

  // `a.click()` doesn't work for all browsers (#465)
  // 触发元素的click事件
  function click(node) {
    try {
      node.dispatchEvent(new MouseEvent("click"));
    } catch (e) {
      const evt = document.createEvent("MouseEvents");
      evt.initMouseEvent(
        "click",
        true,
        true,
        window,
        0,
        0,
        0,
        80,
        20,
        false,
        false,
        false,
        false,
        0,
        null
      );
      node.dispatchEvent(evt);
    }
  }
  const _navigator = typeof navigator === "object" ? navigator : { userAgent: "" };
  // Detect WebView inside a native macOS app by ruling out all browsers
  // We just need to check for 'Safari' because all other browsers (besides Firefox) include that too
  // https://www.whatismybrowser.com/guides/the-latest-user-agent/macos
  const isMacOSWebView = /*#__PURE__*/ (() =>
    /Macintosh/.test(_navigator.userAgent) &&
    /AppleWebKit/.test(_navigator.userAgent) &&
    !/Safari/.test(_navigator.userAgent))();
  const saveAs = !IS_CLIENT
    ? () => {} // noop
    : // Use download attribute first if possible (#193 Lumia mobile) unless this is a macOS WebView or mini program
    typeof HTMLAnchorElement !== "undefined" &&
      "download" in HTMLAnchorElement.prototype &&
      !isMacOSWebView
    ? downloadSaveAs
    : // Use msSaveOrOpenBlob as a second approach
    "msSaveOrOpenBlob" in _navigator
    ? msSaveAs
    : // Fallback to using FileReader and a popup
      fileSaverSaveAs;
  function downloadSaveAs(blob, name = "download", opts) {
    const a = document.createElement("a");
    a.download = name;
    a.rel = "noopener"; // tabnabbing
    // TODO: detect chrome extensions & packaged apps
    // a.target = '_blank'
    if (typeof blob === "string") {
      // Support regular links
      a.href = blob;
      if (a.origin !== location.origin) {
        if (corsEnabled(a.href)) {
          download(blob, name, opts);
        } else {
          a.target = "_blank";
          click(a);
        }
      } else {
        click(a);
      }
    } else {
      // Support blobs
      a.href = URL.createObjectURL(blob);
      setTimeout(function () {
        URL.revokeObjectURL(a.href);
      }, 4e4); // 40s
      setTimeout(function () {
        click(a);
      }, 0);
    }
  }
  function msSaveAs(blob, name = "download", opts) {
    if (typeof blob === "string") {
      if (corsEnabled(blob)) {
        download(blob, name, opts);
      } else {
        const a = document.createElement("a");
        a.href = blob;
        a.target = "_blank";
        setTimeout(function () {
          click(a);
        });
      }
    } else {
      // @ts-ignore: works on windows
      navigator.msSaveOrOpenBlob(bom(blob, opts), name);
    }
  }
  function fileSaverSaveAs(blob, name, opts, popup) {
    // Open a popup immediately do go around popup blocker
    // Mostly only available on user interaction and the fileReader is async so...
    popup = popup || open("", "_blank");
    if (popup) {
      popup.document.title = popup.document.body.innerText = "downloading...";
    }
    if (typeof blob === "string") return download(blob, name, opts);
    const force = blob.type === "application/octet-stream";
    const isSafari =
      /constructor/i.test(String(_global.HTMLElement)) || "safari" in _global;
    const isChromeIOS = /CriOS\/[\d]+/.test(navigator.userAgent);
    if (
      (isChromeIOS || (force && isSafari) || isMacOSWebView) &&
      typeof FileReader !== "undefined"
    ) {
      // Safari doesn't allow downloading of blob URLs
      const reader = new FileReader();
      reader.onloadend = function () {
        let url = reader.result;
        if (typeof url !== "string") {
          popup = null;
          throw new Error("Wrong reader.result type");
        }
        url = isChromeIOS
          ? url
          : url.replace(/^data:[^;]*;/, "data:attachment/file;");
        if (popup) {
          popup.location.href = url;
        } else {
          location.assign(url);
        }
        popup = null; // reverse-tabnabbing #460
      };
      reader.readAsDataURL(blob);
    } else {
      const url = URL.createObjectURL(blob);
      if (popup) popup.location.assign(url);
      else location.href = url;
      popup = null; // reverse-tabnabbing #460
      setTimeout(function () {
        URL.revokeObjectURL(url);
      }, 4e4); // 40s
    }
  }

  /**
   * Shows a toast or console.log
   *
   * @param message - message to log
   * @param type - different color of the tooltip
   */
  function toastMessage(message, type) {
    const piniaMessage = "🍍 " + message;
    if (typeof __VUE_DEVTOOLS_TOAST__ === "function") {
      __VUE_DEVTOOLS_TOAST__(piniaMessage, type);
    } else if (type === "error") {
      console.error(piniaMessage);
    } else if (type === "warn") {
      console.warn(piniaMessage);
    } else {
      console.log(piniaMessage);
    }
  }
  // 断言: 是否时Pinia的实例
  function isPinia(o) {
    return "_a" in o && "install" in o;
  }

  function checkClipboardAccess() {
    if (!("clipboard" in navigator)) {
      toastMessage(`Your browser doesn't support the Clipboard API`, "error");
      return true;
    }
  }
  function checkNotFocusedError(error) {
    if (
      error instanceof Error &&
      error.message.toLowerCase().includes("document is not focused")
    ) {
      toastMessage(
        'You need to activate the "Emulate a focused page" setting in the "Rendering" panel of devtools.',
        "warn"
      );
      return true;
    }
    return false;
  }
  async function actionGlobalCopyState(pinia) {
    if (checkClipboardAccess()) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(pinia.state.value));
      toastMessage("Global state copied to clipboard.");
    } catch (error) {
      if (checkNotFocusedError(error)) return;
      toastMessage(
        `Failed to serialize the state. Check the console for more details.`,
        "error"
      );
      console.error(error);
    }
  }
  async function actionGlobalPasteState(pinia) {
    if (checkClipboardAccess()) return;
    try {
      pinia.state.value = JSON.parse(await navigator.clipboard.readText());
      toastMessage("Global state pasted from clipboard.");
    } catch (error) {
      if (checkNotFocusedError(error)) return;
      toastMessage(
        `Failed to deserialize the state from clipboard. Check the console for more details.`,
        "error"
      );
      console.error(error);
    }
  }
  async function actionGlobalSaveState(pinia) {
    try {
      saveAs(
        new Blob([JSON.stringify(pinia.state.value)], {
          type: "text/plain;charset=utf-8",
        }),
        "pinia-state.json"
      );
    } catch (error) {
      toastMessage(
        `Failed to export the state as JSON. Check the console for more details.`,
        "error"
      );
      console.error(error);
    }
  }
  let fileInput;
  function getFileOpener() {
    if (!fileInput) {
      fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = ".json";
    }
    function openFile() {
      return new Promise((resolve, reject) => {
        fileInput.onchange = async () => {
          const files = fileInput.files;
          if (!files) return resolve(null);
          const file = files.item(0);
          if (!file) return resolve(null);
          return resolve({ text: await file.text(), file });
        };
        // @ts-ignore: TODO: changed from 4.3 to 4.4
        fileInput.oncancel = () => resolve(null);
        fileInput.onerror = reject;
        fileInput.click();
      });
    }
    return openFile;
  }
  async function actionGlobalOpenStateFile(pinia) {
    try {
      const open = await getFileOpener();
      const result = await open();
      if (!result) return;
      const { text, file } = result;
      pinia.state.value = JSON.parse(text);
      toastMessage(`Global state imported from "${file.name}".`);
    } catch (error) {
      toastMessage(
        `Failed to export the state as JSON. Check the console for more details.`,
        "error"
      );
      console.error(error);
    }
  }

  function formatDisplay(display) {
    return {
      _custom: {
        display,
      },
    };
  }
  const PINIA_ROOT_LABEL = "🍍 Pinia (root)";
  const PINIA_ROOT_ID = "_root";
  function formatStoreForInspectorTree(store) {
    return isPinia(store)
      ? {
          id: PINIA_ROOT_ID,
          label: PINIA_ROOT_LABEL,
        }
      : {
          id: store.$id,
          label: store.$id,
        };
  }
  function formatStoreForInspectorState(store) {
    if (isPinia(store)) {
      const storeNames = Array.from(store._s.keys());
      const storeMap = store._s;
      const state = {
        state: storeNames.map((storeId) => ({
          editable: true,
          key: storeId,
          value: store.state.value[storeId],
        })),
        getters: storeNames
          .filter((id) => storeMap.get(id)._getters)
          .map((id) => {
            const store = storeMap.get(id);
            return {
              editable: false,
              key: id,
              value: store._getters.reduce((getters, key) => {
                getters[key] = store[key];
                return getters;
              }, {}),
            };
          }),
      };
      return state;
    }
    const state = {
      state: Object.keys(store.$state).map((key) => ({
        editable: true,
        key,
        value: store.$state[key],
      })),
    };
    // avoid adding empty getters
    if (store._getters && store._getters.length) {
      state.getters = store._getters.map((getterName) => ({
        editable: false,
        key: getterName,
        value: store[getterName],
      }));
    }
    if (store._customProperties.size) {
      state.customProperties = Array.from(store._customProperties).map(
        (key) => ({
          editable: true,
          key,
          value: store[key],
        })
      );
    }
    return state;
  }
  function formatEventData(events) {
    if (!events) return {};
    if (Array.isArray(events)) {
      // TODO: handle add and delete for arrays and objects
      return events.reduce(
        (data, event) => {
          data.keys.push(event.key);
          data.operations.push(event.type);
          data.oldValue[event.key] = event.oldValue;
          data.newValue[event.key] = event.newValue;
          return data;
        },
        {
          oldValue: {},
          keys: [],
          operations: [],
          newValue: {},
        }
      );
    } else {
      return {
        operation: formatDisplay(events.type),
        key: formatDisplay(events.key),
        oldValue: events.oldValue,
        newValue: events.newValue,
      };
    }
  }
  function formatMutationType(type) {
    switch (type) {
      case exports.MutationType.direct:
        return "mutation";
      case exports.MutationType.patchFunction:
        return "$patch";
      case exports.MutationType.patchObject:
        return "$patch";
      default:
        return "unknown";
    }
  }

  // timeline can be paused when directly changing the state
  let isTimelineActive = true;
  const componentStateTypes = [];
  const MUTATIONS_LAYER_ID = "pinia:mutations";
  const INSPECTOR_ID = "pinia";
  const { assign: assign$1 } = Object;
  /**
   * Gets the displayed name of a store in devtools
   *
   * @param id - id of the store
   * @returns a formatted string
   */
  const getStoreType = (id) => "🍍 " + id;
  /**
   * Add the pinia plugin without any store. Allows displaying a Pinia plugin tab
   * as soon as it is added to the application.
   *
   * @param app - Vue application
   * @param pinia - pinia instance
   */
  function registerPiniaDevtools(app, pinia) {
    setupDevtoolsPlugin(
      {
        id: "dev.esm.pinia",
        label: "Pinia 🍍",
        logo: "https://pinia.vuejs.org/logo.svg",
        packageName: "pinia",
        homepage: "https://pinia.vuejs.org",
        componentStateTypes,
        app,
      },
      (api) => {
        if (typeof api.now !== "function") {
          toastMessage(
            "You seem to be using an outdated version of Vue Devtools. Are you still using the Beta release instead of the stable one? You can find the links at https://devtools.vuejs.org/guide/installation.html."
          );
        }
        api.addTimelineLayer({
          id: MUTATIONS_LAYER_ID,
          label: `Pinia 🍍`,
          color: 0xe5df88,
        });
        api.addInspector({
          id: INSPECTOR_ID,
          label: "Pinia 🍍",
          icon: "storage",
          treeFilterPlaceholder: "Search stores",
          actions: [
            {
              icon: "content_copy",
              action: () => {
                actionGlobalCopyState(pinia);
              },
              tooltip: "Serialize and copy the state",
            },
            {
              icon: "content_paste",
              action: async () => {
                await actionGlobalPasteState(pinia);
                api.sendInspectorTree(INSPECTOR_ID);
                api.sendInspectorState(INSPECTOR_ID);
              },
              tooltip: "Replace the state with the content of your clipboard",
            },
            {
              icon: "save",
              action: () => {
                actionGlobalSaveState(pinia);
              },
              tooltip: "Save the state as a JSON file",
            },
            {
              icon: "folder_open",
              action: async () => {
                await actionGlobalOpenStateFile(pinia);
                api.sendInspectorTree(INSPECTOR_ID);
                api.sendInspectorState(INSPECTOR_ID);
              },
              tooltip: "Import the state from a JSON file",
            },
          ],
          nodeActions: [
            {
              icon: "restore",
              tooltip: "Reset the state (option store only)",
              action: (nodeId) => {
                const store = pinia._s.get(nodeId);
                if (!store) {
                  toastMessage(
                    `Cannot reset "${nodeId}" store because it wasn't found.`,
                    "warn"
                  );
                } else if (!store._isOptionsAPI) {
                  toastMessage(
                    `Cannot reset "${nodeId}" store because it's a setup store.`,
                    "warn"
                  );
                } else {
                  store.$reset();
                  toastMessage(`Store "${nodeId}" reset.`);
                }
              },
            },
          ],
        });
        api.on.inspectComponent((payload, ctx) => {
          const proxy =
            payload.componentInstance && payload.componentInstance.proxy;
          if (proxy && proxy._pStores) {
            const piniaStores = payload.componentInstance.proxy._pStores;
            Object.values(piniaStores).forEach((store) => {
              payload.instanceData.state.push({
                type: getStoreType(store.$id),
                key: "state",
                editable: true,
                value: store._isOptionsAPI
                  ? {
                      _custom: {
                        value: vueDemi.toRaw(store.$state),
                        actions: [
                          {
                            icon: "restore",
                            tooltip: "Reset the state of this store",
                            action: () => store.$reset(),
                          },
                        ],
                      },
                    }
                  : // NOTE: workaround to unwrap transferred refs
                    Object.keys(store.$state).reduce((state, key) => {
                      state[key] = store.$state[key];
                      return state;
                    }, {}),
              });
              if (store._getters && store._getters.length) {
                payload.instanceData.state.push({
                  type: getStoreType(store.$id),
                  key: "getters",
                  editable: false,
                  value: store._getters.reduce((getters, key) => {
                    try {
                      getters[key] = store[key];
                    } catch (error) {
                      // @ts-expect-error: we just want to show it in devtools
                      getters[key] = error;
                    }
                    return getters;
                  }, {}),
                });
              }
            });
          }
        });
        api.on.getInspectorTree((payload) => {
          if (payload.app === app && payload.inspectorId === INSPECTOR_ID) {
            let stores = [pinia];
            stores = stores.concat(Array.from(pinia._s.values()));
            payload.rootNodes = (
              payload.filter
                ? stores.filter((store) =>
                    "$id" in store
                      ? store.$id
                          .toLowerCase()
                          .includes(payload.filter.toLowerCase())
                      : PINIA_ROOT_LABEL.toLowerCase().includes(
                          payload.filter.toLowerCase()
                        )
                  )
                : stores
            ).map(formatStoreForInspectorTree);
          }
        });
        api.on.getInspectorState((payload) => {
          if (payload.app === app && payload.inspectorId === INSPECTOR_ID) {
            const inspectedStore =
              payload.nodeId === PINIA_ROOT_ID
                ? pinia
                : pinia._s.get(payload.nodeId);
            if (!inspectedStore) {
              // this could be the selected store restored for a different project
              // so it's better not to say anything here
              return;
            }
            if (inspectedStore) {
              payload.state = formatStoreForInspectorState(inspectedStore);
            }
          }
        });
        api.on.editInspectorState((payload, ctx) => {
          if (payload.app === app && payload.inspectorId === INSPECTOR_ID) {
            const inspectedStore =
              payload.nodeId === PINIA_ROOT_ID
                ? pinia
                : pinia._s.get(payload.nodeId);
            if (!inspectedStore) {
              return toastMessage(
                `store "${payload.nodeId}" not found`,
                "error"
              );
            }
            const { path } = payload;
            if (!isPinia(inspectedStore)) {
              // access only the state
              if (
                path.length !== 1 ||
                !inspectedStore._customProperties.has(path[0]) ||
                path[0] in inspectedStore.$state
              ) {
                path.unshift("$state");
              }
            } else {
              // Root access, we can omit the `.value` because the devtools API does it for us
              path.unshift("state");
            }
            isTimelineActive = false;
            payload.set(inspectedStore, path, payload.state.value);
            isTimelineActive = true;
          }
        });
        api.on.editComponentState((payload) => {
          if (payload.type.startsWith("🍍")) {
            const storeId = payload.type.replace(/^🍍\s*/, "");
            const store = pinia._s.get(storeId);
            if (!store) {
              return toastMessage(`store "${storeId}" not found`, "error");
            }
            const { path } = payload;
            if (path[0] !== "state") {
              return toastMessage(
                `Invalid path for store "${storeId}":\n${path}\nOnly state can be modified.`
              );
            }
            // rewrite the first entry to be able to directly set the state as
            // well as any other path
            path[0] = "$state";
            isTimelineActive = false;
            payload.set(store, path, payload.state.value);
            isTimelineActive = true;
          }
        });
      }
    );
  }
  function addStoreToDevtools(app, store) {
    if (!componentStateTypes.includes(getStoreType(store.$id))) {
      componentStateTypes.push(getStoreType(store.$id));
    }
    setupDevtoolsPlugin(
      {
        id: "dev.esm.pinia",
        label: "Pinia 🍍",
        logo: "https://pinia.vuejs.org/logo.svg",
        packageName: "pinia",
        homepage: "https://pinia.vuejs.org",
        componentStateTypes,
        app,
        settings: {
          logStoreChanges: {
            label: "Notify about new/deleted stores",
            type: "boolean",
            defaultValue: true,
          },
          // useEmojis: {
          //   label: 'Use emojis in messages ⚡️',
          //   type: 'boolean',
          //   defaultValue: true,
          // },
        },
      },
      (api) => {
        // gracefully handle errors
        const now =
          typeof api.now === "function" ? api.now.bind(api) : Date.now;
        store.$onAction(({ after, onError, name, args }) => {
          const groupId = runningActionId++;
          api.addTimelineEvent({
            layerId: MUTATIONS_LAYER_ID,
            event: {
              time: now(),
              title: "🛫 " + name,
              subtitle: "start",
              data: {
                store: formatDisplay(store.$id),
                action: formatDisplay(name),
                args,
              },
              groupId,
            },
          });
          after((result) => {
            activeAction = undefined;
            api.addTimelineEvent({
              layerId: MUTATIONS_LAYER_ID,
              event: {
                time: now(),
                title: "🛬 " + name,
                subtitle: "end",
                data: {
                  store: formatDisplay(store.$id),
                  action: formatDisplay(name),
                  args,
                  result,
                },
                groupId,
              },
            });
          });
          onError((error) => {
            activeAction = undefined;
            api.addTimelineEvent({
              layerId: MUTATIONS_LAYER_ID,
              event: {
                time: now(),
                logType: "error",
                title: "💥 " + name,
                subtitle: "end",
                data: {
                  store: formatDisplay(store.$id),
                  action: formatDisplay(name),
                  args,
                  error,
                },
                groupId,
              },
            });
          });
        }, true);
        store._customProperties.forEach((name) => {
          vueDemi.watch(
            () => vueDemi.unref(store[name]),
            (newValue, oldValue) => {
              api.notifyComponentUpdate();
              api.sendInspectorState(INSPECTOR_ID);
              if (isTimelineActive) {
                api.addTimelineEvent({
                  layerId: MUTATIONS_LAYER_ID,
                  event: {
                    time: now(),
                    title: "Change",
                    subtitle: name,
                    data: {
                      newValue,
                      oldValue,
                    },
                    groupId: activeAction,
                  },
                });
              }
            },
            { deep: true }
          );
        });
        store.$subscribe(
          ({ events, type }, state) => {
            api.notifyComponentUpdate();
            api.sendInspectorState(INSPECTOR_ID);
            if (!isTimelineActive) return;
            // rootStore.state[store.id] = state
            const eventData = {
              time: now(),
              title: formatMutationType(type),
              data: assign$1(
                { store: formatDisplay(store.$id) },
                formatEventData(events)
              ),
              groupId: activeAction,
            };
            // reset for the next mutation
            activeAction = undefined;
            if (type === exports.MutationType.patchFunction) {
              eventData.subtitle = "⤵️";
            } else if (type === exports.MutationType.patchObject) {
              eventData.subtitle = "🧩";
            } else if (events && !Array.isArray(events)) {
              eventData.subtitle = events.type;
            }
            if (events) {
              eventData.data["rawEvent(s)"] = {
                _custom: {
                  display: "DebuggerEvent",
                  type: "object",
                  tooltip: "raw DebuggerEvent[]",
                  value: events,
                },
              };
            }
            api.addTimelineEvent({
              layerId: MUTATIONS_LAYER_ID,
              event: eventData,
            });
          },
          { detached: true, flush: "sync" }
        );
        const hotUpdate = store._hotUpdate;
        store._hotUpdate = vueDemi.markRaw((newStore) => {
          hotUpdate(newStore);
          api.addTimelineEvent({
            layerId: MUTATIONS_LAYER_ID,
            event: {
              time: now(),
              title: "🔥 " + store.$id,
              subtitle: "HMR update",
              data: {
                store: formatDisplay(store.$id),
                info: formatDisplay(`HMR update`),
              },
            },
          });
          // update the devtools too
          api.notifyComponentUpdate();
          api.sendInspectorTree(INSPECTOR_ID);
          api.sendInspectorState(INSPECTOR_ID);
        });
        const { $dispose } = store;
        store.$dispose = () => {
          $dispose();
          api.notifyComponentUpdate();
          api.sendInspectorTree(INSPECTOR_ID);
          api.sendInspectorState(INSPECTOR_ID);
          api.getSettings().logStoreChanges &&
            toastMessage(`Disposed "${store.$id}" store 🗑`);
        };
        // trigger an update so it can display new registered stores
        api.notifyComponentUpdate();
        api.sendInspectorTree(INSPECTOR_ID);
        api.sendInspectorState(INSPECTOR_ID);
        api.getSettings().logStoreChanges &&
          toastMessage(`"${store.$id}" store installed 🆕`);
      }
    );
  }
  let runningActionId = 0;
  let activeAction;
  /**
   * Patches a store to enable action grouping in devtools by wrapping the store with a Proxy that is passed as the
   * context of all actions, allowing us to set `runningAction` on each access and effectively associating any state
   * mutation to the action.
   *
   * @param store - store to patch
   * @param actionNames - list of actionst to patch
   */
  function patchActionForGrouping(store, actionNames) {
    // original actions of the store as they are given by pinia. We are going to override them
    const actions = actionNames.reduce((storeActions, actionName) => {
      // use toRaw to avoid tracking #541
      storeActions[actionName] = vueDemi.toRaw(store)[actionName];
      return storeActions;
    }, {});
    for (const actionName in actions) {
      store[actionName] = function () {
        // setActivePinia(store._p)
        // the running action id is incremented in a before action hook
        const _actionId = runningActionId;
        const trackedStore = new Proxy(store, {
          get(...args) {
            activeAction = _actionId;
            return Reflect.get(...args);
          },
          set(...args) {
            activeAction = _actionId;
            return Reflect.set(...args);
          },
        });
        return actions[actionName].apply(trackedStore, arguments);
      };
    }
  }

  // 开发工具调试(可以跳过)
  function devtoolsPlugin({ app, store, options }) {
    // HMR module
    if (store.$id.startsWith("__hot:")) {
      return;
    }
    // detect option api vs setup api
    if (options.state) {
      store._isOptionsAPI = true;
    }
    // only wrap actions in option-defined stores as this technique relies on
    // wrapping the context of the action with a proxy
    if (typeof options.state === "function") {
      patchActionForGrouping(
        // @ts-expect-error: can cast the store...
        store,
        Object.keys(options.actions)
      );
      const originalHotUpdate = store._hotUpdate;
      // Upgrade the HMR to also update the new actions
      vueDemi.toRaw(store)._hotUpdate = function (newStore) {
        originalHotUpdate.apply(this, arguments);
        patchActionForGrouping(
          store,
          Object.keys(newStore._hmrPayload.actions)
        );
      };
    }
    addStoreToDevtools(
      app,
      // FIXME: is there a way to allow the assignment from Store<Id, S, G, A> to StoreGeneric?
      store
    );
  }

  // 创建: 创建store实例
  function createPinia() {
    // 独立作用域
    const scope = vueDemi.effectScope(true);
    // root state
    const state = scope.run(() => vueDemi.ref({}));

    // 插件集合
    let _p = [];
    // 插件集合
    // 与_p区别: 防止用户在app.use(store)前 store.use(插件)
    let toBeInstalled = [];

    const pinia = vueDemi.markRaw({
      install(app) {
        setActivePinia(pinia);
        if (!vueDemi.isVue2) {
          // 绑定根应用 
          pinia._a = app;

          // 根应用 全局提供 pinia
          app.provide(piniaSymbol, pinia);
          // 根应用 绑定全局变量$pinia
          app.config.globalProperties.$pinia = pinia;
          
          if (USE_DEVTOOLS) {
            registerPiniaDevtools(app, pinia);
          }
          toBeInstalled.forEach((plugin) => _p.push(plugin));
          toBeInstalled = [];
        }
      },

      // 使用插件
      use(plugin) {
        if (!this._a && !vueDemi.isVue2) {
          toBeInstalled.push(plugin);
        } else {
          _p.push(plugin);
        }
        return this;
      },

      // 插件集合
      _p,
      // 根应用
      _a: null,
      // 顶级作用域
      _e: scope,
      // substore Map<id, substore>
      _s: new Map(),
      // root state
      state,
    });
    
    // 调试工具(可跳过)
    if (USE_DEVTOOLS && typeof Proxy !== "undefined") {
      pinia.use(devtoolsPlugin);
    }
    return pinia;
  }

  // 断言: 当前函数是否是useStore
  // 通过判断useStore.$id
  const isUseStore = (fn) => {
    return typeof fn === "function" && typeof fn.$id === "string";
  };

  // 将对象b合并到对象a
  function patchObject(newState, oldState) {
    // no need to go through symbols because they cannot be serialized anyway
    for (const key in oldState) {
      const subPatch = oldState[key];
      // skip the whole sub tree
      if (!(key in newState)) {
        continue;
      }
      const targetValue = newState[key];
      if (
        isPlainObject(targetValue) &&
        isPlainObject(subPatch) &&
        !vueDemi.isRef(subPatch) &&
        !vueDemi.isReactive(subPatch)
      ) {
        newState[key] = patchObject(targetValue, subPatch);
      } else {
        // objects are either a bit more complex (e.g. refs) or primitives, so we
        // just set the whole thing
        if (vueDemi.isVue2) {
          vueDemi.set(newState, key, subPatch);
        } else {
          newState[key] = subPatch;
        }
      }
    }
    return newState;
  }
  /**
   * Creates an _accept_ function to pass to `import.meta.hot` in Vite applications.
   *
   * @example
   * ```js
   * const useUser = defineStore(...)
   * if (import.meta.hot) {
   *   import.meta.hot.accept(acceptHMRUpdate(useUser, import.meta.hot))
   * }
   * ```
   *
   * @param initialUseStore - return of the defineStore to hot update
   * @param hot - `import.meta.hot`
   */
  function acceptHMRUpdate(initialUseStore, hot) {
    return (newModule) => {
      const pinia = hot.data.pinia || initialUseStore._pinia;
      if (!pinia) {
        // this store is still not used
        return;
      }
      // preserve the pinia instance across loads
      hot.data.pinia = pinia;
      // console.log('got data', newStore)
      for (const exportName in newModule) {
        const useStore = newModule[exportName];
        // console.log('checking for', exportName)
        if (isUseStore(useStore) && pinia._s.has(useStore.$id)) {
          // console.log('Accepting update for', useStore.$id)
          const id = useStore.$id;
          if (id !== initialUseStore.$id) {
            console.warn(
              `The id of the store changed from "${initialUseStore.$id}" to "${id}". Reloading.`
            );
            // return import.meta.hot.invalidate()
            return hot.invalidate();
          }
          const existingStore = pinia._s.get(id);
          if (!existingStore) {
            console.log(
              `[Pinia]: skipping hmr because store doesn't exist yet`
            );
            return;
          }
          useStore(pinia, existingStore);
        }
      }
    };
  }

  // 空函数
  const noop = () => {};

  // 添加订阅器
  function addSubscription(
    subscriptions,
    callback,
    detached,
    onCleanup = noop
  ) {
    subscriptions.push(callback);
    
    // 移除订阅器
    const removeSubscription = () => {
      const idx = subscriptions.indexOf(callback);
      if (idx > -1) {
        subscriptions.splice(idx, 1);
        onCleanup();
      }
    };

    // 订阅器默认在组件卸载之后会被卸载
    // 如果手动指定 detached = true 则订阅器默认在组件卸载之后会被保留
    if (!detached && vueDemi.getCurrentScope()) {
      vueDemi.onScopeDispose(removeSubscription);
    }
    return removeSubscription;
  }
  // 触发订阅器
  function triggerSubscriptions(subscriptions, ...args) {
    subscriptions.slice().forEach((callback) => {
      callback(...args);
    });
  }

  // 将对象b合并到对象a中
  function mergeReactiveObjects(target, patchToApply) {
    // 合并Map
    if (target instanceof Map && patchToApply instanceof Map) {
      patchToApply.forEach((value, key) => target.set(key, value));
    }
    
    // 合并Set
    if (target instanceof Set && patchToApply instanceof Set) {
      patchToApply.forEach(target.add, target);
    }
    
    // 合并普通对象
    for (const key in patchToApply) {
      if (!patchToApply.hasOwnProperty(key)) continue;
      const subPatch = patchToApply[key];
      const targetValue = target[key];
      if (
        isPlainObject(targetValue) &&
        isPlainObject(subPatch) &&
        target.hasOwnProperty(key) &&
        !vueDemi.isRef(subPatch) &&
        !vueDemi.isReactive(subPatch)
      ) {
        // 递归合并
        target[key] = mergeReactiveObjects(targetValue, subPatch);
      } else {
        target[key] = subPatch;
      }
    }
    return target;
  }

  const skipHydrateSymbol = Symbol("pinia:skipHydration");
  const skipHydrateMap = /*#__PURE__*/ new WeakMap();
 
  // 跳过
  function skipHydrate(obj) {
    return vueDemi.isVue2
      ? // in @vue/composition-api, the refs are sealed so defineProperty doesn't work...
        /* istanbul ignore next */ skipHydrateMap.set(obj, 1) && obj
      : Object.defineProperty(obj, skipHydrateSymbol, {});
  }

  /**
   * Returns whether a value should be hydrated
   *
   * @param obj - target variable
   * @returns true if `obj` should be hydrated
   */
  function shouldHydrate(obj) {
    return vueDemi.isVue2
      ? /* istanbul ignore next */ !skipHydrateMap.has(obj)
      : !isPlainObject(obj) || !obj.hasOwnProperty(skipHydrateSymbol);
  }
  const { assign } = Object;
  function isComputed(o) {
    return !!(vueDemi.isRef(o) && o.effect);
  }

  // 创建选项式substore(options substore)
  // 底层仍然是通过组合式创建substore实例
  // 1. 定义setup函数 
  // 2. 重写substore的$reset函数
  function createOptionsStore(id, options, pinia, hot) {
    const { state, actions, getters } = options;
    const initialState = pinia.state.value[id];
    let store;
    function setup() {
      // 1. 将state的键值对<key, value>绑定到pinia.state中
      if (!initialState && !hot) {
        if (vueDemi.isVue2) {
          // v2
          vueDemi.set(pinia.state.value, id, state ? state() : {});
        } else {
          // v3
          pinia.state.value[id] = state ? state() : {};
        }
      }

      // 保证store.state[id] 与 substore.$state 中的key保证响应同步
      const localState = hot
        ? vueDemi.toRefs(vueDemi.ref(state ? state() : {}).value)
        : vueDemi.toRefs(pinia.state.value[id]);

      // 返回
      return assign(
        localState,
        actions,
        Object.keys(getters || {}).reduce((computedGetters, name) => {
          // state 与 getters中键冲突
          if (name in localState) {
            console.warn(
              `[🍍]: A getter cannot have the same name as another state property. Rename one of them. Found with "${name}" in store "${id}".`
            );
          }
          computedGetters[name] = vueDemi.markRaw(
            vueDemi.computed(() => {
              setActivePinia(pinia);
              const store = pinia._s.get(id);
              if (vueDemi.isVue2 && !store._r) return;
              return getters[name].call(store, store);
            })
          );
          return computedGetters;
        }, {})
      );
    }

    store = createSetupStore(id, setup, options, pinia, hot, true);
    
    // 状态state
    // 通过重写setup类型substore的$reset方法 
    store.$reset = function $reset() {
      const newState = state ? state() : {};
      // 这里之所以使用函数入参方式 主要是能批量重置所有状态的key
      // 如果使用对象入参方式的话 也是可以的
      this.$patch(($state) => {
        assign($state, newState);
      });
    };

    return store;
  }
  
  // 创建组合式substore(setup substore)
  function createSetupStore(
    $id,
    setup,
    options = {},
    pinia,
    hot,
    isOptionsStore
  ) {
    let scope;
    // 合并选项
    const optionsForPlugin = assign({ actions: {} }, options);

    // 当前store已卸载
    if (!pinia._e.active) {
      throw new Error("Pinia destroyed");
    }

    // mutation订阅器默认选项
    const $subscribeOptions = {
      deep: true,
      // flush: 'post',
    };

    // v3
    if (!vueDemi.isVue2) {
      $subscribeOptions.onTrigger = (event) => {
        /* istanbul ignore else */
        if (isListening) {
          debuggerEvents = event;
          // avoid triggering this while the store is being built and the state is being set in pinia
        } else if (isListening == false && !store._hotUpdating) {
          // let patch send all the events together later
          /* istanbul ignore else */
          if (Array.isArray(debuggerEvents)) {
            debuggerEvents.push(event);
          } else {
            console.error(
              "🍍 debuggerEvents should be an array. This is most likely an internal Pinia bug."
            );
          }
        }
      };
    }

    // 标识: 当前subscribe正在执行中
    let isListening; // set to true at the end
    // 标识: 
    let isSyncListening; // set to true at the end

    // mutation订阅器队列
    let subscriptions = vueDemi.markRaw([]);
    // action订阅器队列
    let actionSubscriptions = vueDemi.markRaw([]);

    let debuggerEvents;

    // 
    const initialState = pinia.state.value[$id];
    
    // 给store.state[id]设置默认值(空对象)
    if (!isOptionsStore && !initialState && !hot) {
      if (vueDemi.isVue2) {
        // v2
        vueDemi.set(pinia.state.value, $id, {});
      } else {
        // v3
        pinia.state.value[$id] = {};
      }
    }

    const hotState = vueDemi.ref({});

    // avoid triggering too many listeners
    // https://github.com/vuejs/pinia/issues/1129
    // 当前正在执行的订阅任务
    let activeListener;

    /**
     * 变更state
     * 1. 直接变更(state[key] = value)
     * 2. 通过$patch函数的方式
     * 通过$patch的方式变更state
     * 1. 以函数的方式
     * 2. 以补丁对象的方式
     */
    function $patch(partialStateOrMutator) {
      let subscriptionMutation;
      isListening = isSyncListening = false;
      
      {
        debuggerEvents = [];
      }

      // 变更state
      // 通过函数来变更state
      if (typeof partialStateOrMutator === "function") {
        partialStateOrMutator(pinia.state.value[$id]);
        // 突变方式
        subscriptionMutation = {
          type: exports.MutationType.patchFunction,
          storeId: $id,
          events: debuggerEvents,
        };
      }
      // 通过补丁对象来变更state
      else {
        mergeReactiveObjects(pinia.state.value[$id], partialStateOrMutator);
        // 突变方式
        subscriptionMutation = {
          type: exports.MutationType.patchObject,
          payload: partialStateOrMutator,
          storeId: $id,
          events: debuggerEvents,
        };
      }
      const myListenerId = (activeListener = Symbol());
      vueDemi.nextTick().then(() => {
        if (activeListener === myListenerId) {
          isListening = true;
        }
      });
      isSyncListening = true;
      
      // 触发state订阅器
      triggerSubscriptions(
        subscriptions,
        subscriptionMutation,
        pinia.state.value[$id]
      );
    }

    // 重置state
    // 只能在选项式中使用
    // 如果在组合式中使用则报错
    const $reset = () => {
      throw new Error(
        `🍍: Store "${$id}" is built using the setup syntax and does not implement $reset().`
      );
    };

    // 销毁当前substore 并将该substore从store中移除
    function $dispose() {
      scope.stop();
      subscriptions = [];
      actionSubscriptions = [];
      pinia._s.delete($id);
    }

    // 包装action
    function wrapAction(name, action) {
      return function () {
        setActivePinia(pinia);
        const args = Array.from(arguments);

        // after队列(action调用后调用该队列)
        const afterCallbackList = [];
        // error队列(action调用报错时调用该队列)
        const onErrorCallbackList = [];
        // 添加after订阅器
        function after(callback) {
          afterCallbackList.push(callback);
        }
        // 添加error订阅器
        function onError(callback) {
          onErrorCallbackList.push(callback);
        }

        // 触发action订阅器
        triggerSubscriptions(actionSubscriptions, {
          args, // 传递给 action 的参数数组
          name, // action名称
          store, // substore实例
          after, // 在 action 返回或解决后的钩子
          onError, // action 抛出或拒绝的钩子
        });

        // 调用action
        let ret;
        try {
          ret = action.apply(this && this.$id === $id ? this : store, args);
        } catch (error) {
          // 触发 error队列
          triggerSubscriptions(onErrorCallbackList, error);
          throw error;
        }

        // 针对 action 返回值是Promise
        if (ret instanceof Promise) {
          return ret
            .then((value) => {
              triggerSubscriptions(afterCallbackList, value);
              return value;
            })
            .catch((error) => {
              triggerSubscriptions(onErrorCallbackList, error);
              return Promise.reject(error);
            });
        }

        // 触发 after队列
        triggerSubscriptions(afterCallbackList, ret);
        return ret;
      };
    }

    // HMR(可以跳过)
    const _hmrPayload = /*#__PURE__*/ vueDemi.markRaw({
      actions: {},
      getters: {},
      state: [],
      hotState,
    });

    // 每个substore共有的属性
    const partialStore = {
      _p: pinia,
      _s: scope,
      $id,
      $onAction: addSubscription.bind(null, actionSubscriptions),
      $patch,
      $reset,
      $subscribe(callback, options = {}) {
        const removeSubscription = addSubscription(
          subscriptions,
          callback,
          options.detached,
          () => stopWatcher()
        );
        const stopWatcher = scope.run(() =>
          vueDemi.watch(
            () => pinia.state.value[$id],
            (state) => {
              if (options.flush === "sync" ? isSyncListening : isListening) {
                callback(
                  {
                    storeId: $id,
                    type: exports.MutationType.direct,
                    events: debuggerEvents,
                  },
                  state
                );
              }
            },
            assign({}, $subscribeOptions, options)
          )
        );
        return removeSubscription;
      },
      $dispose,
    };

    if (vueDemi.isVue2) {
      // 标识：
      // start as non ready
      partialStore._r = false;
    }

    // 将HMR相关属性合并到substore中
    const store = vueDemi.reactive(
      assign(
        {
          _hmrPayload,
          _customProperties: vueDemi.markRaw(new Set()), // devtools custom properties
        },
        partialStore
      )
    );

    // store缓存当前substore
    pinia._s.set($id, store);

    /**
     * 返回setup函数的返回值
     * 即: state getters actions
     */
    const setupStore = pinia._e.run(() => {
      // 创建substore副作用域
      scope = vueDemi.effectScope();
      return scope.run(() => setup());
    });

    /**
     * 根据setup函数返回值的值类型 重新绑定state getters actions到substore中
     * 1. 将响应式类型的键值对<key, value>绑定到pinia.state中
     * 2. 将函数类型的键值对<key, value>绑定到substore中(包装后的action)
     * 3. 将计算属性类型的键值对<key, value>绑定到substore._getters中
     */
    // 分别将 state getters actions中的<key, value>绑定到setup substore
    for (const key in setupStore) {
      const prop = setupStore[key];
      if (
        (vueDemi.isRef(prop) && !isComputed(prop)) ||
        vueDemi.isReactive(prop)
      ) {
        // 1. 绑定state
        if (hot) {
          // HMR(可以跳过)
          vueDemi.set(hotState.value, key, vueDemi.toRef(setupStore, key));
          // createOptionStore directly sets the state in pinia.state.value so we
          // can just skip that
        } 
        else if (!isOptionsStore) {
          // in setup stores we must hydrate the state and sync pinia state tree with the refs the user just created
          if (initialState && shouldHydrate(prop)) {
            if (vueDemi.isRef(prop)) {
              prop.value = initialState[key];
            } else {
              // probably a reactive object, lets recursively assign
              // @ts-expect-error: prop is unknown
              mergeReactiveObjects(prop, initialState[key]);
            }
          }
          // 注意: 
          // 是将响应式类型的键值对<key, value>绑定到pinia.state中
          // substore中已经包含响应式类型的键值对<key, value>
          if (vueDemi.isVue2) {
            vueDemi.set(pinia.state.value[$id], key, prop);
          } else {
            pinia.state.value[$id][key] = prop;
          }
        }

        // HMR(可以跳过)
        {
          _hmrPayload.state.push(key);
        }
      } 
      else if (typeof prop === "function") {
        // 2. 绑定actions
        // 包装action
        const actionValue = hot ? prop : wrapAction(key, prop);
        // 将函数类型的键值对<key, value>绑定到substore中(包装后的action)
        if (vueDemi.isVue2) {
          vueDemi.set(setupStore, key, actionValue);
        } else {
          setupStore[key] = actionValue;
        }

        // HMR(可以跳过)
        {
          _hmrPayload.actions[key] = prop;
        }
        
        optionsForPlugin.actions[key] = prop;
      } else {
        // 3. 绑定getters
        
        if (isComputed(prop)) {
          // HMR(可以跳过)
          _hmrPayload.getters[key] = isOptionsStore
            ? // @ts-expect-error
              options.getters[key]
            : prop;
          // 将计算属性类型的键值对<key, value>绑定到substore._getters中
          if (IS_CLIENT) {
            const getters =
              setupStore._getters ||
              (setupStore._getters = vueDemi.markRaw([]));
            getters.push(key);
          }
        }
      }
    }
    
    // 将(重新绑定setup函数返回值的)substore属性合并到共用的substore中
    if (vueDemi.isVue2) {
      Object.keys(setupStore).forEach((key) => {
        vueDemi.set(store, key, setupStore[key]);
      });
    } else {
      assign(store, setupStore);
      assign(vueDemi.toRaw(store), setupStore);
    }
    
    // 绑定substore.$state
    // 当读取substore.state的键时 实际上访问的是pinia.state的键
    Object.defineProperty(store, "$state", {
      get: () => (hot ? hotState.value : pinia.state.value[$id]),
      set: (state) => {
        // HMR(可以跳过)
        if (hot) {
          throw new Error("cannot set hotState");
        }
        $patch(($state) => {
          assign($state, state);
        });
      },
    });

    // HMR(可以跳过)
    {
      store._hotUpdate = vueDemi.markRaw((newStore) => {
        store._hotUpdating = true;
        newStore._hmrPayload.state.forEach((stateKey) => {
          if (stateKey in store.$state) {
            const newStateTarget = newStore.$state[stateKey];
            const oldStateSource = store.$state[stateKey];
            if (
              typeof newStateTarget === "object" &&
              isPlainObject(newStateTarget) &&
              isPlainObject(oldStateSource)
            ) {
              patchObject(newStateTarget, oldStateSource);
            } else {
              // transfer the ref
              newStore.$state[stateKey] = oldStateSource;
            }
          }
          // patch direct access properties to allow store.stateProperty to work as
          // store.$state.stateProperty
          vueDemi.set(
            store,
            stateKey,
            vueDemi.toRef(newStore.$state, stateKey)
          );
        });
        // remove deleted state properties
        Object.keys(store.$state).forEach((stateKey) => {
          if (!(stateKey in newStore.$state)) {
            vueDemi.del(store, stateKey);
          }
        });
        // avoid devtools logging this as a mutation
        isListening = false;
        isSyncListening = false;
        pinia.state.value[$id] = vueDemi.toRef(
          newStore._hmrPayload,
          "hotState"
        );
        isSyncListening = true;
        vueDemi.nextTick().then(() => {
          isListening = true;
        });
        for (const actionName in newStore._hmrPayload.actions) {
          const action = newStore[actionName];
          vueDemi.set(store, actionName, wrapAction(actionName, action));
        }
        // TODO: does this work in both setup and option store?
        for (const getterName in newStore._hmrPayload.getters) {
          const getter = newStore._hmrPayload.getters[getterName];
          const getterValue = isOptionsStore
            ? // special handling of options api
              vueDemi.computed(() => {
                setActivePinia(pinia);
                return getter.call(store, store);
              })
            : getter;
          vueDemi.set(store, getterName, getterValue);
        }
        // remove deleted getters
        Object.keys(store._hmrPayload.getters).forEach((key) => {
          if (!(key in newStore._hmrPayload.getters)) {
            vueDemi.del(store, key);
          }
        });
        // remove old actions
        Object.keys(store._hmrPayload.actions).forEach((key) => {
          if (!(key in newStore._hmrPayload.actions)) {
            vueDemi.del(store, key);
          }
        });
        // update the values used in devtools and to allow deleting new properties later on
        store._hmrPayload = newStore._hmrPayload;
        store._getters = newStore._getters;
        store._hotUpdating = false;
      });
    }
    // 开发工具调试(可以跳过)
    if (USE_DEVTOOLS) {
      const nonEnumerable = {
        writable: true,
        configurable: true,
        // avoid warning on devtools trying to display this property
        enumerable: false,
      };
      ["_p", "_hmrPayload", "_getters", "_customProperties"].forEach((p) => {
        Object.defineProperty(
          store,
          p,
          assign({ value: store[p] }, nonEnumerable)
        );
      });
    }

    // 
    if (vueDemi.isVue2) {
      // mark the store as ready before plugins
      store._r = true;
    }

    // 使用pinia插件
    pinia._p.forEach((extender) => {
      /* istanbul ignore else */
      if (USE_DEVTOOLS) {
        const extensions = scope.run(() =>
          extender({
            store,
            app: pinia._a,
            pinia,
            options: optionsForPlugin,
          })
        );
        Object.keys(extensions || {}).forEach((key) =>
          store._customProperties.add(key)
        );
        assign(store, extensions);
      } else {
        assign(
          store,
          scope.run(() =>
            extender({
              store,
              app: pinia._a,
              pinia,
              options: optionsForPlugin,
            })
          )
        );
      }
    });

    // 字段类型校验
    // 保store.$state 不能是类的实例(class instance)
    if (
      store.$state &&
      typeof store.$state === "object" &&
      typeof store.$state.constructor === "function" &&
      !store.$state.constructor.toString().includes("[native code]")
    ) {
      console.warn(
        `[🍍]: The "state" must be a plain object. It cannot be\n` +
          `\tstate: () => new MyClass()\n` +
          `Found in store "${store.$id}".`
      );
    }

    // only apply hydrate to option stores with an initial state in pinia
    if (initialState && isOptionsStore && options.hydrate) {
      options.hydrate(store.$state, initialState);
    }
    isListening = true;
    isSyncListening = true;
    return store;
  }

  // 定义substore
  // 入参: (id, options) || ({id, ...options}) || (id, fn, options)
  // options 包含 state getters actions
  function defineStore(
    idOrOptions,
    setup,
    setupOptions
  ) {
    // substore标识
    let id;
    // substore选项
    let options;
    // 断言: 是否是setup函数
    const isSetupStore = typeof setup === "function";

    // 初始化id 和 options
    if (typeof idOrOptions === "string") {
      id = idOrOptions;
      options = isSetupStore ? setupOptions : setup;
    } else {
      options = idOrOptions;
      id = idOrOptions.id;
    }

    function useStore(pinia, hot) {
      // 获取当前运行的组件实例
      const currentInstance = vueDemi.getCurrentInstance();

      // 获取当前激活的store
      pinia = pinia || (currentInstance && vueDemi.inject(piniaSymbol, null));
      
      // 防止用户在根应用未使用store的情况下 使用substore
      if (pinia) setActivePinia(pinia);

      // 如果当前激活的store不存在
      // 则表示 vue app 未安装pinia
      if (!activePinia) {
        throw new Error(
          `[🍍]: getActivePinia was called with no active Pinia. Did you forget to install pinia?\n` +
            `\tconst pinia = createPinia()\n` +
            `\tapp.use(pinia)\n` +
            `This will fail in production.`
        );
      }
      pinia = activePinia;

      if (!pinia._s.has(id)) {
        // 根据defineStore不同的参数类型 创建不同的substore
        if (isSetupStore) {
          // 创建组合式substore
          createSetupStore(id, setup, options, pinia);
        } else {
          // 创建选项式substore
          createOptionsStore(id, options, pinia);
        }
        
        // 将pinia绑定到useStore函数中
        {
          useStore._pinia = pinia;
        }

      }

      const store = pinia._s.get(id);

      // HMR(可以跳过)
      if (hot) {
        const hotId = "__hot:" + id;
        const newStore = isSetupStore
          ? createSetupStore(hotId, setup, options, pinia, true)
          : createOptionsStore(hotId, assign({}, options), pinia, true);
        hot._hotUpdate(newStore);
        delete pinia.state.value[hotId];
        pinia._s.delete(hotId);
      }
      // 开发工具调试(可以跳过)
      if (
        IS_CLIENT &&
        currentInstance &&
        currentInstance.proxy &&
        // avoid adding stores that are just built for hot module replacement
        !hot
      ) {
        const vm = currentInstance.proxy;
        const cache = "_pStores" in vm ? vm._pStores : (vm._pStores = {});
        cache[id] = store;
      }

      return store;
    }
    useStore.$id = id;
    return useStore;
  }

  let mapStoreSuffix = "Store";
  // 设置前缀(用于mapStores)
  function setMapStoreSuffix(
    suffix
  ) {
    mapStoreSuffix = suffix;
  }

  // 辅助函数: 返回对象(该对象包括所有的substore)
  function mapStores(...stores) {
    if (Array.isArray(stores[0])) {
      console.warn(
        `[🍍]: Directly pass all stores to "mapStores()" without putting them in an array:\n` +
          `Replace\n` +
          `\tmapStores([useAuthStore, useCartStore])\n` +
          `with\n` +
          `\tmapStores(useAuthStore, useCartStore)\n` +
          `This will fail in production if not fixed.`
      );
      stores = stores[0];
    }
    return stores.reduce((reduced, useStore) => {
      reduced[useStore.$id + mapStoreSuffix] = function () {
        return useStore(this.$pinia);
      };
      return reduced;
    }, {});
  }
  
  // 辅助函数: 返回某个substore中筛选后的只读state
  // 该state是只读的 不能被修改
  // 第一个参数是 useStore 不是substore
  // keysOrMapper<Arrat<Key> || Object<key, value>>
  function mapState(useStore, keysOrMapper) {
    return Array.isArray(keysOrMapper)
      ? keysOrMapper.reduce((reduced, key) => {
          reduced[key] = function () {
            // 这里的this是vue组件实例
            return useStore(this.$pinia)[key];
          };
          return reduced;
        }, {})
      : Object.keys(keysOrMapper).reduce((reduced, key) => {
          reduced[key] = function () {
            const store = useStore(this.$pinia);
            const storeKey = keysOrMapper[key];
            return typeof storeKey === "function"
              ? storeKey.call(this, store)
              : store[storeKey];
          };
          return reduced;
        }, {});
  }
 
  // 辅助函数: 返回某个substore中筛选后的getters
  // 作用同mapState
  const mapGetters = mapState;
  
  // 辅助函数: 返回某个substore中筛选后的actions 
  // 第一个参数是 useStore 不是substore
  // keysOrMapper<Arrat<Key> || Object<key, value>>
  function mapActions(useStore, keysOrMapper) {
    return Array.isArray(keysOrMapper)
      ? keysOrMapper.reduce((reduced, key) => {
          reduced[key] = function (...args) {
            return useStore(this.$pinia)[key](...args);
          };
          return reduced;
        }, {})
      : Object.keys(keysOrMapper).reduce((reduced, key) => {
          reduced[key] = function (...args) {
            return useStore(this.$pinia)[keysOrMapper[key]](...args);
          };
          return reduced;
        }, {});
  }

  // 辅助函数: 返回某个substore中筛选后的state
  // 该state可读可写
  // 第一个参数是 useStore 不是substore
  // keysOrMapper<Arrat<Key> || Object<key, value>>
  function mapWritableState(useStore, keysOrMapper) {
    return Array.isArray(keysOrMapper)
      ? keysOrMapper.reduce((reduced, key) => {
          reduced[key] = {
            get() {
              return useStore(this.$pinia)[key];
            },
            set(value) {
              return (useStore(this.$pinia)[key] = value);
            },
          };
          return reduced;
        }, {})
      : Object.keys(keysOrMapper).reduce((reduced, key) => {
          // @ts-ignore
          reduced[key] = {
            get() {
              return useStore(this.$pinia)[keysOrMapper[key]];
            },
            set(value) {
              // it's easier to type it here as any
              return (useStore(this.$pinia)[keysOrMapper[key]] = value);
            },
          };
          return reduced;
        }, {});
  }

  // 允许在未安装Pinia时 使用substore 并保持substore响应式
  function storeToRefs(store) {
    if (vueDemi.isVue2) {
      return vueDemi.toRefs(store);
    } else {
      store = vueDemi.toRaw(store);
      const refs = {};
      for (const key in store) {
        const value = store[key];
        if (vueDemi.isRef(value) || vueDemi.isReactive(value)) {
          refs[key] = vueDemi.toRef(store, key);
        }
      }
      return refs;
    }
  }

  // 兼容Vue@2 或者 Vue@3选项式组件
  const PiniaVuePlugin = function (_Vue) {
    // 等价于 app.config.globalProperties.$pinia = pinia
    _Vue.mixin({
      beforeCreate() {
        const options = this.$options;
        if (options.pinia) {
          const pinia = options.pinia;
          // HACK: taken from provide(): https://github.com/vuejs/composition-api/blob/main/src/apis/inject.ts#L31
          /* istanbul ignore else */
          if (!this._provided) {
            const provideCache = {};
            Object.defineProperty(this, "_provided", {
              get: () => provideCache,
              set: (v) => Object.assign(provideCache, v),
            });
          }
          this._provided[piniaSymbol] = pinia;
          // propagate the pinia instance in an SSR friendly way
          // avoid adding it to nuxt twice
          /* istanbul ignore else */
          if (!this.$pinia) {
            this.$pinia = pinia;
          }
          pinia._a = this;
          if (IS_CLIENT) {
            // this allows calling useStore() outside of a component setup after
            // installing pinia's plugin
            setActivePinia(pinia);
          }
          if (USE_DEVTOOLS) {
            registerPiniaDevtools(pinia._a, pinia);
          }
        } else if (!this.$pinia && options.parent && options.parent.$pinia) {
          this.$pinia = options.parent.$pinia;
        }
      },
      destroyed() {
        delete this._pStores;
      },
    });
  };

  exports.PiniaVuePlugin = PiniaVuePlugin;
  exports.acceptHMRUpdate = acceptHMRUpdate;
  exports.createPinia = createPinia;
  exports.defineStore = defineStore;
  exports.getActivePinia = getActivePinia;
  exports.mapActions = mapActions;
  exports.mapGetters = mapGetters;
  exports.mapState = mapState;
  exports.mapStores = mapStores;
  exports.mapWritableState = mapWritableState;
  exports.setActivePinia = setActivePinia;
  exports.setMapStoreSuffix = setMapStoreSuffix;
  exports.skipHydrate = skipHydrate;
  exports.storeToRefs = storeToRefs;

  Object.defineProperty(exports, "__esModule", { value: true });

  return exports;
})({}, VueDemi);
