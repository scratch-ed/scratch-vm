const ArgumentType = require('../../extension-support/argument-type');
const BlockType = require('../../extension-support/block-type');

const formatMessage = require('format-message');

/**
 * Icon SVG to be displayed at the left edge of each extension block, encoded as a data URI.
 * @type {string}
 */
// eslint-disable-next-line max-len
const blockIconURI = '';

/**
 * Host for the debugger-related blocks in Scratch 3.0.
 * @param {Runtime} runtime - the runtime instantiating this block package
 * @constructor
 */
class Scratch3DebuggerBlocks {
    constructor (runtime) {
        /**
         * The runtime instantiating this block package.
         * @type {Runtime}
         */
        this.runtime = runtime;
    }

    /**
     * @returns {object} metadata for this extension and its blocks
     */
    getInfo () {
        return {
            id: 'debugger',
            name: formatMessage({
                id: 'debugger.categoryName',
                default: 'Debugger',
                description: 'Label for the debugger extension category'
            }),
            blocks: [
                {
                    opcode: 'break',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'debugger.break',
                        default: 'break',
                        description: 'break the execution'
                    })
                },
                {
                    opcode: 'breakConditional',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'debugger.breakConditional',
                        default: 'break if [CONDITION]',
                        description: 'break the execution based on a condition'
                    }),
                    arguments: {
                        CONDITION: {
                            type: ArgumentType.BOOLEAN
                        }
                    }
                }
            ]
        };
    }

    /**
     * The "break" block breaks the execution of the program.
     */
    break () {
        if (!this.runtime.debugMode) {
            return;
        }

        console.log('BREAK');
    }

    /**
     * The "break" block breaks the execution of the program.
     * @param {object} args - the block's arguments
     */
    breakConditional (args) {
        if (!this.runtime.debugMode || !args.CONDITION) {
            return;
        }

        console.log('BREAK CONDITIONAL');
    }
}

module.exports = Scratch3DebuggerBlocks;
