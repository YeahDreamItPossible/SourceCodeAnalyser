"use strict";

// 根据 Webpack.options.optimization.flagIncludedChunks 注册该插件
// 默认 production 模式下启用 
// 添加 Chunk.prototype.ids 
// 告知 webpack 确定和标记出作为其他 chunk 子集的那些 chunk，
// 其方式是在已经加载过较大的 chunk 之后，
// 就不再去加载这些 chunk 子集
class FlagIncludedChunksPlugin {
	apply(compiler) {
		compiler.hooks.compilation.tap("FlagIncludedChunksPlugin", compilation => {
			compilation.hooks.optimizeChunkIds.tap(
				"FlagIncludedChunksPlugin",
				chunks => {
					const chunkGraph = compilation.chunkGraph;

					// prepare two bit integers for each module
					// 2^31 is the max number represented as SMI in v8
					// we want the bits distributed this way:
					// the bit 2^31 is pretty rar and only one module should get it
					// so it has a probability of 1 / modulesCount
					// the first bit (2^0) is the easiest and every module could get it
					// if it doesn't get a better bit
					// from bit 2^n to 2^(n+1) there is a probability of p
					// so 1 / modulesCount == p^31
					// <=> p = sqrt31(1 / modulesCount)
					// so we use a modulo of 1 / sqrt31(1 / modulesCount)
					// WeakMap<Module, Number>
					const moduleBits = new WeakMap();
					const modulesCount = compilation.modules.size;

					// precalculate the modulo values for each bit
					const modulo = 1 / Math.pow(1 / modulesCount, 1 / 31);
					const modulos = Array.from(
						{ length: 31 },
						(x, i) => Math.pow(modulo, i) | 0
					);

					// iterate all modules to generate bit values
					let i = 0;
					for (const module of compilation.modules) {
						let bit = 30;
						while (i % modulos[bit] !== 0) {
							bit--;
						}
						moduleBits.set(module, 1 << bit);
						i++;
					}

					// iterate all chunks to generate bitmaps
					// WeakMap<Chunk, number>
					const chunkModulesHash = new WeakMap();
					for (const chunk of chunks) {
						let hash = 0;
						for (const module of chunkGraph.getChunkModulesIterable(chunk)) {
							hash |= moduleBits.get(module);
						}
						chunkModulesHash.set(chunk, hash);
					}

					for (const chunkA of chunks) {
						const chunkAHash = chunkModulesHash.get(chunkA);
						const chunkAModulesCount =
							chunkGraph.getNumberOfChunkModules(chunkA);
						if (chunkAModulesCount === 0) continue;
						let bestModule = undefined;
						for (const module of chunkGraph.getChunkModulesIterable(chunkA)) {
							if (
								bestModule === undefined ||
								chunkGraph.getNumberOfModuleChunks(bestModule) >
									chunkGraph.getNumberOfModuleChunks(module)
							)
								bestModule = module;
						}
						loopB: for (const chunkB of chunkGraph.getModuleChunksIterable(
							bestModule
						)) {
							// as we iterate the same iterables twice
							// skip if we find ourselves
							if (chunkA === chunkB) continue;

							const chunkBModulesCount =
								chunkGraph.getNumberOfChunkModules(chunkB);

							// ids for empty chunks are not included
							if (chunkBModulesCount === 0) continue;

							// instead of swapping A and B just bail
							// as we loop twice the current A will be B and B then A
							if (chunkAModulesCount > chunkBModulesCount) continue;

							// is chunkA in chunkB?

							// we do a cheap check for the hash value
							const chunkBHash = chunkModulesHash.get(chunkB);
							if ((chunkBHash & chunkAHash) !== chunkAHash) continue;

							// compare all modules
							for (const m of chunkGraph.getChunkModulesIterable(chunkA)) {
								if (!chunkGraph.isModuleInChunk(m, chunkB)) continue loopB;
							}
							chunkB.ids.push(chunkA.id);
						}
					}
				}
			);
		});
	}
}
module.exports = FlagIncludedChunksPlugin;
