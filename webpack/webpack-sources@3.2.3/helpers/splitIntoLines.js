// 将 字符串 分割成 字符片段数组
// 字符片段结尾必须是换行符
// 示例: 'hello \n world \n\n\n over' => ['hello \n', ' world \n', '\n', '\n', ' over']
const splitIntoLines = str => {
	const results = [];
	const len = str.length;
	let i = 0;
	for (; i < len; ) {
		const cc = str.charCodeAt(i);
		// 10 is "\n".charCodeAt(0)
		if (cc === 10) {
			results.push("\n");
			i++;
		} else {
			let j = i + 1;
			// 10 is "\n".charCodeAt(0)
			while (j < len && str.charCodeAt(j) !== 10) j++;
			results.push(str.slice(i, j + 1));
			i = j + 1;
		}
	}
	return results;
};
module.exports = splitIntoLines;
