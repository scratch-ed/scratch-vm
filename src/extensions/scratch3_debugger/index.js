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
                        default: 'pauzeer',
                        description: 'pauzeer de uitvoering'
                    })
                },
                {
                    opcode: 'breakConditional',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'debugger.breakConditional',
                        default: 'pauzeer als [CONDITION]',
                        description: 'pauzeer de uitvoering als een voorwaarde voldaan is'
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
                        default: 'watch tot [CONDITION] en pauzeer dan',
                        description: 'Wacht tot een voorwaarde voldaan is, als de voorwaarde voldaan is, pauzeer'
                    }),
                    // isTerminal: true,
                    arguments: {
                        CONDITION: {
                            type: ArgumentType.BOOLEAN
                        }
                    }
                },
                // {
                //     opcode: 'waitUntilConditionalAndBreak',
                //     blockType: BlockType.HAT,
                //     text: formatMessage({
                //         id: 'debugger.waitUntilConditionalAndBreak',
                //         default: 'Pauzeer als [CONDITION]',
                //         description: 'Pauzeer eender wanneer als de voorwaarde voldaan is'
                //     }),
                //     isTerminal: true,
                //     arguments: {
                //         CONDITION: {
                //             type: ArgumentType.BOOLEAN
                //         }
                //     }
                // },
                {
                    opcode: 'debugModeEnabled',
                    blockType: BlockType.BOOLEAN,
                    text: formatMessage({
                        id: 'debugger.debuggerEnabled',
                        default: 'de debugger ingeschakeld is',
                        description: 'is de debugger ingeschakeld?'
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
    // WaitUntilConditionalAndBreak (args, util) {
    //     if (this.runtime.debugMode && Cast.toBoolean(args.CONDITION)) {
    //         this.runtime.requestPause();
    //         return true;
    //     }
    //     return false;
    // }

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
