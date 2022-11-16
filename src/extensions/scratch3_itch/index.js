// Core, Team, and Official extensions can `require` VM code:
const ArgumentType = require('../../extension-support/argument-type');
const BlockType = require('../../extension-support/block-type');
// const TargetType = require('../../extension-support/target-type');

// ...or VM dependencies:
const formatMessage = require('format-message');

const sb3 = require('../../serialization/sb3');

const stageProperties = [
    'backdrop #',
    'backdrop name',
    'volume'
];
const spriteProperties = [
    'x position',
    'y position',
    'direction',
    'costume #',
    'costume name',
    'size',
    'volume'
];
// a state should also add the variables defined there (see blocks.js in the gui line 230)


// Core, Team, and Official extension classes should be registered statically with the Extension Manager.
// See: scratch-vm/src/extension-support/extension-manager.js
class Scratch3ItchBlocks {
    constructor (runtime) {
        /**
         * Store this for later communication with the Scratch VM runtime.
         * If this extension is running in a sandbox then `runtime` is an async proxy object.
         * @type {Runtime}
         */
        this.runtime = runtime;
    }

    _getKeyList () {
        const keys = [' ', 'ArrowUp', 'ArrowDown', 'ArrowRight', 'ArrowLeft'];
        for (let i = 0; i < 26; i++) {
            keys.push(String.fromCharCode(97 + i));
        }
        for (let i = 0; i < 10; i++) {
            keys.push(i.toString());
        }
        return keys;
    }

    _getSpritesList () {
        // todo: make complex list elements
        return this.runtime.targets.map((target, _) => target.getName());
    }

    _getPropertiesList () {
        // todo: different options when the selected sprite is a stage
        // use: this.runtime.threads.at(0).peekStack() to know block
        return spriteProperties;
    }

    /**
     * _stringifyTargets.
     * @param {Target[]} targets - list of the targets to stringify.
     * @returns {string} value of the queried field
     */
    _stringifyTargets (targets) {
        const result = [];
        for (const target of targets) {
            if (target.sprite) {
                const spriteJson = {sprite: {}};
                for (const property of spriteProperties) {
                    spriteJson.sprite[property] = this._getAttributeOf(target, property);
                }
                result.push(spriteJson);
            }
        }
        return JSON.stringify(result);
    }

    /**
     * get an attribute of a target that is a sprite or a stage.
     * @param {RenderedTarget|object} target - the target.
     * @param {string} property - the property name.
     * @returns {number|*} property value
     * @private
     */
    _getAttributeOf (target, property) {
        if (target.isStage) {
            switch (property) {
            case 'background #': return target.currentCostume + 1;
            case 'backdrop #': return target.currentCostume + 1;
            case 'backdrop name':
                return target.costumes[target.currentCostume].name;
            case 'volume': return target.volume;
            }
        } else {
            switch (property) {
            case 'x position': return target.x;
            case 'y position': return target.y;
            case 'direction': return target.direction;
            case 'costume #': return target.currentCostume + 1;
            case 'costume name':
                return target.costumes[target.currentCostume].name;
            case 'size': return target.size;
            case 'volume': return target.volume;
            }
        }
        return 0;
    }

    /**
     * @return {object} This extension's metadata.
     */
    getInfo () {
        return {
            // Required: the machine-readable name of this extension.
            // Will be used as the extension's namespace.
            // Allowed characters are those matching the regular expression [\w-]: A-Z, a-z, 0-9, and hyphen ("-").
            id: 'itch',

            // Core extensions only: override the default extension block colors.
            color1: '#8a0202',
            color2: '#640101',

            // Optional: the human-readable name of this extension as string.
            // This and any other string to be displayed in the Scratch UI may either be
            // a string or a call to `formatMessage`; a plain string will not be
            // translated whereas a call to `formatMessage` will connect the string
            // to the translation map (see below). The `formatMessage` call is
            // similar to `formatMessage` from `react-intl` in form, but will actually
            // call some extension support code to do its magic. For example, we will
            // internally namespace the messages such that two extensions could have
            // messages with the same ID without colliding.
            // See also: https://github.com/yahoo/react-intl/wiki/API#formatmessage
            name: formatMessage({
                id: 'itch.categoryName',
                default: 'Itch',
                description: 'Label for the itch extension category'
            }),

            // Required: the list of blocks implemented by this extension,
            // in the order intended for display.
            blocks: [
                {
                    // Required: the machine-readable name of this operation.
                    // This will appear in project JSON.
                    opcode: 'assert', // becomes 'itch.assert'

                    // Required: the kind of block we're defining, from a predefined list.
                    // Fully supported block types:
                    //   BlockType.BOOLEAN - same as REPORTER but returns a Boolean value
                    //   BlockType.COMMAND - a normal command block, like "move {} steps"
                    //   BlockType.HAT - starts a stack if its value changes from falsy to truthy ("edge triggered")
                    //   BlockType.REPORTER - returns a value, like "direction"
                    // Block types in development or for internal use only:
                    //   BlockType.BUTTON - place a button in the block palette
                    //   BlockType.CONDITIONAL - control flow, like "if {}" or "if {} else {}"
                    //     A CONDITIONAL block may return the one-based index of a branch to
                    //     run, or it may return zero/falsy to run no branch.
                    //   BlockType.EVENT - starts a stack in response to an event (full spec TBD)
                    //   BlockType.LOOP - control flow, like "repeat {} {}" or "forever {}"
                    //     A LOOP block is like a CONDITIONAL block with two differences:
                    //     - the block is assumed to have exactly one child branch, and
                    //     - each time a child branch finishes, the loop block is called again.
                    blockType: BlockType.COMMAND,

                    // Required for CONDITIONAL blocks, ignored for others: the number of
                    // child branches this block controls. An "if" or "repeat" block would
                    // specify a branch count of 1; an "if-else" block would specify a
                    // branch count of 2.
                    // TODO: should we support dynamic branch count for "switch"-likes?
                    // branchCount: 0,

                    // Required: the human-readable text on this block, including argument
                    // placeholders. Argument placeholders should be in [MACRO_CASE] and
                    // must be [ENCLOSED_WITHIN_SQUARE_BRACKETS].
                    text: formatMessage({
                        id: 'assertLabel',
                        default: 'Assert [ASSERT_CONDITION]',
                        description: 'Label on the "assert" block'
                    }),

                    // Required: describe each argument.
                    // Argument order may change during translation, so arguments are
                    // identified by their placeholder name. In those situations where
                    // arguments must be ordered or assigned an ordinal, such as interaction
                    // with Scratch Blocks, arguments are ordered as they are in the default
                    // translation (probably English).
                    arguments: {
                        // Required: the ID of the argument, which will be the name in the
                        // args object passed to the implementation function.
                        ASSERT_CONDITION: {
                            // Required: type of the argument / shape of the block input
                            type: ArgumentType.BOOLEAN,

                            // Optional: the default value of the argument
                            default: false
                        }
                    }
                },
                {
                    opcode: 'assertWrong',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'assertWrongLabel',
                        default: 'Assert [ASSERT_CONDITION] Wrong: [TEXT_WRONG]',
                        description: 'Label on the "assertWrong" block'
                    }),
                    arguments: {
                        ASSERT_CONDITION: {
                            type: ArgumentType.BOOLEAN,
                            default: false
                        },
                        TEXT_WRONG: {
                            type: ArgumentType.STRING,
                            default: formatMessage({
                                id: 'itch.TEXT_WRONG_default',
                                defaultMessage: 'An assert was wrong',
                                description: 'Default for "TEXT_WRONG" argument of "itch.assertWrong"'
                            })
                        }
                    }
                },
                {
                    opcode: 'startTests',
                    blockType: BlockType.HAT,
                    text: formatMessage({
                        id: 'startTestsLabel',
                        default: 'Test flag clicked',
                        description: 'Label on the "Test flag clicked" block'
                    })
                },
                {
                    opcode: 'pressKey',
                    blockType: BlockType.COMMAND,

                    text: formatMessage({
                        id: 'pressKeyLabel',
                        default: 'Press [KEY] key',
                        description: 'Label on the "pressKey" block'
                    }),
                    arguments: {
                        KEY: {
                            type: ArgumentType.STRING,
                            menu: 'keys'
                        }
                    }
                },
                {
                    opcode: 'queryState',
                    blockType: BlockType.REPORTER,
                    text: formatMessage({
                        id: 'queryStateLabel',
                        default: '[PROPERTY] of [OBJECT] in [STATE]',
                        description: 'Label on the "queryState" block'
                    }),
                    arguments: {
                        PROPERTY: {
                            type: ArgumentType.STRING,
                            menu: 'properties'
                        },
                        OBJECT: {
                            // Required: type of the argument / shape of the block input
                            type: ArgumentType.STRING,
                            menu: 'sprites'
                        },
                        STATE: {
                            type: ArgumentType.STRING
                        }
                    }
                },
                {
                    opcode: 'currentState',
                    blockType: BlockType.REPORTER,
                    text: formatMessage({
                        id: 'currentStateLabel',
                        default: 'current state',
                        description: 'Label on the "currentState" variable'
                    }),
                    arguments: {}
                }
            ],
            // Optional: define extension-specific menus here.
            menus: {
                // Required: an identifier for this menu, unique within this extension.
                keys: this._getKeyList(),

                // // Dynamic menu: returns an array as above.
                // // Called each time the menu is opened.
                // menuB: 'getItemsForMenuB',
                //
                // // The examples above are shorthand for setting only the `items` property in this full form:
                // menuC: {
                //     // This flag makes a "droppable" menu: the menu will allow dropping a reporter in for the input.
                //     acceptReporters: true,
                //
                //     // The `item` property may be an array or function name as in previous menu examples.
                //     items: [/*...*/] || 'getItemsForMenuC'
                // }

                // The examples above are shorthand for setting only the `items` property in this full form:
                sprites: {
                    // This flag makes a "droppable" menu: the menu will allow dropping a reporter in for the input.
                    acceptReporters: false,

                    // The `item` property may be an array or function name as in previous menu examples.
                    items: '_getSpritesList'
                },
                properties: {
                    // This flag makes a "droppable" menu: the menu will allow dropping a reporter in for the input.
                    acceptReporters: false,

                    // The `item` property may be an array or function name as in previous menu examples.
                    items: '_getPropertiesList'
                }
            }
        };
    }

    /**
     * Implement assert.
     * @param {object} args - the block's arguments.
     */
    assert (args) {
        if (!args.ASSERT_CONDITION) {
            alert('An assert failed');
        }
    }

    _countNonEmptyStacks () {
        let count = 0;
        this.runtime.threads.forEach(thread => {
            if (thread.stack.length) {
                count++;
            }
        });
        return count;
    }

    /**
     * Implement assertWrong.
     * @param {object} args - the block's arguments.
     */
    assertWrong (args) {
        if (!args.ASSERT_CONDITION) {
            alert(args.TEXT_WRONG);
        }
    }

    /**
     * Implement startTests.
     * @param {object} args - the block's arguments.
     * @returns {boolean} true if the tests should start
     */
    startTests (args) {
        // TODO: fix: this implementation is flawed since it only works with 1 head block
        if (this.runtime.testFlagClicked) {
            this.runtime.testFlagClicked = false;
            return true;
        }
        return false;
    }

    /**
     * Implement pressKey.
     * @param {object} args - the block's arguments.
     */
    pressKey (args) {
        this.runtime.ioDevices.keyboard.postData({key: args.KEY, isDown: true});
        this.runtime.ioDevices.keyboard.postData({key: args.KEY, isDown: false});
        // wait for the test thread to be the only thread or wait maximum 1 sec
        // The test thread should wait here until all other threads have completed.

        // does not wait, because this function is 1 unit.
        // const start = Date.now();
        // while (this._countNonEmptyStacks() > 1 && Date.now() - start < 1000) {}

        // TODO: look at how broadcast and wait block is implemented
    }

    /**
     * Implement queryState variable.
     * @param {object} args - the block's arguments.
     * @returns {string} value of the queried field
     */
    queryState (args) {
        if (!args.STATE) return '';

        const savedState = JSON.parse(args.STATE);
        // console.log(sb3.deserialize(savedState, new Runtime(), undefined, false));
        // console.log(savedState);
        const sprite = savedState.targets.find(target => target.name === args.OBJECT);
        // console.log(sprite);
        if (sprite) {
            return this._getAttributeOf(sprite, args.PROPERTY);
        }
        return '';
    }

    /**
     * Implement currentState variable.
     * @param {object} args - the block's arguments.
     * @returns {string} string of a json that contains the runtime
     */
    currentState (args) {
        return JSON.stringify(sb3.serialize(this.runtime));
    }
}

module.exports = Scratch3ItchBlocks;
