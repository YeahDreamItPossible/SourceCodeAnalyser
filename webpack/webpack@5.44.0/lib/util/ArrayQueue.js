"use strict";

// 数组队列
// 作用:
// 
class ArrayQueue {
	constructor(items) {
		// Array<T>
		this._list = items ? Array.from(items) : [];
		// Array<T>
		this._listReversed = [];
	}

	// 返回队列中元素总数
	get length() {
		return this._list.length + this._listReversed.length;
	}

	// 清空队列
	clear() {
		this._list.length = 0;
		this._listReversed.length = 0;
	}

	// 入队
	enqueue(item) {
		this._list.push(item);
	}

	/**
	 * Retrieves and removes the head of this queue.
	 * @returns {T | undefined} The head of the queue of `undefined` if this queue is empty.
	 */
	// 出队
	dequeue() {
		// NOTE: 没看懂 队列长度为16
		if (this._listReversed.length === 0) {
			if (this._list.length === 0) return undefined;
			if (this._list.length === 1) return this._list.pop();
			if (this._list.length < 16) return this._list.shift();
			const temp = this._listReversed;
			this._listReversed = this._list;
			this._listReversed.reverse();
			this._list = temp;
		}
		return this._listReversed.pop();
	}

	// 删除某个元素
	delete(item) {
		const i = this._list.indexOf(item);
		if (i >= 0) {
			this._list.splice(i, 1);
		} else {
			const i = this._listReversed.indexOf(item);
			if (i >= 0) this._listReversed.splice(i, 1);
		}
	}

	// 迭代器
	[Symbol.iterator]() {
		let i = -1;
		let reversed = false;
		return {
			next: () => {
				if (!reversed) {
					i++;
					if (i < this._list.length) {
						return {
							done: false,
							value: this._list[i]
						};
					}
					reversed = true;
					i = this._listReversed.length;
				}
				i--;
				if (i < 0) {
					return {
						done: true,
						value: undefined
					};
				}
				return {
					done: false,
					value: this._listReversed[i]
				};
			}
		};
	}
}

module.exports = ArrayQueue;
