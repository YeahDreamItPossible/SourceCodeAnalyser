'use strict';

const { HtmlWebpackChildCompiler } = require('./child-compiler');
const fileWatcherApi = require('./file-watcher-api');

const compilerMap = new WeakMap();

class CachedChildCompilation {
  constructor (compiler) {
    this.compiler = compiler;
    if (compilerMap.has(compiler)) {
      return;
    }
    const persistentChildCompilerSingletonPlugin = new PersistentChildCompilerSingletonPlugin();
    compilerMap.set(compiler, persistentChildCompilerSingletonPlugin);
    persistentChildCompilerSingletonPlugin.apply(compiler);
  }

  addEntry (entry) {
    const persistentChildCompilerSingletonPlugin = compilerMap.get(this.compiler);
    if (!persistentChildCompilerSingletonPlugin) {
      throw new Error(
        'PersistentChildCompilerSingletonPlugin instance not found.'
      );
    }
    persistentChildCompilerSingletonPlugin.addEntry(entry);
  }

  getCompilationResult () {
    const persistentChildCompilerSingletonPlugin = compilerMap.get(this.compiler);
    if (!persistentChildCompilerSingletonPlugin) {
      throw new Error(
        'PersistentChildCompilerSingletonPlugin instance not found.'
      );
    }
    return persistentChildCompilerSingletonPlugin.getLatestResult();
  }

  getCompilationEntryResult (entry) {
    const latestResult = this.getCompilationResult();
    const compilationResult = latestResult.compilationResult;
    return 'error' in compilationResult ? {
      mainCompilationHash: latestResult.mainCompilationHash,
      error: compilationResult.error
    } : {
      mainCompilationHash: latestResult.mainCompilationHash,
      compiledEntry: compilationResult.compiledEntries[entry]
    };
  }
}

class PersistentChildCompilerSingletonPlugin {
  constructor () {
    this.compilationState = {
      isCompiling: false,
      isVerifyingCache: false,
      entries: [],
      compiledEntries: [],
      mainCompilationHash: 'initial',
      compilationResult: {
        dependencies: {
          fileDependencies: [],
          contextDependencies: [],
          missingDependencies: []
        },
        compiledEntries: {}
      }
    };
  }

  apply (compiler) {
    let childCompilationResultPromise = Promise.resolve({
      dependencies: {
        fileDependencies: [],
        contextDependencies: [],
        missingDependencies: []
      },
      compiledEntries: {}
    });
    /**
     * The main compilation hash which will only be updated
     * if the childCompiler changes
     */
    let mainCompilationHashOfLastChildRecompile = '';
    /** @typedef{Snapshot|undefined} */
    let previousFileSystemSnapshot;
    let compilationStartTime = new Date().getTime();

    compiler.hooks.make.tapAsync(
      'PersistentChildCompilerSingletonPlugin',
      (mainCompilation, callback) => {
        if (this.compilationState.isCompiling || this.compilationState.isVerifyingCache) {
          return callback(new Error('Child compilation has already started'));
        }

        // Update the time to the current compile start time
        compilationStartTime = new Date().getTime();

        // The compilation starts - adding new templates is now not possible anymore
        this.compilationState = {
          isCompiling: false,
          isVerifyingCache: true,
          previousEntries: this.compilationState.compiledEntries,
          previousResult: this.compilationState.compilationResult,
          entries: this.compilationState.entries
        };

        // Validate cache:
        const isCacheValidPromise = this.isCacheValid(previousFileSystemSnapshot, mainCompilation);

        let cachedResult = childCompilationResultPromise;
        childCompilationResultPromise = isCacheValidPromise.then((isCacheValid) => {
          // Reuse cache
          if (isCacheValid) {
            return cachedResult;
          }
          // Start the compilation
          const compiledEntriesPromise = this.compileEntries(
            mainCompilation,
            this.compilationState.entries
          );
          // Update snapshot as soon as we know the filedependencies
          // this might possibly cause bugs if files were changed inbetween
          // compilation start and snapshot creation
          compiledEntriesPromise.then((childCompilationResult) => {
            return fileWatcherApi.createSnapshot(childCompilationResult.dependencies, mainCompilation, compilationStartTime);
          }).then((snapshot) => {
            previousFileSystemSnapshot = snapshot;
          });
          return compiledEntriesPromise;
        });

        // Add files to compilation which needs to be watched:
        mainCompilation.hooks.optimizeTree.tapAsync(
          'PersistentChildCompilerSingletonPlugin',
          (chunks, modules, callback) => {
            const handleCompilationDonePromise = childCompilationResultPromise.then(
              childCompilationResult => {
                this.watchFiles(
                  mainCompilation,
                  childCompilationResult.dependencies
                );
              });
            handleCompilationDonePromise.then(() => callback(null, chunks, modules), callback);
          }
        );

        // Store the final compilation once the main compilation hash is known
        mainCompilation.hooks.additionalAssets.tapAsync(
          'PersistentChildCompilerSingletonPlugin',
          (callback) => {
            const didRecompilePromise = Promise.all([childCompilationResultPromise, cachedResult]).then(
              ([childCompilationResult, cachedResult]) => {
                // Update if childCompilation changed
                return (cachedResult !== childCompilationResult);
              }
            );

            const handleCompilationDonePromise = Promise.all([childCompilationResultPromise, didRecompilePromise]).then(
              ([childCompilationResult, didRecompile]) => {
                // Update hash and snapshot if childCompilation changed
                if (didRecompile) {
                  mainCompilationHashOfLastChildRecompile = mainCompilation.hash;
                }
                this.compilationState = {
                  isCompiling: false,
                  isVerifyingCache: false,
                  entries: this.compilationState.entries,
                  compiledEntries: this.compilationState.entries,
                  compilationResult: childCompilationResult,
                  mainCompilationHash: mainCompilationHashOfLastChildRecompile
                };
              });
            handleCompilationDonePromise.then(() => callback(null), callback);
          }
        );

        // Continue compilation:
        callback(null);
      }
    );
  }

  addEntry (entry) {
    if (this.compilationState.isCompiling || this.compilationState.isVerifyingCache) {
      throw new Error(
        'The child compiler has already started to compile. ' +
        "Please add entries before the main compiler 'make' phase has started or " +
        'after the compilation is done.'
      );
    }
    if (this.compilationState.entries.indexOf(entry) === -1) {
      this.compilationState.entries = [...this.compilationState.entries, entry];
    }
  }

  getLatestResult () {
    if (this.compilationState.isCompiling || this.compilationState.isVerifyingCache) {
      throw new Error(
        'The child compiler is not done compiling. ' +
        "Please access the result after the compiler 'make' phase has started or " +
        'after the compilation is done.'
      );
    }
    return {
      mainCompilationHash: this.compilationState.mainCompilationHash,
      compilationResult: this.compilationState.compilationResult
    };
  }

  /**
   * Verify that the cache is still valid
   * @private
   * @param {Snapshot | undefined} snapshot
   * @param {WebpackCompilation} mainCompilation
   * @returns {Promise<boolean>}
   */
  isCacheValid (snapshot, mainCompilation) {
    if (!this.compilationState.isVerifyingCache) {
      return Promise.reject(new Error('Cache validation can only be done right before the compilation starts'));
    }
    // If there are no entries we don't need a new child compilation
    if (this.compilationState.entries.length === 0) {
      return Promise.resolve(true);
    }
    // If there are new entries the cache is invalid
    if (this.compilationState.entries !== this.compilationState.previousEntries) {
      return Promise.resolve(false);
    }
    // Mark the cache as invalid if there is no snapshot
    if (!snapshot) {
      return Promise.resolve(false);
    }
    return fileWatcherApi.isSnapShotValid(snapshot, mainCompilation);
  }

  /**
   * Start to compile all templates
   *
   * @private
   * @param {WebpackCompilation} mainCompilation
   * @param {string[]} entries
   * @returns {Promise<ChildCompilationResult>}
   */
  compileEntries (mainCompilation, entries) {
    const compiler = new HtmlWebpackChildCompiler(entries);
    return compiler.compileTemplates(mainCompilation).then((result) => {
      return {
      // The compiled sources to render the content
        compiledEntries: result,
        // The file dependencies to find out if a
        // recompilation is required
        dependencies: compiler.fileDependencies,
        // The main compilation hash can be used to find out
        // if this compilation was done during the current compilation
        mainCompilationHash: mainCompilation.hash
      };
    }, error => ({
      // The compiled sources to render the content
      error,
      // The file dependencies to find out if a
      // recompilation is required
      dependencies: compiler.fileDependencies,
      // The main compilation hash can be used to find out
      // if this compilation was done during the current compilation
      mainCompilationHash: mainCompilation.hash
    }));
  }

  /**
   * @private
   * @param {WebpackCompilation} mainCompilation
   * @param {FileDependencies} files
   */
  watchFiles (mainCompilation, files) {
    fileWatcherApi.watchFiles(mainCompilation, files);
  }
}

module.exports = {
  CachedChildCompilation
};
