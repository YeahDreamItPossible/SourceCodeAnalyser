const { relative, dirname, resolve, join, normalize } = require('node:path')

const rpj = require('read-package-json-fast')
const { readdirScoped } = require('@npmcli/fs')
const { walkUp } = require('walk-up-path')
const ancestorPath = require('common-ancestor-path')
const treeCheck = require('../tree-check.js')

const Shrinkwrap = require('../shrinkwrap.js')
const calcDepFlags = require('../calc-dep-flags.js')
const Node = require('../node.js')
const Link = require('../link.js')
const realpath = require('../realpath.js')

// 公共 symbols
const _changePath = Symbol.for('_changePath')
const _setWorkspaces = Symbol.for('setWorkspaces')
const _rpcache = Symbol.for('realpathCache')
const _stcache = Symbol.for('statCache')

/**
 * 实际树(文件树): 
 * 磁盘上的节点树，对应整个 node_modules 目录 的文件树 
 */

// 实际树加载器
// 作用:
// 读取 某个目录下 的 package.json 文件
// 构建当前当前目录下完整的 实际树
module.exports = cls => class ActualLoader extends cls {
  // 文件树
  #actualTree
  // 绝对路径集合: 依赖的绝对路径
  // 示例: /Users/didi/Desktop/Demo/my-jest/node_modules/npm/node_modules/@isaacs/cliui/node_modules/strip-ansi
  #actualTreeLoaded = new Set()
  // 
  #actualTreePromise

  // 缓存: 节点缓存
  // 作用: 避免重复加载相同的节点
  // 示例: 依赖绝对路径 => 节点
  #cache = new Map()
  // 过滤器
  #filter
  
  // 顶部节点的绝对路径集合
  // 示例: /Users/didi/Desktop/Demo/my-jest
  #topNodes = new Set()
  // 过滤器
  #transplantFilter

  constructor (options) {
    super(options)

    this.actualTree = options.actualTree

    // 当前工作目录
    const cwd = process.cwd()
    // 缓存: 真实路径缓存
    this[_rpcache] = new Map([[cwd, cwd]])
    // 缓存: 统计缓存
    this[_stcache] = new Map()
  }

  // 加载 实际树
  async loadActual (options = {}) {
    // 从 缓存 中读取
    if (this.actualTree) {
      return this.actualTree
    }
    if (!this.#actualTreePromise) {
      options = { ...this.options, ...options }

      this.#actualTreePromise = this.#loadActual(options)
        .then(tree => {
          // reset all deps to extraneous prior to recalc
          if (!options.root) {
            for (const node of tree.inventory.values()) {
              node.extraneous = true
            }
          }

          // only reset root flags if we're not re-rooting,
          // otherwise leave as-is
          calcDepFlags(tree, !options.root)
          this.actualTree = treeCheck(tree)
          return this.actualTree
        })
    }
    return this.#actualTreePromise
  }

  // 创建根Node节点
  // 解析本地package-lock.json文件内容
  // 递归遍历Node节点，构建Node节点树
  async #loadActual (options) {
    const {
      global,
      filter = () => true,
      root = null,
      transplantFilter = () => true,
      ignoreMissing = false,
      forceActual = false,
    } = options
    this.#filter = filter
    this.#transplantFilter = transplantFilter

    if (global) {
      const real = await realpath(this.path, this[_rpcache], this[_stcache])
      const params = {
        path: this.path,
        realpath: real,
        pkg: {},
        global,
        loadOverrides: true,
      }
      if (this.path === real) {
        this.#actualTree = this.#newNode(params)
      } else {
        this.#actualTree = await this.#newLink(params)
      }
    } else {
      this.#actualTree = await this.#loadFSNode({
        path: this.path,
        real: await realpath(this.path, this[_rpcache], this[_stcache]),
        loadOverrides: true,
      })

      this.#actualTree.assertRootOverrides()

      // 如果设置了forceActual，则不加载隐藏的锁文件
      if (!forceActual) {
        // 加载隐藏的锁文件
        const meta = await Shrinkwrap.load({
          path: this.#actualTree.path,
          hiddenLockfile: true,
          resolveOptions: this.options,
        })

        if (meta.loadedFromDisk) {
          this.#actualTree.meta = meta
          // have to load on a new Arborist object, so we don't assign
          // the virtualTree on this one!  Also, the weird reference is because
          // we can't easily get a ref to Arborist in this module, without
          // creating a circular reference, since this class is a mixin used
          // to build up the Arborist class itself.
          await new this.constructor({ ...this.options }).loadVirtual({
            root: this.#actualTree,
          })
          await this[_setWorkspaces](this.#actualTree)

          this.#transplant(root)
          return this.#actualTree
        }
      }

      // 加载隐藏的锁文件
      const meta = await Shrinkwrap.load({
        path: this.#actualTree.path,
        lockfileVersion: this.options.lockfileVersion,
        resolveOptions: this.options,
      })
      this.#actualTree.meta = meta
    }

    // 加载 文件树
    await this.#loadFSTree(this.#actualTree)
    await this[_setWorkspaces](this.#actualTree)

    // if there are workspace targets without Link nodes created, load
    // the targets, so that we know what they are.
    if (this.#actualTree.workspaces && this.#actualTree.workspaces.size) {
      const promises = []
      for (const path of this.#actualTree.workspaces.values()) {
        if (!this.#cache.has(path)) {
          // workspace overrides use the root overrides
          const p = this.#loadFSNode({ path, root: this.#actualTree, useRootOverrides: true })
            .then(node => this.#loadFSTree(node))
          promises.push(p)
        }
      }
      await Promise.all(promises)
    }

    if (!ignoreMissing) {
      await this.#findMissingEdges()
    }

    // try to find a node that is the parent in a fs tree sense, but not a
    // node_modules tree sense, of any link targets.  this allows us to
    // resolve deps that node will find, but a legacy npm view of the
    // world would not have noticed.
    for (const path of this.#topNodes) {
      const node = this.#cache.get(path)
      if (node && !node.parent && !node.fsParent) {
        for (const p of walkUp(dirname(path))) {
          if (this.#cache.has(p)) {
            node.fsParent = this.#cache.get(p)
            break
          }
        }
      }
    }

    this.#transplant(root)

    if (global) {
      // need to depend on the children, or else all of them
      // will end up being flagged as extraneous, since the
      // global root isn't a "real" project
      const tree = this.#actualTree
      const actualRoot = tree.isLink ? tree.target : tree
      const { dependencies = {} } = actualRoot.package
      for (const [name, kid] of actualRoot.children.entries()) {
        const def = kid.isLink ? `file:${kid.realpath}` : '*'
        dependencies[name] = dependencies[name] || def
      }
      actualRoot.package = { ...actualRoot.package, dependencies }
    }
    return this.#actualTree
  }

  // 移植
  #transplant (root) {
    if (!root || root === this.#actualTree) {
      return
    }

    // 
    this.#actualTree[_changePath](root.path)
    for (const node of this.#actualTree.children.values()) {
      if (!this.#transplantFilter(node)) {
        node.root = null
      }
    }

    root.replace(this.#actualTree)
    for (const node of this.#actualTree.fsChildren) {
      node.root = this.#transplantFilter(node) ? root : null
    }

    this.#actualTree = root
  }

  // 加载 文件节点 或者 文件链接
  async #loadFSNode ({ path, parent, real, root, loadOverrides, useRootOverrides }) {
    if (!real) {
      try {
        real = await realpath(path, this[_rpcache], this[_stcache])
      } catch (error) {
        // if realpath fails, just provide a dummy error node
        return new Node({
          error,
          path,
          realpath: path,
          parent,
          root,
          loadOverrides,
        })
      }
    }

    const cached = this.#cache.get(path)
    let node
    if (cached && !cached.dummy) {
      // 从缓存中读取
      cached.parent = parent
      return cached
    } else {
      const params = {
        installLinks: this.installLinks,
        legacyPeerDeps: this.legacyPeerDeps,
        path,
        realpath: real,
        parent,
        root,
        loadOverrides,
      }

      try {
        // 获取当前Node节点的package.json文件内容
        const pkg = await rpj(join(real, 'package.json'))
        params.pkg = pkg
        if (useRootOverrides && root.overrides) {
          params.overrides = root.overrides.getNodeRule({ name: pkg.name, version: pkg.version })
        }
      } catch (err) {
        params.error = err
      }
      
      if (normalize(path) === real) {
        node = this.#newNode(params)
      } else {
        node = await this.#newLink(params)
      }
    }
    this.#cache.set(path, node)
    return node
  }

  // 返回新建的 节点
  #newNode (options) {
    const { parent, realpath } = options
    if (!parent) {
      this.#topNodes.add(realpath)
    }
    return new Node(options)
  }

  // 返回新建的 链接
  async #newLink (options) {
    const { realpath } = options
    this.#topNodes.add(realpath)
    const target = this.#cache.get(realpath)
    const link = new Link({ ...options, target })

    if (!target) {
      // Link set its target itself in this case
      this.#cache.set(realpath, link.target)
      // if a link target points at a node outside of the root tree's
      // node_modules hierarchy, then load that node as well.
      await this.#loadFSTree(link.target)
    }

    return link
  }
  
  /**
   * 递归加载 文件树
   * 1. 加载某个 文件节点 的 所有子节点，创建其对应的子Node节点并建立父子引用关系
   * 2. 依次加载 所有子节点 的 文件树，重复上述动作
   */
  async #loadFSTree (node) {
    const did = this.#actualTreeLoaded
    if (!node.isLink && !did.has(node.target.realpath)) {
      did.add(node.target.realpath)
      await this.#loadFSChildren(node.target)
      return Promise.all(
        [...node.target.children.entries()]
          .filter(([, kid]) => !did.has(kid.realpath))
          .map(([, kid]) => this.#loadFSTree(kid))
      )
    }
  }

  /**
   * 加载某个 文件节点 的 所有子节点
   * 1. 遍历 当前文件节点 的 node_modules目录 中的依赖，
   * 2. 创建其对应的子Node节点，
   * 3. 并建立父子引用关系
   */
  async #loadFSChildren (node) {
    const nm = resolve(node.realpath, 'node_modules')
    try {
      const kids = await readdirScoped(nm).then(paths => paths.map(p => p.replace(/\\/g, '/')))
      return Promise.all(
        /**
         * ^             # 字符串开始
         * (             # 分组开始（可选）
         *   @           # 匹配 @
         *   [^/]+       # 匹配非 / 的字符（至少一个）
         *   \/          # 匹配 /
         * )?            # 分组结束（可选）
         * \.            # 匹配 .
         */
        // 忽视 是否以 . 开头，或是在 @scope/ 作用域前缀后紧跟 . 的路径
        // 例如: @user/.bin .bin
        kids.filter(kid => !/^(@[^/]+\/)?\./.test(kid))
          .filter(kid => this.#filter(node, kid))
          .map(kid => this.#loadFSNode({
            parent: node,
            path: resolve(nm, kid),
          })))
    } catch {
      // error in the readdir is not fatal, just means no kids
    }
  }

  // 发现丢失的边
  async #findMissingEdges () {
    // try to resolve any missing edges by walking up the directory tree,
    // checking for the package in each node_modules folder.  stop at the
    // root directory.
    // The tricky move here is that we load a "dummy" node for the folder
    // containing the node_modules folder, so that it can be assigned as
    // the fsParent.  It's a bad idea to *actually* load that full node,
    // because people sometimes develop in ~/projects/node_modules/...
    // so we'd end up loading a massive tree with lots of unrelated junk.
    const nmContents = new Map()
    const tree = this.#actualTree
    for (const node of tree.inventory.values()) {
      const ancestor = ancestorPath(node.realpath, this.path)

      const depPromises = []
      for (const [name, edge] of node.edgesOut.entries()) {
        const notMissing = !edge.missing &&
          !(edge.to && (edge.to.dummy || edge.to.parent !== node))
        if (notMissing) {
          continue
        }

        // start the walk from the dirname, because we would have found
        // the dep in the loadFSTree step already if it was local.
        for (const p of walkUp(dirname(node.realpath))) {
          // only walk as far as the nearest ancestor
          // this keeps us from going into completely unrelated
          // places when a project is just missing something, but
          // allows for finding the transitive deps of link targets.
          // ie, if it has to go up and back out to get to the path
          // from the nearest common ancestor, we've gone too far.
          if (ancestor && /^\.\.(?:[\\/]|$)/.test(relative(ancestor, p))) {
            break
          }

          let entries
          if (!nmContents.has(p)) {
            entries = await readdirScoped(p + '/node_modules')
              .catch(() => []).then(paths => paths.map(p => p.replace(/\\/g, '/')))
            nmContents.set(p, entries)
          } else {
            entries = nmContents.get(p)
          }

          if (!entries.includes(name)) {
            continue
          }

          let d
          if (!this.#cache.has(p)) {
            d = new Node({ path: p, root: node.root, dummy: true })
            this.#cache.set(p, d)
          } else {
            d = this.#cache.get(p)
          }
          if (d.dummy) {
            // it's a placeholder, so likely would not have loaded this dep,
            // unless another dep in the tree also needs it.
            const depPath = normalize(`${p}/node_modules/${name}`)
            const cached = this.#cache.get(depPath)
            if (!cached || cached.dummy) {
              depPromises.push(this.#loadFSNode({
                path: depPath,
                root: node.root,
                parent: d,
              }).then(node => this.#loadFSTree(node)))
            }
          }
          break
        }
      }
      await Promise.all(depPromises)
    }
  }
}
