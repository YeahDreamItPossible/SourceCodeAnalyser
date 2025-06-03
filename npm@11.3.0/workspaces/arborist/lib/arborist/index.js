// Arborist 管理三种依赖树：
// - 实际树 (actual)
// - 虚拟树 (virtual)
// - 理想树 (ideal)

// 实际树对应磁盘上的 node_modules 结构
// 包含所有实际存在的依赖链接

// 虚拟树从元数据构建（package.json 和 lock 文件）
// 反映声明的依赖关系状态

// 理想树是我们希望达到的目标状态
// 基于虚拟树应用增/删/更新操作生成

// 通过计算理想树与实际树的差异
// 执行具体操作使实际树转化为理想树
// 完成具象化 (reify) 后更新实际树状态

// 每棵树在根节点维护依赖清单 (Inventory)
// Shrinkwrap 文件始终跟踪实际树状态
// 并在具象化时更新到磁盘

// 通过混合类 (mixin) 实现功能扩展
// 各类之间无构造顺序依赖
// 组合形成最终功能完整的 Arborist 类


/**
 * 名词解释：
 * - "reify": 译为「具象化」对应 npm 的依赖固化操作
 * - "inventory": 保留英文术语，指代依赖清单数据结构
 * - "mixin": 译为「混合类」符合 JavaScript 类扩展模式
 */

const { resolve } = require('node:path')
const { homedir } = require('node:os')
const { depth } = require('treeverse')
const mapWorkspaces = require('@npmcli/map-workspaces')
const { log, time } = require('proc-log')
const { saveTypeMap } = require('../add-rm-pkg-deps.js')
const AuditReport = require('../audit-report.js')
const relpath = require('../relpath.js')
const PackumentCache = require('../packument-cache.js')

const mixins = [
  require('../tracker.js'),
  require('./build-ideal-tree.js'),
  require('./load-actual.js'),
  require('./load-virtual.js'),
  require('./rebuild.js'),
  require('./reify.js'),
  require('./isolated-reifier.js'),
]

const _setWorkspaces = Symbol.for('setWorkspaces')
const Base = mixins.reduce((a, b) => b(a), require('node:events'))

// if it's 1, 2, or 3, set it explicitly that.
// if undefined or null, set it null
// otherwise, throw.
const lockfileVersion = lfv => {
  if (lfv === 1 || lfv === 2 || lfv === 3) {
    return lfv
  }

  if (lfv === undefined || lfv === null) {
    return null
  }

  throw new TypeError('Invalid lockfileVersion config: ' + lfv)
}

/**
 * Arborist:
 * 树艺师；树艺家；树木栽培家
 * 它提供了一种统一的方式来管理和操作依赖关系，
 * 包括解析依赖、构建理想树、加载实际树、
 * 计算差异、应用差异、重建树等操作。
 * 它还支持工作区管理和依赖锁定等功能。
 * 它是 npm 包管理器的核心组件之一，
 * 用于管理和构建项目的依赖关系。
 * 它可以用于安装、更新、卸载和管理项目的依赖关系。
 * 它还可以用于生成依赖树、解析依赖关系、
 * 检查依赖关系的一致性等。
 * 它是 npm 包管理器的核心组件之一，
 * 用于管理和构建项目的依赖关系。
 */

class Arborist extends Base {
  constructor (options = {}) {
    const timeEnd = time.start('arborist:ctor')
    super(options)
    this.options = {
      nodeVersion: process.version,
      ...options,
      Arborist: this.constructor,
      binLinks: 'binLinks' in options ? !!options.binLinks : true,
      cache: options.cache || `${homedir()}/.npm/_cacache`,
      dryRun: !!options.dryRun,
      formatPackageLock: 'formatPackageLock' in options ? !!options.formatPackageLock : true,
      force: !!options.force,
      global: !!options.global,
      ignoreScripts: !!options.ignoreScripts,
      installStrategy: options.global ? 'shallow' : (options.installStrategy ? options.installStrategy : 'hoisted'),
      lockfileVersion: lockfileVersion(options.lockfileVersion),
      packageLockOnly: !!options.packageLockOnly,
      packumentCache: options.packumentCache || new PackumentCache(),
      path: options.path || '.',
      rebuildBundle: 'rebuildBundle' in options ? !!options.rebuildBundle : true,
      replaceRegistryHost: options.replaceRegistryHost,
      savePrefix: 'savePrefix' in options ? options.savePrefix : '^',
      scriptShell: options.scriptShell,
      workspaces: options.workspaces || [],
      workspacesEnabled: options.workspacesEnabled !== false,
    }
    // TODO we only ever look at this.options.replaceRegistryHost, not
    // this.replaceRegistryHost.  Defaulting needs to be written back to
    // this.options to work properly
    this.replaceRegistryHost = this.options.replaceRegistryHost =
      (!this.options.replaceRegistryHost || this.options.replaceRegistryHost === 'npmjs') ?
        'registry.npmjs.org' : this.options.replaceRegistryHost

    if (options.saveType && !saveTypeMap.get(options.saveType)) {
      throw new Error(`Invalid saveType ${options.saveType}`)
    }
    this.cache = resolve(this.options.cache)
    this.diff = null
    this.path = resolve(this.options.path)
    timeEnd()
  }

  // TODO: We should change these to static functions instead
  //   of methods for the next major version

  // Get the actual nodes corresponding to a root node's child workspaces,
  // given a list of workspace names.
  workspaceNodes (tree, workspaces) {
    const wsMap = tree.workspaces
    if (!wsMap) {
      log.warn('workspaces', 'filter set, but no workspaces present')
      return []
    }

    const nodes = []
    for (const name of workspaces) {
      const path = wsMap.get(name)
      if (!path) {
        log.warn('workspaces', `${name} in filter set, but not in workspaces`)
        continue
      }

      const loc = relpath(tree.realpath, path)
      const node = tree.inventory.get(loc)

      if (!node) {
        log.warn('workspaces', `${name} in filter set, but no workspace folder present`)
        continue
      }

      nodes.push(node)
    }

    return nodes
  }

  // returns a set of workspace nodes and all their deps
  // TODO why is includeWorkspaceRoot a param?
  // TODO why is workspaces a param?
  workspaceDependencySet (tree, workspaces, includeWorkspaceRoot) {
    const wsNodes = this.workspaceNodes(tree, workspaces)
    if (includeWorkspaceRoot) {
      for (const edge of tree.edgesOut.values()) {
        if (edge.type !== 'workspace' && edge.to) {
          wsNodes.push(edge.to)
        }
      }
    }
    const wsDepSet = new Set(wsNodes)
    const extraneous = new Set()
    for (const node of wsDepSet) {
      for (const edge of node.edgesOut.values()) {
        const dep = edge.to
        if (dep) {
          wsDepSet.add(dep)
          if (dep.isLink) {
            wsDepSet.add(dep.target)
          }
        }
      }
      for (const child of node.children.values()) {
        if (child.extraneous) {
          extraneous.add(child)
        }
      }
    }
    for (const extra of extraneous) {
      wsDepSet.add(extra)
    }

    return wsDepSet
  }

  // returns a set of root dependencies, excluding dependencies that are
  // exclusively workspace dependencies
  excludeWorkspacesDependencySet (tree) {
    const rootDepSet = new Set()
    depth({
      tree,
      visit: node => {
        for (const { to } of node.edgesOut.values()) {
          if (!to || to.isWorkspace) {
            continue
          }
          for (const edgeIn of to.edgesIn.values()) {
            if (edgeIn.from.isRoot || rootDepSet.has(edgeIn.from)) {
              rootDepSet.add(to)
            }
          }
        }
        return node
      },
      filter: node => node,
      getChildren: (node, tree) =>
        [...tree.edgesOut.values()].map(edge => edge.to),
    })
    return rootDepSet
  }

  async [_setWorkspaces] (node) {
    const workspaces = await mapWorkspaces({
      cwd: node.path,
      pkg: node.package,
    })

    if (node && workspaces.size) {
      node.workspaces = workspaces
    }

    return node
  }

  async audit (options = {}) {
    this.addTracker('audit')
    if (this.options.global) {
      throw Object.assign(
        new Error('`npm audit` does not support testing globals'),
        { code: 'EAUDITGLOBAL' }
      )
    }

    // allow the user to set options on the ctor as well.
    // XXX: deprecate separate method options objects.
    options = { ...this.options, ...options }

    const timeEnd = time.start('audit')
    let tree
    if (options.packageLock === false) {
      // build ideal tree
      await this.loadActual(options)
      await this.buildIdealTree()
      tree = this.idealTree
    } else {
      tree = await this.loadVirtual()
    }
    if (this.options.workspaces.length) {
      options.filterSet = this.workspaceDependencySet(
        tree,
        this.options.workspaces,
        this.options.includeWorkspaceRoot
      )
    }
    if (!options.workspacesEnabled) {
      options.filterSet =
        this.excludeWorkspacesDependencySet(tree)
    }
    this.auditReport = await AuditReport.load(tree, options)
    const ret = options.fix ? this.reify(options) : this.auditReport
    timeEnd()
    this.finishTracker('audit')
    return ret
  }

  async dedupe (options = {}) {
    // allow the user to set options on the ctor as well.
    // XXX: deprecate separate method options objects.
    options = { ...this.options, ...options }
    const tree = await this.loadVirtual().catch(() => this.loadActual())
    const names = []
    for (const name of tree.inventory.query('name')) {
      if (tree.inventory.query('name', name).size > 1) {
        names.push(name)
      }
    }
    return this.reify({
      ...options,
      preferDedupe: true,
      update: { names },
    })
  }
}

module.exports = Arborist
