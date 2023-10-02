const ArgumentType = require('../../extension-support/argument-type');
const BlockType = require('../../extension-support/block-type');

const formatMessage = require('format-message');
const Cast = require('../../util/cast');

/**
 * Icon SVG to be displayed at the left edge of each extension block, encoded as a data URI.
 * @type {string}
 */
// eslint-disable-next-line max-len
// const blockIconURI = '';

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
                        default: 'pause',
                        description: 'pause the execution'
                    })
                },
                {
                    opcode: 'breakConditional',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'debugger.breakConditional',
                        default: 'pause if [CONDITION]',
                        description: 'pause the execution if the condition holds'
                    }),
                    arguments: {
                        CONDITION: {
                            type: ArgumentType.BOOLEAN
                        }
                    }
                },
                {
                    opcode: 'waitUntilConditionalAndBreak',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'debugger.waitUntilConditionalAndBreak',
                        default: 'wait until [CONDITION] and pause',
                        description: 'wait until a condition holds and then pause'
                    }),
                    // isTerminal: true,
                    arguments: {
                        CONDITION: {
                            type: ArgumentType.BOOLEAN
                        }
                    }
                },
                {
                    opcode: 'debugModeEnabled',
                    blockType: BlockType.BOOLEAN,
                    text: formatMessage({
                        id: 'debugger.debuggerEnabled',
                        default: 'debugger is enabled?',
                        description: 'is the debugger enabled?'
                    })
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

        this.runtime.requestPause();
    }

    /**
     * The "breakConditional" block breaks the execution of the program
     * if the condition evaluates to true.
     *
     * @param {object} args - the block's arguments
     */
    breakConditional (args) {
        if (!this.runtime.debugMode || !Cast.toBoolean(args.CONDITION)) {
            return;
        }

        this.runtime.requestPause();
    }

    /**
     * The "waitUntilConditionalAndBreak" block breaks the execution of the program
     * if the condition evaluates to true.
     *
     * @param {object} args - the block's arguments
     * @param {object} util - Util
     */
    waitUntilConditionalAndBreak (args, util) {
        if (!this.runtime.debugMode || !Cast.toBoolean(args.CONDITION)) {
            util.yield();
        } else {
            this.runtime.requestPause();
        }
    }

    /**
     * The "debugModeEnabled" block indicates whether debug mode is enabled.
     *
     * @return {boolean} - whether debug mode is enabled
     */
    debugModeEnabled () {
        return this.runtime.debugMode;
    }
}

module.exports = Scratch3DebuggerBlocks;
