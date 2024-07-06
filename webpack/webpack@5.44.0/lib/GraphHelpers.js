"use strict";

/**
 * 绑定 Chunk 与 ChunkGroup 关联关系
 * ChunkGroup.prototype.chunks.push(Chunk)
 * Chunk.prototype._groups.push(ChunkGroup)
 */
const connectChunkGroupAndChunk = (chunkGroup, chunk) => {
	if (chunkGroup.pushChunk(chunk)) {
		chunk.addGroup(chunkGroup);
	}
};

/**
 * 绑定 ChunkGroup 的嵌套关系
 * ChunkGroup.prototype._parents.add(child)
 * ChunkGroup.prototype._children.add(parent)
 */
const connectChunkGroupParentAndChild = (parent, child) => {
	if (parent.addChild(child)) {
		child.addParent(parent);
	}
};

exports.connectChunkGroupAndChunk = connectChunkGroupAndChunk;
exports.connectChunkGroupParentAndChild = connectChunkGroupParentAndChild;
