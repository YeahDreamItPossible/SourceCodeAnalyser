// This file contains methods responsible for maintaining a TraversalContext.

import { traverseNode } from "../traverse-node.ts";
import { SHOULD_SKIP, SHOULD_STOP } from "./index.ts";
import { _markRemoved } from "./removal.ts";
import type TraversalContext from "../context.ts";
import type { VisitPhase } from "../types.ts";
import type NodePath from "./index.ts";
import * as t from "@babel/types";

// 执行 特定的回调函数队列
export function call(this: NodePath, key: VisitPhase): boolean {
  const opts = this.opts;

  this.debug(key);

  if (this.node) {
    if (_call.call(this, opts[key])) return true;
  }

  if (this.node) {
    return _call.call(this, opts[this.node.type]?.[key]);
  }

  return false;
}

// 执行 回调函数队列
export function _call(this: NodePath, fns?: Array<Function>): boolean {
  if (!fns) return false;

  for (const fn of fns) {
    if (!fn) continue;

    const node = this.node;
    if (!node) return true;

    const ret = fn.call(this.state, this, this.state);
    if (ret && typeof ret === "object" && typeof ret.then === "function") {
      throw new Error(
        `You appear to be using a plugin with an async traversal visitor, ` +
          `which your current version of Babel does not support. ` +
          `If you're using a published plugin, you may need to upgrade ` +
          `your @babel/core version.`,
      );
    }
    if (ret) {
      throw new Error(`Unexpected return value from visitor method ${fn}`);
    }

    // node has been replaced, it will have been requeued
    if (this.node !== node) return true;

    // this.shouldSkip || this.shouldStop || this.removed
    if (this._traverseFlags > 0) return true;
  }

  return false;
}

// 断言: 是否要跳过该节点的遍历
export function isDenylisted(this: NodePath): boolean {
  // @ts-expect-error TODO(Babel 8): Remove blacklist
  const denylist = this.opts.denylist ?? this.opts.blacklist;
  return denylist?.includes(this.node.type);
}

if (!process.env.BABEL_8_BREAKING && !USE_ESM) {
  // eslint-disable-next-line no-restricted-globals
  exports.isBlacklisted = isDenylisted;
}

// 恢复 上下文
function restoreContext(path: NodePath, context: TraversalContext) {
  if (path.context !== context) {
    path.context = context;
    path.state = context.state;
    path.opts = context.opts;
  }
}

// 访问
export function visit(this: NodePath): boolean {
  if (!this.node) {
    return false;
  }

  if (this.isDenylisted()) {
    return false;
  }

  if (this.opts.shouldSkip?.(this)) {
    return false;
  }

  const currentContext = this.context;
  // Note: We need to check "this.shouldSkip" first because
  // another visitor can set it to true. Usually .shouldSkip is false
  // before calling the enter visitor, but it can be true in case of
  // a requeued node (e.g. by .replaceWith()) that is then marked
  // with .skip().
  if (this.shouldSkip || call.call(this, "enter")) {
    this.debug("Skip...");
    return this.shouldStop;
  }
  restoreContext(this, currentContext);

  this.debug("Recursing into...");
  this.shouldStop = traverseNode(
    this.node,
    this.opts,
    this.scope,
    this.state,
    this,
    this.skipKeys,
  );

  restoreContext(this, currentContext);

  call.call(this, "exit");

  return this.shouldStop;
}

// 设置 跳过
export function skip(this: NodePath) {
  this.shouldSkip = true;
}

// 设置要跳过遍历的 key
export function skipKey(this: NodePath, key: string) {
  if (this.skipKeys == null) {
    this.skipKeys = {};
  }
  this.skipKeys[key] = true;
}

export function stop(this: NodePath) {
  // this.shouldSkip = true; this.shouldStop = true;
  this._traverseFlags |= SHOULD_SKIP | SHOULD_STOP;
}

// 设置 作用域
export function setScope(this: NodePath) {
  if (this.opts?.noScope) return;

  let path = this.parentPath;

  if (
    // Skip method scope if is computed method key or decorator expression
    ((this.key === "key" || this.listKey === "decorators") &&
      path.isMethod()) ||
    // Skip switch scope if for discriminant (`x` in `switch (x) {}`).
    (this.key === "discriminant" && path.isSwitchStatement())
  ) {
    path = path.parentPath;
  }

  let target;
  while (path && !target) {
    if (path.opts?.noScope) return;

    target = path.scope;
    path = path.parentPath;
  }

  this.scope = this.getScope(target);
  this.scope?.in·it();
}

// 设置 上下文
export function setContext<S = unknown>(
  this: NodePath,
  context?: TraversalContext<S>,
) {
  if (this.skipKeys != null) {
    this.skipKeys = {};
  }
  // this.shouldSkip = false; this.shouldStop = false; this.removed = false;
  this._traverseFlags = 0;

  if (context) {
    this.context = context;
    this.state = context.state;
    // Discard the S type parameter from context.opts
    this.opts = context.opts as typeof this.opts;
  }

  setScope.call(this);

  return this;
}

// 在这里，我们重新同步节点路径“key”和“container”。
// 如果他们改变了，然后，我们尝试通过爬行和查找来重新同步我们内部存储的内容对于新的价值观。
// 重新同步
export function resync(this: NodePath) {
  if (this.removed) return;

  _resyncParent.call(this);
  _resyncList.call(this);
  _resyncKey.call(this);
  //this._resyncRemoved();
}

// 重新同步 父节点路径
export function _resyncParent(this: NodePath) {
  if (this.parentPath) {
    this.parent = this.parentPath.node;
  }
}

// 重新同步 key
export function _resyncKey(this: NodePath) {
  if (!this.container) return;

  if (
    this.node ===
    // @ts-expect-error this.key should present in this.container
    this.container[this.key]
  ) {
    return;
  }

  // grrr, path key is out of sync. this is likely due to a modification to the AST
  // not done through our path APIs

  if (Array.isArray(this.container)) {
    for (let i = 0; i < this.container.length; i++) {
      if (this.container[i] === this.node) {
        setKey.call(this, i);
        return;
      }
    }
  } else {
    for (const key of Object.keys(this.container)) {
      // @ts-expect-error this.key should present in this.container
      if (this.container[key] === this.node) {
        setKey.call(this, key);
        return;
      }
    }
  }

  // ¯\_(ツ)_/¯ who knows where it's gone lol
  this.key = null;
}

// 重新同步
export function _resyncList(this: NodePath) {
  if (!this.parent || !this.inList) return;

  const newContainer =
    // @ts-expect-error this.listKey should present in this.parent
    this.parent[this.listKey];
  if (this.container === newContainer) return;

  // container is out of sync. this is likely the result of it being reassigned
  this.container = newContainer || null;
}

export function _resyncRemoved(this: NodePath) {
  if (
    this.key == null ||
    !this.container ||
    // @ts-expect-error this.key should present in this.container
    this.container[this.key] !== this.node
  ) {
    _markRemoved.call(this);
  }
}

// 从堆栈弹出上下文
export function popContext(this: NodePath) {
  this.contexts.pop();
  if (this.contexts.length > 0) {
    this.setContext(this.contexts[this.contexts.length - 1]);
  } else {
    this.setContext(undefined);
  }
}

// 将上下文推入堆栈
export function pushContext(this: NodePath, context: TraversalContext) {
  this.contexts.push(context);
  this.setContext(context);
}

// 设置节点路径的基本信息
export function setup(
  this: NodePath,
  parentPath: NodePath | undefined,
  container: t.Node | t.Node[],
  listKey: string,
  key: string | number,
) {
  this.listKey = listKey;
  this.container = container;
  this.parentPath = parentPath || this.parentPath;
  setKey.call(this, key);
}

// 设置当前路径的key
export function setKey(this: NodePath, key: string | number) {
  this.key = key;
  this.node =
    // @ts-expect-error this.key must present in this.container
    this.container[this.key];
  this.type = this.node?.type;
}

// 将路径重新加入队列
export function requeue(this: NodePath, pathToQueue = this) {
  if (pathToQueue.removed) return;

  // If a path is skipped, and then replaced with a
  // new one, the new one shouldn't probably be skipped.
  if (process.env.BABEL_8_BREAKING) {
    pathToQueue.shouldSkip = false;
  }

  // TODO(loganfsmyth): This should be switched back to queue in parent contexts
  // automatically once #2892 and #4135 have been resolved. See #4140.
  // let contexts = this._getQueueContexts();
  const contexts = this.contexts;

  for (const context of contexts) {
    context.maybeQueue(pathToQueue);
  }
}

// 重新排队计算属性和装饰器
export function requeueComputedKeyAndDecorators(
  this: NodePath<t.Method | t.Property>,
) {
  const { context, node } = this;
  if (!t.isPrivate(node) && node.computed) {
    context.maybeQueue(this.get("key"));
  }
  if (node.decorators) {
    for (const decorator of this.get("decorators")) {
      context.maybeQueue(decorator);
    }
  }
}

// 获取队列上下文
export function _getQueueContexts(this: NodePath) {
  let path = this;
  let contexts = this.contexts;
  while (!contexts.length) {
    path = path.parentPath;
    if (!path) break;
    contexts = path.contexts;
  }
  return contexts;
}
