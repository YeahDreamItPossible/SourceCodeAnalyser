import type Suite from './jasmine/Suite';

type Options = {
  nodeComplete: (suite: TreeNode) => void;
  nodeStart: (suite: TreeNode) => void;
  queueRunnerFactory: any;
  runnableIds: Array<string>;
  tree: TreeNode;
};

export type TreeNode = {
  afterAllFns: Array<unknown>;
  beforeAllFns: Array<unknown>;
  disabled?: boolean;
  execute: (onComplete: () => void, enabled: boolean) => void;
  id: string;
  onException: (error: Error) => void;
  sharedUserContext: () => unknown;
  children?: Array<TreeNode>;
} & Pick<Suite, 'getResult' | 'parentSuite' | 'result' | 'markedPending'>;

// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop = () => {};

export default function treeProcessor(options: Options): void {
  const {nodeComplete, nodeStart, queueRunnerFactory, runnableIds, tree} =
    options;

  function isEnabled(node: TreeNode, parentEnabled: boolean) {
    return parentEnabled || runnableIds.indexOf(node.id) !== -1;
  }

  function getNodeHandler(node: TreeNode, parentEnabled: boolean) {
    const enabled = isEnabled(node, parentEnabled);
    return node.children
      ? getNodeWithChildrenHandler(node, enabled)
      : getNodeWithoutChildrenHandler(node, enabled);
  }

  function getNodeWithoutChildrenHandler(node: TreeNode, enabled: boolean) {
    return function fn(done: (error?: unknown) => void = noop) {
      node.execute(done, enabled);
    };
  }

  function getNodeWithChildrenHandler(node: TreeNode, enabled: boolean) {
    return async function fn(done: (error?: unknown) => void = noop) {
      nodeStart(node);
      await queueRunnerFactory({
        onException: (error: Error) => node.onException(error),
        queueableFns: wrapChildren(node, enabled),
        userContext: node.sharedUserContext(),
      });
      nodeComplete(node);
      done();
    };
  }

  function hasNoEnabledTest(node: TreeNode): boolean {
    return (
      node.disabled ||
      node.markedPending ||
      (node.children?.every(hasNoEnabledTest) ?? false)
    );
  }

  function wrapChildren(node: TreeNode, enabled: boolean) {
    if (!node.children) {
      throw new Error('`node.children` is not defined.');
    }
    const children = node.children.map(child => ({
      fn: getNodeHandler(child, enabled),
    }));
    if (hasNoEnabledTest(node)) {
      return children;
    }
    return node.beforeAllFns.concat(children).concat(node.afterAllFns);
  }

  const treeHandler = getNodeHandler(tree, false);
  return treeHandler();
}
