const {v4} = require('uuid');

class TreeNode {
    constructor (blockId, value, parent) {
        if (!parent) {
            this.parseStack = [];
            this.parseStack.push(this);
        }
        // id of the feedback block, the feedback block may be in a loop, and thus this id might not be unique
        this.blockId = blockId;
        this.value = value;
        this.parent = parent;
        this.children = [];
        this.groupPassed = true;
        this.id = v4(); // unique id for this node
    }

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

    traverse () {
        const nodes = [this];
        while (nodes.length) {
            const node = nodes.shift();
            console.log(node.id, node.value);
            nodes.push(...node.children);
        }
    }
}
// sanity checks
// const tree = new TreeNode(1, 'a');
// tree.insert(2, 'b');
// tree.insert(3, 'c');
// let child = tree.children[0];
// child.insert(4, 'd');
// child.insert(5, 'e');
// child = child.children[0];
// child.insert(6, 'f');
// child = child.children[0];
// child.parent.insert(7, 'g');
//
// const parent = child.parent;
// parent.insert(8, 'h');
// child.getNextSibling().parent.insert(9, 'i');
// tree.setCurrentlyParsingNode(tree.children[1]);
// tree.getCurrentlyParsingNode().insert(10, 'j');
// tree.setCurrentlyParsingNode(tree.children[0].children[0]);
// console.log(child.getCurrentlyParsingNode());
// tree.traverse();

module.exports = TreeNode;

// Tree with parent pointers
