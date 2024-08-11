"use strict";

// 队列
// 作用:
// 先进先出
class Queue {
	constructor(items) {
		this._set = new Set(items);
		this._iterator = this._set[Symbol.iterator]();
	}

	// 返回队列长度
	get length() {
		return this._set.size;
	}

	// 入队
	enqueue(item) {
		this._set.add(item);
	}

	// 出队
	dequeue() {
		const result = this._iterator.next();
		if (result.done) return undefined;
		this._set.delete(result.value);
		return result.value;
	}
}

module.exports = Queue;
