const {v4} = require('uuid');

class TreeNode {
    constructor (blockId, value, parent) {
        if (!parent) {
            // stack where the encountered nodes are pushed to and popped from
            // pushed when encountered, popped when finished. This stack is used to build the tree.
            // This stack is shared by all nodes in the tree and the root node is the only one keeping a pointer to it.
            this.parseStack = [];
            this.parseStack.push(this); // a new node is constructed => push it on the parseStack.
        }
        // id of the feedback block, the feedback block may be in a loop (i.e repeat block),
        // and thus this id might not be unique
        this.blockId = blockId;
        this.value = value;
        this.parent = parent;
        this.children = [];
        this.groupPassed = true;
        this.id = v4(); // unique id for this node
    }

    // make a new node and add it as a child to this node.
    insert (blockId, value) {
        const node = new TreeNode(blockId, value, this);
        this.children.push(node);
        return this.children[this.children.length - 1];
    }

    peekParseStack () {
        if (!this.parent) {
            return this.parseStack[this.parseStack.length - 1];
        }
        return this.parent.peekParseStack();
    }

    getParseStack () {
        if (!this.parent) {
            return this.parseStack;
        }
        return this.parent.getParseStack();
    }

    groupFailed () {
        this.groupPassed = false;
        if (this.parent) {
            this.parent.groupFailed();
        }
    }
}

module.exports = TreeNode;
