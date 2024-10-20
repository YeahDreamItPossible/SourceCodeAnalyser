const { isColorSupported } = require("colorette");


function setupHooks(context) {
  function invalid() {
    if (context.state) {
      context.logger.log("Compilation starting...");
    }

    // We are now in invalid state
    // eslint-disable-next-line no-param-reassign
    context.state = false;
    // eslint-disable-next-line no-param-reassign, no-undefined
    context.stats = undefined;
  }

  function normalizeStatsOptions(statsOptions) {
    if (typeof statsOptions === "undefined") {
      // eslint-disable-next-line no-param-reassign
      statsOptions = { preset: "normal" };
    } else if (typeof statsOptions === "boolean") {
      // eslint-disable-next-line no-param-reassign
      statsOptions = statsOptions ? { preset: "normal" } : { preset: "none" };
    } else if (typeof statsOptions === "string") {
      // eslint-disable-next-line no-param-reassign
      statsOptions = { preset: statsOptions };
    }

    return statsOptions;
  }

  function done(stats) {
    // We are now on valid state
    // eslint-disable-next-line no-param-reassign
    context.state = true;
    // eslint-disable-next-line no-param-reassign
    context.stats = stats;

    // Do the stuff in nextTick, because bundle may be invalidated if a change happened while compiling
    process.nextTick(() => {
      const { compiler, logger, options, state, callbacks } = context;

      // Check if still in valid state
      if (!state) {
        return;
      }

      logger.log("Compilation finished");

      const isMultiCompilerMode = Boolean(
        /** @type {MultiCompiler} */
        (compiler).compilers
      );

      /**
       * @type {StatsOptions | MultiStatsOptions | NormalizedStatsOptions}
       */
      let statsOptions;

      if (typeof options.stats !== "undefined") {
        statsOptions = isMultiCompilerMode
          ? {
              children:
                /** @type {MultiCompiler} */
                (compiler).compilers.map(() => options.stats),
            }
          : options.stats;
      } else {
        statsOptions = isMultiCompilerMode
          ? {
              children:
                /** @type {MultiCompiler} */
                (compiler).compilers.map((child) => child.options.stats),
            }
          : /** @type {Compiler} */ (compiler).options.stats;
      }

      if (isMultiCompilerMode) {
        /** @type {MultiStatsOptions} */
        (statsOptions).children =
          /** @type {MultiStatsOptions} */
          (statsOptions).children.map(
            /**
             * @param {StatsOptions} childStatsOptions
             * @return {NormalizedStatsOptions}
             */
            (childStatsOptions) => {
              // eslint-disable-next-line no-param-reassign
              childStatsOptions = normalizeStatsOptions(childStatsOptions);

              if (typeof childStatsOptions.colors === "undefined") {
                // eslint-disable-next-line no-param-reassign
                childStatsOptions.colors = isColorSupported;
              }

              return childStatsOptions;
            }
          );
      } else {
        /** @type {NormalizedStatsOptions} */
        (statsOptions) = normalizeStatsOptions(
          /** @type {StatsOptions} */ (statsOptions)
        );

        if (typeof statsOptions.colors === "undefined") {
          statsOptions.colors = isColorSupported;
        }
      }

      const printedStats = stats.toString(statsOptions);

      // Avoid extra empty line when `stats: 'none'`
      if (printedStats) {
        // eslint-disable-next-line no-console
        console.log(printedStats);
      }

      // eslint-disable-next-line no-param-reassign
      context.callbacks = [];

      // Execute callback that are delayed
      callbacks.forEach(
        /**
         * @param {(...args: any[]) => Stats | MultiStats} callback
         */
        (callback) => {
          callback(stats);
        }
      );
    });
  }

  context.compiler.hooks.watchRun.tap("webpack-dev-middleware", invalid);
  context.compiler.hooks.invalid.tap("webpack-dev-middleware", invalid);
  context.compiler.hooks.done.tap("webpack-dev-middleware", done);
}

module.exports = setupHooks;
