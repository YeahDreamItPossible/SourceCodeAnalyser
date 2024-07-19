"use strict";

const ExternalsPlugin = require("../ExternalsPlugin");

const builtins = [
	"assert",
	"async_hooks",
	"buffer",
	"child_process",
	"cluster",
	"console",
	"constants",
	"crypto",
	"dgram",
	"dns",
	"dns/promises",
	"domain",
	"events",
	"fs",
	"fs/promises",
	"http",
	"http2",
	"https",
	"inspector",
	"module",
	"net",
	"os",
	"path",
	"perf_hooks",
	"process",
	"punycode",
	"querystring",
	"readline",
	"repl",
	"stream",
	"stream/promises",
	"string_decoder",
	"sys",
	"timers",
	"timers/promises",
	"tls",
	"trace_events",
	"tty",
	"url",
	"util",
	"v8",
	"vm",
	"wasi",
	"worker_threads",
	"zlib",
	/^node:/,

	// cspell:word pnpapi
	// Yarn PnP adds pnpapi as "builtin"
	"pnpapi"
];

// 根据 Webpack.options.externalsPresets.node 选项注册该插件
// Node环境目标插件
// 作用: 在 node 环境中 将 node.js 的内置模块视为 external 模块
class NodeTargetPlugin {
	apply(compiler) {
		new ExternalsPlugin("node-commonjs", builtins).apply(compiler);
	}
}

module.exports = NodeTargetPlugin;
