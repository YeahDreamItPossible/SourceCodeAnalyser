'use strict';

import utils from './utils.js';
import bind from './helpers/bind.js';
import Axios from './core/Axios.js';
import mergeConfig from './core/mergeConfig.js';
import defaults from './defaults/index.js';
import formDataToJSON from './helpers/formDataToJSON.js';
import CanceledError from './cancel/CanceledError.js';
import CancelToken from './cancel/CancelToken.js';
import isCancel from './cancel/isCancel.js';
import {VERSION} from './env/data.js';
import toFormData from './helpers/toFormData.js';
import AxiosError from './core/AxiosError.js';
import spread from './helpers/spread.js';
import isAxiosError from './helpers/isAxiosError.js';
import AxiosHeaders from "./core/AxiosHeaders.js";

// 创建实例
function createInstance(defaultConfig) {
  // 创建Axios的实例
  const context = new Axios(defaultConfig);
  // instance是个函数
  // 1. 内部将Axios.prototype.request绑定到context
  // 2. 并接受新的参数
  const instance = bind(Axios.prototype.request, context);

  // 将Axios.prototype属性扩展到instance
  utils.extend(instance, Axios.prototype, context, {allOwnKeys: true});

  // 将Axios实例属性扩展到instance
  utils.extend(instance, context, null, {allOwnKeys: true});

  // 工厂函数
  instance.create = function create(instanceConfig) {
    return createInstance(mergeConfig(defaultConfig, instanceConfig));
  };

  return instance;
}

// 创建默认配置的实例(便于使用者不做任何配置,快速开发)
const axios = createInstance(defaults);

// 绑定Axios
axios.Axios = Axios;

// Expose Cancel & CancelToken
axios.CanceledError = CanceledError;

// 取消接口请求
axios.CancelToken = CancelToken;

// 标记当前请求错误类型
axios.isCancel = isCancel;

// 标记当前库版本
// 缺点: 是自定义变量来控制 个人觉得最好通过package 版本来控制更合理些
axios.VERSION = VERSION;

// 
axios.toFormData = toFormData;

// 自定义Error错误
axios.AxiosError = AxiosError;

// alias for CanceledError for backward compatibility
axios.Cancel = axios.CanceledError;

// Expose all/spread
axios.all = function all(promises) {
  return Promise.all(promises);
};

// NOTE:
axios.spread = spread;

// Expose isAxiosError
// 标记当前Error类型是自定义AxiosError
axios.isAxiosError = isAxiosError;

// Expose mergeConfig
axios.mergeConfig = mergeConfig;

axios.AxiosHeaders = AxiosHeaders;

// 将 FormData(或者 HTMLFormElement DOM) 转换成 Javascript Object
axios.formToJSON = thing => formDataToJSON(utils.isHTMLForm(thing) ? new FormData(thing) : thing);

// 循环引用
axios.default = axios;

// 导出命名空间 axios
export default axios
