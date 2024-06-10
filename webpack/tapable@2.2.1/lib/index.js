"use strict";

/**
 * 同步钩子(SyncHook)：
 * 1. SyncHook 是按照注册事件队列 依次执行
 * 2. 适用于不需要等待异步操作完成的场景
 * 异步钩子(AsyncHook)
 * 1. AsyncHook 是按照注册事件队列 串行执行 允许在回调中执行异步操作
 * 2. 通常用于需要等待异步操作（如 I/O、网络请求等）完成的场景
 */

/**
 * 异步串行钩子(AsyncSeriesHook) 和  区别:
 * 1. AsyncHook 是按照注册事件队列 串行执行
 * 2. 适用于需要按照特定顺序执行异步操作的场景
 * 异步并行钩子(AsyncParallelHook):
 * 1. AsyncHook 是按照注册事件队列 并行执行
 * 2. 适用于多个异步操作可以独立执行 不需要特定顺序的场景
 */

exports.__esModule = true;
// 同步钩子
exports.SyncHook = require("./SyncHook");
// 同步拦截钩子
exports.SyncBailHook = require("./SyncBailHook");
// 同步瀑布钩子
exports.SyncWaterfallHook = require("./SyncWaterfallHook");
// 同步循环钩子
exports.SyncLoopHook = require("./SyncLoopHook");
// 异步并行钩子
exports.AsyncParallelHook = require("./AsyncParallelHook");
// 异步并行拦截钩子
exports.AsyncParallelBailHook = require("./AsyncParallelBailHook");
// 异步串行钩子
exports.AsyncSeriesHook = require("./AsyncSeriesHook");
// 异步串行拦截钩子
exports.AsyncSeriesBailHook = require("./AsyncSeriesBailHook");
// 异步串行循环钩子
exports.AsyncSeriesLoopHook = require("./AsyncSeriesLoopHook");
// 异步串行瀑布钩子
exports.AsyncSeriesWaterfallHook = require("./AsyncSeriesWaterfallHook");
// 钩子映射
exports.HookMap = require("./HookMap");
// 多重钩子
exports.MultiHook = require("./MultiHook");
