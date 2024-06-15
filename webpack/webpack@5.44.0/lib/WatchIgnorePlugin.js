"use strict";

const createSchemaValidation = require("./util/create-schema-validation");

const validate = createSchemaValidation(
	require("../schemas/plugins/WatchIgnorePlugin.check.js"),
	() => require("../schemas/plugins/WatchIgnorePlugin.json"),
	{
		name: "Watch Ignore Plugin",
		baseDataPath: "options"
	}
);

const IGNORE_TIME_ENTRY = "ignore";

class IgnoringWatchFileSystem {
	constructor(wfs, paths) {
		this.wfs = wfs;
		this.paths = paths;
	}

	watch(files, dirs, missing, startTime, options, callback, callbackUndelayed) {
		files = Array.from(files);
		dirs = Array.from(dirs);
		const ignored = path =>
			this.paths.some(p =>
				p instanceof RegExp ? p.test(path) : path.indexOf(p) === 0
			);

		const notIgnored = path => !ignored(path);

		const ignoredFiles = files.filter(ignored);
		const ignoredDirs = dirs.filter(ignored);

		const watcher = this.wfs.watch(
			files.filter(notIgnored),
			dirs.filter(notIgnored),
			missing,
			startTime,
			options,
			(err, fileTimestamps, dirTimestamps, changedFiles, removedFiles) => {
				if (err) return callback(err);
				for (const path of ignoredFiles) {
					fileTimestamps.set(path, IGNORE_TIME_ENTRY);
				}

				for (const path of ignoredDirs) {
					dirTimestamps.set(path, IGNORE_TIME_ENTRY);
				}

				callback(
					err,
					fileTimestamps,
					dirTimestamps,
					changedFiles,
					removedFiles
				);
			},
			callbackUndelayed
		);

		return {
			close: () => watcher.close(),
			pause: () => watcher.pause(),
			getContextTimeInfoEntries: () => {
				const dirTimestamps = watcher.getContextTimeInfoEntries();
				for (const path of ignoredDirs) {
					dirTimestamps.set(path, IGNORE_TIME_ENTRY);
				}
				return dirTimestamps;
			},
			getFileTimeInfoEntries: () => {
				const fileTimestamps = watcher.getFileTimeInfoEntries();
				for (const path of ignoredFiles) {
					fileTimestamps.set(path, IGNORE_TIME_ENTRY);
				}
				return fileTimestamps;
			}
		};
	}
}

// 配置 观察模式 下 应忽视的文件
class WatchIgnorePlugin {
	constructor(options) {
		validate(options);
		this.paths = options.paths;
	}

	apply(compiler) {
		compiler.hooks.afterEnvironment.tap("WatchIgnorePlugin", () => {
			compiler.watchFileSystem = new IgnoringWatchFileSystem(
				compiler.watchFileSystem,
				this.paths
			);
		});
	}
}

module.exports = WatchIgnorePlugin;
