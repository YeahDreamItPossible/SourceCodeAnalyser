import NodePath from "./path/index.ts";
import { VISITOR_KEYS } from "@babel/types";
import type Scope from "./scope/index.ts";
import type { ExplodedTraverseOptions } from "./index.ts";
import type * as t from "@babel/types";
import type { Visitor } from "./types.ts";
import { popContext, pushContext, resync } from "./path/context.ts";

// 遍历上下文类
// 作用:
// 用于管理AST遍历过程中的状态和操作
export default class TraversalContext<S = unknown> {
  constructor(
    scope: Scope,
    opts: ExplodedTraverseOptions<S>,
    state: S,
    parentPath: NodePath,
  ) {
    // 当前 父节点路径
    this.parentPath = parentPath;
    // 当前 作用域
    this.scope = scope;
    // 当前 状态
    this.state = state;
    // 当前 选项
    this.opts = opts;
  }

  declare parentPath: NodePath;
  declare scope: Scope;
  declare state: S;
  declare opts: ExplodedTraverseOptions<S>;
  // 节点路径队列
  queue: Array<NodePath> | null = null;
  // 优先节点路径队列
  priorityQueue: Array<NodePath> | null = null;

  // 断言: 检查某节点是否可以被遍历
  shouldVisit(node: t.Node): boolean {
    const opts = this.opts as Visitor;
    // 当访问器对象有 enter 或者 exit 属性时
    if (opts.enter || opts.exit) return true;

    // check if we have a visitor for this node
    // 当
    if (opts[node.type]) return true;

    // check if we're going to traverse into this node
    const keys: Array<string> | undefined = VISITOR_KEYS[node.type];
    if (!keys?.length) return false;

    // we need to traverse into this node so ensure that it has children to traverse into!
    for (const key of keys) {
      if (
        // @ts-expect-error key is from visitor keys
        node[key]
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * 创建节点路径(NodePath)实例
   * @param node AST节点
   * @param container 包含该节点的容器
   * @param key 节点在容器中的键
   * @param listKey 如果节点在列表中，则为列表键
   * @returns 创建的NodePath实例
   */
  create(
    node: t.Node,
    container: t.Node | t.Node[],
    key: string | number,
    listKey?: string,
  ): NodePath {
    // We don't need to `.setContext()` here, since `.visitQueue()` already
    // calls `.pushContext`.
    return NodePath.get({
      parentPath: this.parentPath,
      parent: node,
      container,
      key: key,
      listKey,
    });
  }

  /**
   * 将路径添加到队列中
   * @param path 要添加的节点路径
   * @param notPriority 如果为true，则添加到普通队列，否则添加到优先队列
   */
  maybeQueue(path: NodePath, notPriority?: boolean) {
    if (this.queue) {
      if (notPriority) {
        this.queue.push(path);
      } else {
        this.priorityQueue.push(path);
      }
    }
  }

  /**
   * 访问多个节点（数组）
   * @param container 包含多个节点的数组
   * @param parent 父节点
   * @param listKey 列表键
   * @returns 如果遍历被中断返回true，否则返回false
   */
  visitMultiple(container: t.Node[], parent: t.Node, listKey: string) {
    // nothing to traverse!
    if (container.length === 0) return false;

    const queue = [];

    // build up initial queue
    for (let key = 0; key < container.length; key++) {
      const node = container[key];
      if (node && this.shouldVisit(node)) {
        queue.push(this.create(parent, container, key, listKey));
      }
    }

    return this.visitQueue(queue);
  }

  /**
   * 访问单个节点
   * @param node 父节点
   * @param key 节点在父节点中的键
   * @returns 如果遍历被中断返回true，否则返回false
   */
  visitSingle(node: t.Node, key: string): boolean {
    if (
      this.shouldVisit(
        // @ts-expect-error key may not index node
        node[key],
      )
    ) {
      return this.visitQueue([this.create(node, node, key)]);
    } else {
      return false;
    }
  }

  /**
   * 访问队列中的所有节点
   * @param queue 要访问的节点路径队列
   * @returns 如果遍历被中断返回true，否则返回false
   */
  visitQueue(queue: Array<NodePath>): boolean {
    // set queue
    this.queue = queue;
    this.priorityQueue = [];

    const visited = new WeakSet();
    let stop = false;
    let visitIndex = 0;

    // 遍历 队列
    for (; visitIndex < queue.length; ) {
      const path = queue[visitIndex];
      visitIndex++;
      resync.call(path);

      if (
        path.contexts.length === 0 ||
        path.contexts[path.contexts.length - 1] !== this
      ) {
        // The context might already have been pushed when this path was inserted and queued.
        // If we always re-pushed here, we could get duplicates and risk leaving contexts
        // on the stack after the traversal has completed, which could break things.
        pushContext.call(path, this);
      }

      // this path no longer belongs to the tree
      if (path.key === null) continue;

      // ensure we don't visit the same node twice
      const { node } = path;
      if (visited.has(node)) continue;
      if (node) visited.add(node);

      if (path.visit()) {
        stop = true;
        break;
      }

      if (this.priorityQueue.length) {
        stop = this.visitQueue(this.priorityQueue);
        this.priorityQueue = [];
        this.queue = queue;
        if (stop) break;
      }
    }

    // pop contexts
    for (let i = 0; i < visitIndex; i++) {
      popContext.call(queue[i]);
    }

    // clear queue
    this.queue = null;

    return stop;
  }

  /**
   * 访问节点的入口方法
   * @param node 要访问的节点
   * @param key 节点键
   * @returns 如果遍历被中断返回true，否则返回false
   */
  visit(node: t.Node, key: string) {
    // @ts-expect-error key may not index node
    const nodes = node[key] as t.Node | t.Node[] | null;
    if (!nodes) return false;

    if (Array.isArray(nodes)) {
      return this.visitMultiple(nodes, node, key);
    } else {
      return this.visitSingle(node, key);
    }
  }
}
