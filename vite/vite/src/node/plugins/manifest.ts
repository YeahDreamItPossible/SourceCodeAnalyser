import path from 'node:path'
import type {
  InternalModuleFormat,
  OutputAsset,
  OutputChunk,
  RenderedChunk,
} from 'rollup'
import type { Plugin } from '../plugin'
import { normalizePath, sortObjectKeys } from '../utils'
import { usePerEnvironmentState } from '../environment'
import { generatedAssetsMap } from './asset'

const endsWithJSRE = /\.[cm]?js$/

export type Manifest = Record<string, ManifestChunk>

export interface ManifestChunk {
  src?: string
  file: string
  css?: string[]
  assets?: string[]
  isEntry?: boolean
  name?: string
  isDynamicEntry?: boolean
  imports?: string[]
  dynamicImports?: string[]
}

export function manifestPlugin(): Plugin {
  const getState = usePerEnvironmentState(() => {
    return {
      manifest: {} as Manifest,
      outputCount: 0,
      reset() {
        this.outputCount = 0
      },
    }
  })

  return {
    name: 'vite:manifest',

    perEnvironmentStartEndDuringDev: true,

    applyToEnvironment(environment) {
      return !!environment.config.build.manifest
    },

    buildStart() {
      getState(this).reset()
    },

    generateBundle({ format }, bundle) {
      const state = getState(this)
      const { manifest } = state
      const { root } = this.environment.config
      const buildOptions = this.environment.config.build

      function getChunkName(chunk: OutputChunk) {
        return getChunkOriginalFileName(chunk, root, format)
      }

      function getInternalImports(imports: string[]): string[] {
        const filteredImports: string[] = []

        for (const file of imports) {
          if (bundle[file] === undefined) {
            continue
          }

          filteredImports.push(getChunkName(bundle[file] as OutputChunk))
        }

        return filteredImports
      }

      function createChunk(chunk: OutputChunk): ManifestChunk {
        const manifestChunk: ManifestChunk = {
          file: chunk.fileName,
          name: chunk.name,
        }

        if (chunk.facadeModuleId) {
          manifestChunk.src = getChunkName(chunk)
        }
        if (chunk.isEntry) {
          manifestChunk.isEntry = true
        }
        if (chunk.isDynamicEntry) {
          manifestChunk.isDynamicEntry = true
        }

        if (chunk.imports.length) {
          const internalImports = getInternalImports(chunk.imports)
          if (internalImports.length > 0) {
            manifestChunk.imports = internalImports
          }
        }

        if (chunk.dynamicImports.length) {
          const internalImports = getInternalImports(chunk.dynamicImports)
          if (internalImports.length > 0) {
            manifestChunk.dynamicImports = internalImports
          }
        }

        if (chunk.viteMetadata?.importedCss.size) {
          manifestChunk.css = [...chunk.viteMetadata.importedCss]
        }
        if (chunk.viteMetadata?.importedAssets.size) {
          manifestChunk.assets = [...chunk.viteMetadata.importedAssets]
        }

        return manifestChunk
      }

      function createAsset(
        asset: OutputAsset,
        src: string,
        isEntry?: boolean,
      ): ManifestChunk {
        const manifestChunk: ManifestChunk = {
          file: asset.fileName,
          src,
        }
        if (isEntry) manifestChunk.isEntry = true
        return manifestChunk
      }

      const assets = generatedAssetsMap.get(this.environment)!
      const entryCssAssetFileNames = new Set()
      for (const [id, asset] of assets.entries()) {
        if (asset.isEntry) {
          try {
            const fileName = this.getFileName(id)
            entryCssAssetFileNames.add(fileName)
          } catch {
            // The asset was generated as part of a different output option.
            // It was already handled during the previous run of this plugin.
            assets.delete(id)
          }
        }
      }

      const fileNameToAsset = new Map<string, ManifestChunk>()

      for (const file in bundle) {
        const chunk = bundle[file]
        if (chunk.type === 'chunk') {
          manifest[getChunkName(chunk)] = createChunk(chunk)
        } else if (chunk.type === 'asset' && typeof chunk.name === 'string') {
          // Add every unique asset to the manifest, keyed by its original name
          const src = chunk.originalFileName ?? chunk.name
          const isEntry = entryCssAssetFileNames.has(chunk.fileName)
          const asset = createAsset(chunk, src, isEntry)

          // If JS chunk and asset chunk are both generated from the same source file,
          // prioritize JS chunk as it contains more information
          const file = manifest[src]?.file
          if (file && endsWithJSRE.test(file)) continue

          manifest[src] = asset
          fileNameToAsset.set(chunk.fileName, asset)
        }
      }

      // Add deduplicated assets to the manifest
      for (const [referenceId, { originalFileName }] of assets.entries()) {
        if (!manifest[originalFileName]) {
          const fileName = this.getFileName(referenceId)
          const asset = fileNameToAsset.get(fileName)
          if (asset) {
            manifest[originalFileName] = asset
          }
        }
      }

      state.outputCount++
      const output = buildOptions.rollupOptions?.output
      const outputLength = Array.isArray(output) ? output.length : 1
      if (state.outputCount >= outputLength) {
        this.emitFile({
          fileName:
            typeof buildOptions.manifest === 'string'
              ? buildOptions.manifest
              : '.vite/manifest.json',
          type: 'asset',
          source: JSON.stringify(sortObjectKeys(manifest), undefined, 2),
        })
      }
    },
  }
}

export function getChunkOriginalFileName(
  chunk: OutputChunk | RenderedChunk,
  root: string,
  format: InternalModuleFormat,
): string {
  if (chunk.facadeModuleId) {
    let name = normalizePath(path.relative(root, chunk.facadeModuleId))
    if (format === 'system' && !chunk.name.includes('-legacy')) {
      const ext = path.extname(name)
      const endPos = ext.length !== 0 ? -ext.length : undefined
      name = name.slice(0, endPos) + `-legacy` + ext
    }
    return name.replace(/\0/g, '')
  } else {
    return `_` + path.basename(chunk.fileName)
  }
}
