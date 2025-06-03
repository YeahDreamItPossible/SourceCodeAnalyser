// mixin providing the loadVirtual method
const mapWorkspaces = require('@npmcli/map-workspaces')

const { resolve } = require('node:path')

const nameFromFolder = require('@npmcli/name-from-folder')
const consistentResolve = require('../consistent-resolve.js')
const Shrinkwrap = require('../shrinkwrap.js')
const Node = require('../node.js')
const Link = require('../link.js')
const relpath = require('../relpath.js')
const calcDepFlags = require('../calc-dep-flags.js')
const rpj = require('read-package-json-fast')
const treeCheck = require('../tree-check.js')

const flagsSuspect = Symbol.for('flagsSuspect')
const setWorkspaces = Symbol.for('setWorkspaces')

// 虚拟树加载器
// 作用:
// 从 npm-shrinkwrap.json || package-lock.json || yarn.lock 文件中加载 依赖锁定 内容
// 并将 依赖信息 更新到 根结点 中
module.exports = cls => class VirtualLoader extends cls {
  #rootOptionProvided

  constructor (options) {
    super(options)

    // the virtual tree we load from a shrinkwrap
    this.virtualTree = options.virtualTree
    this[flagsSuspect] = false
  }

  // 加载虚拟树
  async loadVirtual (options = {}) {
    if (this.virtualTree) {
      return this.virtualTree
    }

    options = { ...this.options, ...options }

    // 如果 根结点 中已经存在元信息
    if (options.root && options.root.meta) {
      await this.#loadFromShrinkwrap(options.root.meta, options.root)
      return treeCheck(this.virtualTree)
    }

    // 读取 依赖锁定 信息
    const s = await Shrinkwrap.load({
      path: this.path,
      lockfileVersion: this.options.lockfileVersion,
      resolveOptions: this.options,
    })
    // 加载虚拟树时 需要存在shrinkwrap.json文件
    if (!s.loadedFromDisk && !options.root) {
      const er = new Error('loadVirtual requires existing shrinkwrap file')
      throw Object.assign(er, { code: 'ENOLOCK' })
    }

    // when building the ideal tree, we pass in a root node to this function
    // otherwise, load it from the root package json or the lockfile
    const {
      root = await this.#loadRoot(s),
    } = options

    this.#rootOptionProvided = options.root

    await this.#loadFromShrinkwrap(s, root)
    root.assertRootOverrides()
    return treeCheck(this.virtualTree)
  }

  // 加载 根结点
  async #loadRoot (s) {
    const pj = this.path + '/package.json'
    const pkg = await rpj(pj).catch(() => s.data.packages['']) || {}
    return this[setWorkspaces](this.#loadNode('', pkg, true))
  }

  // 从 锁定文件 中加载
  async #loadFromShrinkwrap (s, root) {
    if (!this.#rootOptionProvided) {
      // root is never any of these things, but might be a brand new
      // baby Node object that never had its dep flags calculated.
      root.extraneous = false
      root.dev = false
      root.optional = false
      root.devOptional = false
      root.peer = false
    } else {
      this[flagsSuspect] = true
    }
    
    // 检查 根结点 的 边
    this.#checkRootEdges(s, root)
    root.meta = s
    this.virtualTree = root
    const { links, nodes } = this.#resolveNodes(s, root)
    await this.#resolveLinks(links, nodes)
    if (!(s.originalLockfileVersion >= 2)) {
      this.#assignBundles(nodes)
    }
    if (this[flagsSuspect]) {
      // reset all dep flags
      // can't use inventory here, because virtualTree might not be root
      for (const node of nodes.values()) {
        if (node.isRoot || node === this.#rootOptionProvided) {
          continue
        }
        node.extraneous = true
        node.dev = true
        node.optional = true
        node.devOptional = true
        node.peer = true
      }
      calcDepFlags(this.virtualTree, !this.#rootOptionProvided)
    }
    return root
  }

  // 检查 根节点 的 边 是否有效
  #checkRootEdges (s, root) {
    if (!s.loadedFromDisk || s.ancientLockfile) {
      return
    }

    const lock = s.get('')
    // 生产依赖
    const prod = lock.dependencies || {}
    // 开发依赖
    const dev = lock.devDependencies || {}
    // 可选依赖
    const optional = lock.optionalDependencies || {}
    // 同等依赖
    const peer = lock.peerDependencies || {}
    const peerOptional = {}

    if (lock.peerDependenciesMeta) {
      for (const [name, meta] of Object.entries(lock.peerDependenciesMeta)) {
        if (meta.optional && peer[name] !== undefined) {
          peerOptional[name] = peer[name]
          delete peer[name]
        }
      }
    }

    // 删除 生产依赖 的 同等依赖
    for (const name of Object.keys(peerOptional)) {
      delete prod[name]
    }
    // 删除 生产依赖 中 可选依赖
    for (const name of Object.keys(optional)) {
      delete prod[name]
    }

    const lockWS = {}
    const workspaces = mapWorkspaces.virtual({
      cwd: this.path,
      lockfile: s.data,
    })

    for (const [name, path] of workspaces.entries()) {
      lockWS[name] = `file:${path}`
    }

    // Should rootNames exclude optional?
    const rootNames = new Set(root.edgesOut.keys())

    const lockByType = ({ dev, optional, peer, peerOptional, prod, workspace: lockWS })

    // 将 锁定文件 的 依赖 与 根结点 的 边 对比, 删除 无效的依赖
    for (const type in lockByType) {
      const deps = lockByType[type]
      for (const name in deps) {
        const edge = root.edgesOut.get(name)
        if (!edge || edge.type !== type || edge.spec !== deps[name]) {
          return this[flagsSuspect] = true
        }
        rootNames.delete(name)
      }
    }
    // Something was in root that's not accounted for in shrinkwrap
    if (rootNames.size) {
      return this[flagsSuspect] = true
    }
  }

  // 从 依赖锁定 文件中 解析对应 的 节点 和 链接
  #resolveNodes (s, root) {
    const links = new Map()
    const nodes = new Map([['', root]])
    for (const [location, meta] of Object.entries(s.data.packages)) {
      // skip the root because we already got it
      if (!location) {
        continue
      }

      if (meta.link) {
        links.set(location, meta)
      } else {
        nodes.set(location, this.#loadNode(location, meta))
      }
    }
    return { links, nodes }
  }

  // 
  async #resolveLinks (links, nodes) {
    for (const [location, meta] of links.entries()) {
      const targetPath = resolve(this.path, meta.resolved)
      const targetLoc = relpath(this.path, targetPath)
      const target = nodes.get(targetLoc)
      const link = this.#loadLink(location, targetLoc, target, meta)
      nodes.set(location, link)
      nodes.set(targetLoc, link.target)

      // we always need to read the package.json for link targets
      // outside node_modules because they can be changed by the local user
      if (!link.target.parent) {
        const pj = link.realpath + '/package.json'
        const pkg = await rpj(pj).catch(() => null)
        if (pkg) {
          link.target.package = pkg
        }
      }
    }
  }

  #assignBundles (nodes) {
    for (const [location, node] of nodes) {
      // Skip assignment of parentage for the root package
      if (!location || node.isLink && !node.target.location) {
        continue
      }
      const { name, parent, package: { inBundle } } = node

      if (!parent) {
        continue
      }

      // read inBundle from package because 'package' here is
      // actually a v2 lockfile metadata entry.
      // If the *parent* is also bundled, though, or if the parent has
      // no dependency on it, then we assume that it's being pulled in
      // just by virtue of its parent or a transitive dep being bundled.
      const { package: ppkg } = parent
      const { inBundle: parentBundled } = ppkg
      if (inBundle && !parentBundled && parent.edgesOut.has(node.name)) {
        if (!ppkg.bundleDependencies) {
          ppkg.bundleDependencies = [name]
        } else {
          ppkg.bundleDependencies.push(name)
        }
      }
    }
  }

  // 返回创建的 节点
  #loadNode (location, sw, loadOverrides) {
    const p = this.virtualTree ? this.virtualTree.realpath : this.path
    const path = resolve(p, location)
    // shrinkwrap doesn't include package name unless necessary
    if (!sw.name) {
      sw.name = nameFromFolder(path)
    }

    const dev = sw.dev
    const optional = sw.optional
    const devOptional = dev || optional || sw.devOptional
    const peer = sw.peer

    const node = new Node({
      installLinks: this.installLinks,
      legacyPeerDeps: this.legacyPeerDeps,
      root: this.virtualTree,
      path,
      realpath: path,
      integrity: sw.integrity,
      resolved: consistentResolve(sw.resolved, this.path, path),
      pkg: sw,
      ideallyInert: sw.ideallyInert,
      hasShrinkwrap: sw.hasShrinkwrap,
      dev,
      optional,
      devOptional,
      peer,
      loadOverrides,
    })
    // cast to boolean because they're undefined in the lock file when false
    node.extraneous = !!sw.extraneous
    node.devOptional = !!(sw.devOptional || sw.dev || sw.optional)
    node.peer = !!sw.peer
    node.optional = !!sw.optional
    node.dev = !!sw.dev
    return node
  }

  // 返回创建的 链接
  #loadLink (location, targetLoc, target) {
    const path = resolve(this.path, location)
    const link = new Link({
      installLinks: this.installLinks,
      legacyPeerDeps: this.legacyPeerDeps,
      path,
      realpath: resolve(this.path, targetLoc),
      target,
      pkg: target && target.package,
    })
    link.extraneous = target.extraneous
    link.devOptional = target.devOptional
    link.peer = target.peer
    link.optional = target.optional
    link.dev = target.dev
    return link
  }
}
