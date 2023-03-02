// Core, Team, and Official extensions can `require` VM code:
const ArgumentType = require('../../extension-support/argument-type');
const BlockType = require('../../extension-support/block-type');
const {v4} = require('uuid');
// const TargetType = require('../../extension-support/target-type');

// ...or VM dependencies:
const formatMessage = require('format-message');

const Thread = require('../../engine/thread');

const TreeNode = require('./FeedbackTree');
//
// const judge = require('@ftrprf/judge-core');
// // const WhenPressKeyAction = require('@ftrprf/judge-core/src/actions/WhenPressKeyAction');
//
// // const ScheduledEvent = require('@ftrprf/judge-core/src/');
// import {ScheduledEvent} from '@ftrprf/judge-core/src/scheduler/scheduled-event.ts';

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

        // activate the startTests hat block when 'PROJECT_TEST_START' is emitted.
        this.runtime.on('PROJECT_TESTS_START', () => {
            const startedThreads = this.runtime.startHats('itch_startTests');
            if (!startedThreads.length) {
                return;
            }

            // (re)initialise the feedback tree
            this.runtime.feedbackTrees[startedThreads[0].topBlock] = new TreeNode(0, 'rootGroup');

            this._undoInjection(startedThreads[0].topBlock);
            this._clearDataStructures();
        });
    }

    /**
     * Clear datastructures used for the test execution.
     * @private
     */
    _clearDataStructures () {
        // Clear datastructures
        // List of sprites where the test code is already injected into.
        this.testCodeInjected = [];
        // maps withSpriteDoBlock -> broadcastMessage
        this.withSpriteDoBlockToBroadcastMessage = {};
        // maps withSpriteDoBlock -> broadcastId
        this.withSpriteDoBlockToBroadcastId = {};
    }

    /**
     * Undo the injection of the test code and broadcast blocks.
     * @param {string} testThreadTopBlock ID of the top block (when tests started) of the test thread.
     * @private
     */
    _undoInjection (testThreadTopBlock) {
        // If datastructures are not initialized yet, there is nothing to clean.
        if (!this.testCodeInjected ||
            !this.withSpriteDoBlockToBroadcastId ||
            !this.withSpriteDoBlockToBroadcastMessage) {
            return;
        }

        // We clean up the injected blocks of the previous execution
        // At the moment this seems to be the best way to do this, but it is not very clean since the injected blocks
        // of the last execution are not deleted.
        for (const spriteName of this.testCodeInjected) {
            const sprite = this.runtime.getTargetById(this.runtime.getSpriteTargetByName(spriteName).id);
            // Delete inserted test code
            sprite.blocks.deleteBlock(testThreadTopBlock);
            // Delete inserted broadcast blocks
            for (const broadcastId of Object.values(this.withSpriteDoBlockToBroadcastId)) {
                sprite.blocks.deleteBlock(broadcastId);
            }
        }
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
            color1: '#be1e2d',
            color2: '#9e1824',

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
                    opcode: 'assert', // becomes 'itch_assert'

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
                            defaultValue: false
                        }
                    }
                },
                {
                    opcode: 'namedAssert',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'namedAssertLabel',
                        default: 'Assert [ASSERT_CONDITION] named [NAME]',
                        description: 'Label on the "namedAssert" block'
                    }),
                    arguments: {
                        NAME: {
                            type: ArgumentType.STRING,
                            defaultValue: ' '
                        },
                        ASSERT_CONDITION: {
                            type: ArgumentType.BOOLEAN,
                            defaultValue: false
                        }
                    }
                },
                {
                    opcode: 'startTests',
                    blockType: BlockType.EVENT,
                    isEdgeActivated: false, // undocumented option that is used on line 1234 of src/engine/runtime.js
                    // if test flag is clicked, restart the test thread if already running
                    shouldRestartExistingThreads: true,
                    text: formatMessage({
                        id: 'startTestsLabel',
                        default: 'When tests started',
                        description: 'Label on the "Test flag clicked" block'
                    })
                },
                {
                    opcode: 'groupName',
                    blockType: BlockType.CONDITIONAL,
                    branchCount: 1,
                    text: 'Test group [GROUP_NAME]',
                    arguments: {
                        GROUP_NAME: {
                            type: ArgumentType.STRING,
                            defaultValue: ' '
                        }
                    }
                },
                {
                    opcode: 'forSpriteDo',
                    blockType: BlockType.CONDITIONAL,
                    branchCount: 1,
                    text: 'For [SPRITE] do',
                    arguments: {
                        SPRITE: {
                            type: ArgumentType.STRING,
                            menu: 'sprites'
                        }
                    }
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
                    opcode: 'pressKeyAndWait',
                    blockType: BlockType.COMMAND,

                    text: formatMessage({
                        id: 'pressKeyAndWaitLabel',
                        default: 'Press [KEY] key and wait',
                        description: 'Label on the "pressKeyAndWait" block'
                    }),
                    arguments: {
                        KEY: {
                            type: ArgumentType.STRING,
                            menu: 'keys'
                        }
                    }
                },
                {
                    opcode: 'pressGreenFlag', // final opcode: itch_pressGreenFlag
                    blockType: BlockType.COMMAND,

                    text: formatMessage({
                        id: 'pressGreenFlagLabel',
                        default: 'Press green flag',
                        description: 'Label on the "pressGreenFlag" block'
                    })
                },
                // {
                //     opcode: 'pressGreenFlagAndWait',
                //     blockType: BlockType.COMMAND,
                //
                //     text: formatMessage({
                //         id: 'pressGreenFlagAndWaitLabel',
                //         default: 'Press green flag and wait',
                //         description: 'Label on the "pressGreenFlagAndWait" block'
                //     })
                // },
                {

                    opcode: 'moveMouseTo', // becomes 'itch_movemouseto'
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'moveMouseToXY',
                        default: 'Move mouse to x: [X] y: [Y]',
                        description: 'Label on the "moveMouseTo" block'
                    }),
                    arguments: {
                        X: {
                            type: ArgumentType.STRING,
                            defaultValue: 0
                        },
                        Y: {
                            type: ArgumentType.STRING,
                            defaultValue: 0
                        }
                    }
                },
                { // TODO: change name to querySnapshot
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
                            type: ArgumentType.STRING,
                            defaultValue: ' '
                        }
                    }
                },
                {
                    opcode: 'snapshot',
                    blockType: BlockType.REPORTER,
                    text: formatMessage({
                        id: 'snapshot',
                        default: 'snapshot',
                        description: 'Label on the "snapshot" variable'
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

    _getKeyList () {
        const keys = ['space', 'up arrow', 'down arrow', 'right arrow', 'left arrow'];
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
            if (!target.isStage) {
                const spriteJson = {};
                spriteJson['x position'] = target.x;
                spriteJson['y position'] = target.y;
                spriteJson.direction = target.direction;
                spriteJson['costume #'] = target.currentCostume + 1;
                spriteJson['costume name'] = target.sprite.costumes[target.currentCostume].name;
                spriteJson.size = target.size;
                spriteJson.volume = target.volume;
                spriteJson.name = target.sprite.name;
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
            case 'x position': return target['x position'];
            case 'y position': return target['y position'];
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

    _getCurrentFeedbackTree (util) {
        this._util = util;
        // For now we only support one feedback tree, once we support more than one "when tests started" head blocks
        // we can use multiple feedback trees to split up the many tests.
        // Injected blocks (see forSpriteDo()) have as their topBlock the ID of the first block in the
        // injected sequence. Right now the topBlock is also the key that the feedback tree is stored under. So when
        // multiple feedback trees are added this should be taken into account.
        return Object.values(this.runtime.feedbackTrees)[0];
    }

    _getCurrentBlockId (util) {
        return util.thread.peekStack();
    }

    _getCurrentBlock (util) {
        return util.thread.target.blocks.getBlock(this._getCurrentBlockId(util));
    }

    /**
     * Implement assert.
     * @param {object} args - the block's arguments.
     * @param {BlockUtility} util - the block utility object.
     */
    assert (args, util) {
        if (!args.ASSERT_CONDITION) {
            this._getCurrentFeedbackTree(util).peekParseStack()
                .groupFailed();
            // stop the thread where the assert failed
            // this.runtime.threads.at(0).stopThisScript();
        }
    }

    /**
     * Implement namedAssert.
     * @param {object} args - the block's arguments.
     * @param {BlockUtility} util - the block utility object.
     */
    namedAssert (args, util) {
        const tree = this._getCurrentFeedbackTree(util);
        // create a new node in the feedback tree and push it to the parseStack
        tree.getParseStack().push(tree.peekParseStack().insert(this._getCurrentBlockId(util), args.NAME));
        if (!args.ASSERT_CONDITION) {
            tree.peekParseStack().groupFailed();
        }
        // a named assert is a leaf (has no children), so pop immediately from the parseStack
        tree.getParseStack().pop();
    }

    /**
     * Implement groupName.
     * @param {object} args - the block's arguments.
     * @param {BlockUtility} util - the util.
     */
    groupName (args, util) {
        // TODO: maybe use util.stackframe to keep "loop" state instead of using blockId?
        // add root node to the feedback tree if it does not exist yet.
        if (!this._getCurrentFeedbackTree(util)) {
            this.runtime.feedbackTrees[util.thread.topBlock] = new TreeNode(0, 'rootGroup');
        }

        const tree = this._getCurrentFeedbackTree(util);

        if (tree.peekParseStack().blockId === this._getCurrentBlockId(util)) {
            // step out
            // pop the current group from the parse stack
            tree.getParseStack().pop();
        } else {
            // step into
            // create a new node (group) in the feedback tree and push it to the parseStack
            tree.getParseStack().push(tree.peekParseStack().insert(this._getCurrentBlockId(util), args.GROUP_NAME));

            // Say it is a loop so this function is called again,
            // but when it is called again do the first part of this if-else
            util.startBranch(1, true);
        }
    }

    /**
     * Adds a when broadcast received block to the given blocks with a random uuidv4 message.
     * @param {Blocks!} blocks - a blocks object of a sprite.
     * @param {string!} nextId - id of the block underneath the broadcast block
     * @returns {{whenBroadcastReceivedId: string, message: string}} - the id of the broadcast received block and the message its waits for.
     * @private
     */
    _createWhenBroadcastReceivedBlock (blocks, nextId) {
        // Example of json passed to createBlock when creating a event_whenbroadcastreceived block.
        //  {
        //      id: "jd7GP7cdZ?Lx0h4|q/vX",
        //      opcode: "event_whenbroadcastreceived",
        //      inputs: {},
        //      fields: {
        //          "BROADCAST_OPTION": {
        //              "name": "BROADCAST_OPTION",
        //              "id": "q9D[^gy67My1|kG5t8,O",
        //              "value": "message1",
        //              "variableType": "broadcast_msg"
        //          }
        //      },
        //      next: null,
        //      topLevel: true,
        //      parent: null,
        //      shadow: false,
        //      x: "-342",
        //      y: "539"
        //  }
        const message = v4();
        const whenBroadcastReceivedId = v4();
        const blockJson = {
            id: whenBroadcastReceivedId,
            opcode: 'event_whenbroadcastreceived',
            inputs: {},
            fields: {
                BROADCAST_OPTION: {
                    name: 'BROADCAST_OPTION',
                    id: v4(),
                    value: message,
                    variableType: 'broadcast_msg'
                }
            },
            next: nextId,
            // Setting topLevel to false makes sure it is not added to blocks._scripts.
            // It also causes it to not be executable, so we manually add and delete it from blocks._scripts later.
            topLevel: false,
            parent: null,
            shadow: false,
            x: '0',
            y: '0'
        };
        blocks.createBlock(blockJson);
        blocks._blocks[nextId].parent = whenBroadcastReceivedId;
        return {whenBroadcastReceivedId: whenBroadcastReceivedId, message: message};
    }

    _createBroadcastAndWaitBlock (blocks, parentBlockId, message) {
        const menuId = v4();
        const blockId = v4();

        const block = {
            id: blockId,
            opcode: 'event_broadcastandwait',
            inputs: {
                BROADCAST_INPUT: {
                    name: 'BROADCAST_INPUT',
                    block: menuId,
                    shadow: menuId
                }
            },
            fields: {},
            next: null,
            topLevel: true,
            parent: null,
            shadow: false,
            x: 0,
            y: 0
        };
        const menu = {
            id: menuId,
            opcode: 'event_broadcast_menu',
            inputs: {},
            fields: {
                BROADCAST_OPTION: {
                    name: 'BROADCAST_OPTION',
                    id: v4(),
                    value: message,
                    variableType: 'broadcast_msg'
                }
            },
            next: null,
            topLevel: false,
            parent: blockId,
            shadow: true
        };

        blocks.createBlock(menu);
        blocks.createBlock(block);
        return blockId;
    }

    /**
     * Implement forSpriteDo.
     * @param {object} args - the block's arguments.
     * @param {BlockUtility} util - the util.
     */
    forSpriteDo (args, util) {
        const spriteTarget = this.runtime.getTargetById(this.runtime.getSpriteTargetByName(args.SPRITE).id);
        const firstBranchBlockId = util.thread.target.blocks.getBranch(this._getCurrentBlockId(util), 1);
        const currentBlockId = this._getCurrentBlockId(util);
        // no blocks to be injected and executed
        if (!firstBranchBlockId) {
            return;
        }

        // If we have not injected the testcode into the target sprite, inject it.
        // This is done the first time the first withSpriteDo block is executed in the test thread.
        // TODO: what about clones?
        if (!this.testCodeInjected.includes(args.SPRITE)) {
            const duplicatedBlocks = util.thread.target.blocks.duplicate();
            spriteTarget.blocks._blocks = Object.assign(spriteTarget.blocks._blocks, duplicatedBlocks._blocks);
            // Set "When tests started" block that was copied to spriteTarget lopLevel field to false
            // to avoid accidental execution and make it invisible to the user.
            spriteTarget.blocks._blocks[util.thread.topBlock].topLevel = false;
            this.testCodeInjected.push(args.SPRITE);
        }

        // If we have not injected the event_whenbroadcastreceived block with the corresponding following blocks
        // into the target sprite yet, inject it and save the broadcast message.
        // This is done the first time for every withSpriteDo block that is executed in the test thread.
        if (!this.withSpriteDoBlockToBroadcastMessage[currentBlockId]) {
            const {whenBroadcastReceivedId, message} =
                this._createWhenBroadcastReceivedBlock(spriteTarget.blocks, firstBranchBlockId);
            // save message that needs to be broadcast to execute the injected blocks
            this.withSpriteDoBlockToBroadcastMessage[currentBlockId] = message;
            // save id of the event_whenbroadcastreceived block that corresponds to the withSpriteDo block
            this.withSpriteDoBlockToBroadcastId[currentBlockId] = whenBroadcastReceivedId;
        }

        // The remaining code is for starting the thread that waits for the broadcast message.
        // and waiting until it is done.

        // Have we run before, starting threads?
        if (!util.stackFrame.startedThreads) {
            // No - start hats for this broadcast.
            // We add and delete the whenbroadcastreceived script to avoid it being shown to the user.
            spriteTarget.blocks._addScript(this.withSpriteDoBlockToBroadcastId[currentBlockId]);
            spriteTarget.blocks.resetCache();

            util.stackFrame.startedThreads = util.startHats(
                'event_whenbroadcastreceived', {
                    BROADCAST_OPTION: this.withSpriteDoBlockToBroadcastMessage[currentBlockId]
                }
            );

            spriteTarget.blocks._deleteScript(this.withSpriteDoBlockToBroadcastId[currentBlockId]);
            spriteTarget.blocks.resetCache();

            if (util.stackFrame.startedThreads.length === 0) {
                // Nothing was started.
                return;
            }
        }

        // We've run before; check if the wait is still going on.
        const instance = this;
        // Scratch 2 considers threads to be waiting if they are still in
        // runtime.threads. Threads that have run all their blocks, or are
        // marked done but still in runtime.threads are still considered to
        // be waiting.
        const waiting = util.stackFrame.startedThreads
            .some(thread => instance.runtime.threads.indexOf(thread) !== -1);
        if (waiting) {
            // If all threads are waiting for the next tick or later yield
            // for a tick as well. Otherwise yield until the next loop of
            // the threads.
            if (
                util.stackFrame.startedThreads
                    .every(thread => instance.runtime.isWaitingThread(thread))
            ) {
                util.yieldTick();
            } else {
                util.yield();
            }
        }
    }

    /**
     * Implement pressKey.
     * @param {object} args - the block's arguments.
     */
    pressKey (args) {
        this.runtime.startHats('event_whenkeypressed', {
            KEY_OPTION: args.KEY
        });
        this.runtime.startHats('event_whenkeypressed', {
            KEY_OPTION: 'any'
        });
    }

    /**
     * Implement pressKeyAndWait.
     * @param {object} args - the block's arguments.
     * @param {BlockUtility} util - the util.
     */
    pressKeyAndWait (args, util) {
        // Have we run before, starting threads?
        if (!util.stackFrame.startedThreads) {
            // No - start hats for this broadcast.

            const specificKeyThreads = util.startHats('event_whenkeypressed', {
                KEY_OPTION: args.KEY
            });
            const anyKeyThreads = util.startHats('event_whenkeypressed', {
                KEY_OPTION: 'any'
            });
            util.stackFrame.startedThreads = specificKeyThreads.concat(anyKeyThreads);

            if (util.stackFrame.startedThreads.length === 0) {
                // Nothing was started.
                return;
            }
        }
        // We've run before; check if the wait is still going on.
        const instance = this;
        // Scratch 2 considers threads to be waiting if they are still in
        // runtime.threads. Threads that have run all their blocks, or are
        // marked done but still in runtime.threads are still considered to
        // be waiting.
        const waiting = util.stackFrame.startedThreads
            .some(thread => instance.runtime.threads.indexOf(thread) !== -1);
        if (waiting) {
            // If all threads are waiting for the next tick or later yield
            // for a tick as well. Otherwise yield until the next loop of
            // the threads.
            if (
                util.stackFrame.startedThreads
                    .every(thread => instance.runtime.isWaitingThread(thread))
            ) {
                util.yieldTick();
            } else {
                util.yield();
            }
        }
    }

    /**
     * Implement pressGreenFlag.
     */
    // TODO: make an sync version that can test something after the green flag thread is done running (to check state
    //  when program is done)
    pressGreenFlag () {
        this.runtime.startHats('event_whenflagclicked');
    }

    /**
     * Implement moveMouseTo.
     * @param {object} args - the block's arguments.
     * @param {BlockUtility} util - the util.
     */
    moveMouseTo (args, util) {
        const clickData = {};
        // we convert from scratch coordinates to client coordinates to make the simulation as real as possible when
        // received by the postData function of the Mouse class.
        // this postData function then converts these client coordinates back to canvas coordinates.
        clickData.canvasWidth = util.runtime.renderer.canvas.width;
        clickData.canvasHeight = util.runtime.renderer.canvas.height;
        clickData.x = ((args.X + 240) * clickData.canvasWidth) / 480;
        clickData.y = ((args.Y - 180) * clickData.canvasHeight) / -360;
        util.runtime.ioDevices.mouse.postData(clickData);
    }

    /**
     * Implement queryState variable.
     * @param {object} args - the block's arguments.
     * @returns {string} value of the queried field
     */
    queryState (args) {
        if (!args.STATE) return '';
        const savedState = JSON.parse(args.STATE);
        const sprite = savedState.find(target => target.name === args.OBJECT);
        if (sprite) {
            return this._getAttributeOf(sprite, args.PROPERTY);
        }
        return '';
    }

    /**
     * Implement snapshot variable.
     * @returns {string} string of a json that contains the runtime
     */
    snapshot () {
        return this._stringifyTargets(this.runtime.targets);
    }
}

module.exports = Scratch3ItchBlocks;
