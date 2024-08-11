"use strict";

// 数组队列
// 作用:
// 
class ArrayQueue {
	constructor(items) {
		// 数组
		// Array<T>
		this._list = items ? Array.from(items) : [];
		// 反转数组
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

	// 出队
	dequeue() {
		// 如果 数组 的长度大于或等于 16
		// 则将 数组 的内容转移到 反转数组 上 
		// 并将 数组 清空
		// 这样做的目的是为了避免在 数组 较长时频繁使用 shift() 方法
		// 因为反转整个数组并使用 pop() 方法来出队可能更高效
		if (this._listReversed.length === 0) {
			if (this._list.length === 0) return undefined;
			// 从数组中删除最后一个元素 并返回该元素
			if (this._list.length === 1) return this._list.pop();
			// 当 数组长度 < 16 时 从数组中删除第一个元素
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
