"use strict";

const Dependency = require("../Dependency");
const makeSerializable = require("../util/makeSerializable");

// TODO:
// 提供共享插件
// 作用:
// 
class ProvideSharedDependency extends Dependency {
	constructor(shareScope, name, version, request, eager) {
		super();
		this.shareScope = shareScope;
		this.name = name;
		this.version = version;
		this.request = request;
		this.eager = eager;
	}

	get type() {
		return "provide shared module";
	}

	/**
	 * @returns {string | null} an identifier to merge equal requests
	 */
	getResourceIdentifier() {
		return `provide module (${this.shareScope}) ${this.request} as ${
			this.name
		} @ ${this.version}${this.eager ? " (eager)" : ""}`;
	}

	serialize(context) {
		context.write(this.shareScope);
		context.write(this.name);
		context.write(this.request);
		context.write(this.version);
		context.write(this.eager);
		super.serialize(context);
	}

	static deserialize(context) {
		const { read } = context;
		const obj = new ProvideSharedDependency(
			read(),
			read(),
			read(),
			read(),
			read()
		);
		this.shareScope = context.read();
		obj.deserialize(context);
		return obj;
	}
}

makeSerializable(
	ProvideSharedDependency,
	"webpack/lib/sharing/ProvideSharedDependency"
);

module.exports = ProvideSharedDependency;
