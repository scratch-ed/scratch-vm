// Core, Team, and Official extensions can `require` VM code:
const ArgumentType = require('../../extension-support/argument-type');
const BlockType = require('../../extension-support/block-type');
const uid = require('../../util/uid.js');
// const TargetType = require('../../extension-support/target-type');

// ...or VM dependencies:
const formatMessage = require('format-message');

const TreeNode = require('./FeedbackTree');

const Variable = require('../../engine/variable');

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
    'volume',
    'saying',
    'thinking'
];
// a state should also add the variables defined there (see blocks.js in the gui line 230)

const greenFlagIcon = require('./images/icon--green-flag.svg');
const redFlagIcon = require('./images/icon--red-flag.svg');
const observeBlockIcon = require('./images/icon--eye.svg');
const interactBlockIcon = require('./images/icon--finger-click.svg');
const feedbackBlockIcon = require('./images/icon--text.svg');
const injecterBlockIcon = require('./images/icon--square-arrow.svg');

const Scratch3LooksBlocks = require('../../blocks/scratch3_looks');

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

            // first time running, count blocks per sprite to later ensure all injected blocks were cleaned up
            if (!this.spriteIdToPreInjectionBlockCount) {
                this.spriteIdToPreInjectionBlockCount = {};
                for (const target of this.runtime.targets) {
                    this.spriteIdToPreInjectionBlockCount[target.id] = Object.keys(target.blocks._blocks).length;
                }
            }

            // (re)initialise the feedback tree
            this.runtime.feedbackTrees[startedThreads[0].topBlock] = new TreeNode(0, 'rootGroup');

            this._undoInjection(startedThreads[0].topBlock);
            this._clearDataStructures();
        });

        this.questions = [];
        this.runtime.on('QUESTION', question => {
            this.questions.push(question);
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
        // injecter block id -> injected sprite id -> broadcast message
        this.injecterBlockIdToInjectedSpriteIdToBroadcastMessage = {};
        // injecter block id -> injected sprite id -> event_whenbroadcastreceived block id
        this.injecterBlockIdToInjectedSpriteIdToBroadcastId = {};
        // Ids of the boolean conditions that are already injected
        // boolean condition block id -> injected sprite id -> result of boolean condition
        this.injectedBooleanBlockIdToInjectedSpriteIdToBooleanBlockResult = {};
        // list of asked questions that have not been answered,
        // when the answer block is used it will answer the oldest unanswered question (the first in the list)
        this.questions = [];
    }

    /**
     * Undo the injection of the test code and broadcast blocks.
     * @param {string} testThreadTopBlock ID of the top block (when tests started) of the test thread.
     * @private
     */
    _undoInjection (testThreadTopBlock) {
        // If datastructures are not initialized yet, there is nothing to clean.
        if (!this.testCodeInjected ||
            !this.injecterBlockIdToInjectedSpriteIdToBroadcastId ||
            !this.injecterBlockIdToInjectedSpriteIdToBroadcastMessage ||
            !this.injectedBooleanBlockIdToInjectedSpriteIdToBooleanBlockResult ||
            !this.spriteIdToPreInjectionBlockCount) {
            return;
        }

        // We clean up the injected blocks of the previous execution
        // At the moment this seems to be the best way to do this, but it is not very clean since the injected blocks
        // of the last execution are not deleted.
        for (const spriteName of this.testCodeInjected) {
            const sprite = this.runtime.getSpriteTargetByName(spriteName);
            // Delete injected test code
            if (sprite) sprite.blocks.deleteBlock(testThreadTopBlock);
        }

        // Delete injected broadcast blocks
        for (const spriteNameToBroadcastId of Object.values(this.injecterBlockIdToInjectedSpriteIdToBroadcastId)) {
            for (const id of Object.keys(spriteNameToBroadcastId)) {
                const sprite = this.runtime.getTargetById(id);
                if (sprite) sprite.blocks.deleteBlock(spriteNameToBroadcastId[id]);
            }
        }
        // check if injection cleanup was done correctly
        this._checkCorrectCleanup();
    }

    /**
     * Check if undoing the injection of the test code and broadcast blocks was correctly done.
     * @private
     */
    _checkCorrectCleanup () {
        for (const targetId of Object.keys(this.spriteIdToPreInjectionBlockCount)) {
            const target = this.runtime.getTargetById(targetId);
            if (!target) {
                // target was deleted
                delete this.spriteIdToPreInjectionBlockCount[targetId];
                continue;
            }
            const initialBlockCount = this.spriteIdToPreInjectionBlockCount[target.id];
            const currentBlockCount = Object.keys(target.blocks._blocks).length;
            if (initialBlockCount < currentBlockCount) {
                this.spriteIdToPreInjectionBlockCount[target.id] = currentBlockCount;
                // eslint-disable-next-line max-len,no-console
                console.warn(`Blocks injected into target ${target.getName()} possibly not cleaned up correctly: initial block count was ${initialBlockCount} while block count after cleanup is ${currentBlockCount}, this could mean not all injected blocks were cleaned up!`);
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
            color1: '#d8181b',
            color2: '#ad1316',

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
                    opcode: 'startTests',
                    blockType: BlockType.EVENT,
                    isEdgeActivated: false, // undocumented option that is used on line 1234 of src/engine/runtime.js
                    // if test flag is clicked, restart the test thread if already running
                    shouldRestartExistingThreads: true,
                    text: formatMessage({
                        id: 'startTestsLabel',
                        default: 'when [IMAGE] clicked',
                        description: 'Label on the "Test flag clicked" block'
                    }),
                    arguments: {
                        IMAGE: {
                            type: ArgumentType.IMAGE,
                            dataURI: redFlagIcon
                        }
                    }
                },
                {
                    opcode: 'namedAssert',
                    blockIconURI: feedbackBlockIcon,
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'namedAssertLabel',
                        default: 'assert [ASSERT_CONDITION] named [NAME]',
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
                    opcode: 'waitUntilOrStop',
                    blockIconURI: feedbackBlockIcon,
                    blockType: BlockType.COMMAND,
                    text: 'wait until [CONDITION] or [SECONDS] seconds. feedback: [FEEDBACK]',
                    arguments: {
                        CONDITION: {
                            type: ArgumentType.BOOLEAN,
                            defaultValue: false
                        },
                        SECONDS: {
                            type: ArgumentType.STRING,
                            defaultValue: '5'
                        },
                        FEEDBACK: {
                            type: ArgumentType.STRING,
                            defaultValue: ' '
                        }
                    }
                },
                {
                    opcode: 'groupName',
                    blockIconURI: feedbackBlockIcon,
                    blockType: BlockType.CONDITIONAL,
                    branchCount: 1,
                    text: 'test group [GROUP_NAME]',
                    arguments: {
                        GROUP_NAME: {
                            type: ArgumentType.STRING,
                            defaultValue: ' '
                        }
                    }
                },
                {
                    opcode: 'pressGreenFlag', // final opcode: itch_pressGreenFlag
                    blockIconURI: interactBlockIcon,
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'pressGreenFlagLabel',
                        default: 'click [IMAGE]',
                        description: 'Label on the "pressGreenFlag" block'
                    }),
                    arguments: {
                        IMAGE: {
                            type: ArgumentType.IMAGE,
                            dataURI: greenFlagIcon
                        }
                    }
                },
                {
                    opcode: 'pressKey',
                    blockIconURI: interactBlockIcon,
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'pressKeyLabel',
                        default: 'press [KEY] key',
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
                    blockIconURI: interactBlockIcon,
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'pressKeyAndWaitLabel',
                        default: 'press [KEY] key and wait',
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
                    opcode: 'clickSprite',
                    blockIconURI: interactBlockIcon,
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'clickSpriteLabel',
                        default: 'click [SPRITE]',
                        description: 'Label on the "clickSprite" block'
                    }),
                    arguments: {
                        SPRITE: {
                            type: ArgumentType.STRING,
                            menu: 'spritesReplaceable'
                        }
                    }
                },
                {
                    opcode: 'clickSpriteAndWait',
                    blockIconURI: interactBlockIcon,
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'clickSpriteAndWaitLabel',
                        default: 'click [SPRITE] and wait',
                        description: 'Label on the "clickSpriteAndWait" block'
                    }),
                    arguments: {
                        SPRITE: {
                            type: ArgumentType.STRING,
                            menu: 'spritesReplaceable'
                        }
                    }
                },
                {
                    opcode: 'moveMouseTo', // becomes 'itch_movemouseto'
                    blockIconURI: interactBlockIcon,
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'moveMouseToXY',
                        default: 'move mouse to x: [X] y: [Y]',
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
                {
                    opcode: 'answer',
                    blockIconURI: interactBlockIcon,
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'answerLabel',
                        default: 'answer [ANSWER]',
                        description: 'Label on the "answer" block'
                    }),
                    arguments: {
                        ANSWER: {
                            type: ArgumentType.STRING,
                            defaultValue: ' '
                        }
                    }
                },
                {
                    opcode: 'snapshot',
                    blockIconURI: observeBlockIcon,
                    blockType: BlockType.REPORTER,
                    text: formatMessage({
                        id: 'snapshot',
                        default: 'snapshot',
                        description: 'Label on the "snapshot" variable'
                    }),
                    arguments: {}
                },
                { // TODO: change name to querySnapshot
                    opcode: 'queryState',
                    blockIconURI: observeBlockIcon,
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
                    opcode: 'spriteFilter',
                    blockIconURI: injecterBlockIcon,
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'spriteFilterLabel',
                        default: 'add sprites to [SELECTED_LIST] where [CONDITION]',
                        description: 'Label on the "spriteFilter" block'
                    }),
                    arguments: {
                        SELECTED_LIST: {
                            type: ArgumentType.STRING,
                            menu: 'lists'
                        },
                        CONDITION: {
                            type: ArgumentType.BOOLEAN
                        }
                    }
                },
                {
                    opcode: 'forSpriteDo',
                    blockIconURI: injecterBlockIcon,
                    blockType: BlockType.CONDITIONAL,
                    branchCount: 1,
                    text: 'with [SPRITE] do',
                    arguments: {
                        SPRITE: {
                            type: ArgumentType.STRING,
                            menu: 'spritesReplaceable'
                        }
                    }
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
                spritesReplaceable: {
                    // This flag makes a "droppable" menu: the menu will allow dropping a reporter in for the input.
                    acceptReporters: true,

                    // The `item` property may be an array or function name as in previous menu examples.
                    items: '_getSpritesList'
                },
                properties: {
                    // This flag makes a "droppable" menu: the menu will allow dropping a reporter in for the input.
                    acceptReporters: false,

                    // The `item` property may be an array or function name as in previous menu examples.
                    items: '_getPropertiesList'
                },
                lists: {
                    acceptReporters: false,
                    items: '_getListsList'
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

    /**
     * _getSpritesList.
     * @returns {string[]} List of names of the targets
     */
    _getSpritesList () {
        // todo: make complex list elements
        return this.runtime.targets.map(target => target.getName());
    }

    _getPropertiesList () {
        // todo: different options when the selected sprite is the stage
        // use: targetId is passed to this function when called
        return spriteProperties;
    }

    _getListsList (targetId) {
        // wrong value is passed to block using this menu!
        const target = this.runtime.getTargetById(targetId);
        if (!target) return ['choose a list'];
        const list = target.getAllVariableNamesInScopeByType(Variable.LIST_TYPE, false);
        return list.length ? list : ['choose a list'];
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
                const bubbleState = target.getCustomState(Scratch3LooksBlocks.STATE_KEY);
                if (bubbleState) {
                    spriteJson.saying = bubbleState.type === 'say' ? bubbleState.text : '';
                    spriteJson.thinking = bubbleState.type === 'think' ? bubbleState.text : '';
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
            case 'x position': return target['x position'];
            case 'y position': return target['y position'];
            case 'direction': return target.direction;
            case 'costume #': return target['costume #'];
            case 'costume name': return target['costume name'];
            case 'size': return target.size;
            case 'volume': return target.volume;
            case 'saying': return target.saying ? target.saying : '';
            case 'thinking': return target.thinking ? target.thinking : '';
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
     * Remove the current block from between its parent and its next block. Don't delete it.
     * Slicing blocks cleanly (changing parent and next to point to each other)
     * is important for block injection cleanup since those pointers are used.
     * @param {Target!} target - the target that the block is in.
     * @param {string!} blockId - the id of the block to remove.
     * @private
     */
    _sliceBlock (target, blockId) {
        const injectedSpriteFilterBlock = target.blocks.getBlock(blockId);
        const injectedSpriteFilterBlockParent = target.blocks.getBlock(injectedSpriteFilterBlock.parent);
        const injectedSpriteFilterBlockNext = target.blocks.getBlock(injectedSpriteFilterBlock.next);

        // if block has parent block and next block, change next field of parent block and parent field of next block.
        if (injectedSpriteFilterBlockParent && injectedSpriteFilterBlockNext) {
            injectedSpriteFilterBlockParent.next = injectedSpriteFilterBlockNext.id;
            injectedSpriteFilterBlockNext.parent = injectedSpriteFilterBlockParent.id;
        } else if (injectedSpriteFilterBlockParent) {
            delete injectedSpriteFilterBlockParent.next;
        } else if (injectedSpriteFilterBlockNext) {
            delete injectedSpriteFilterBlockNext.parent;
        }
        // remove references to parent and next block
        delete injectedSpriteFilterBlock.parent;
        delete injectedSpriteFilterBlock.next;
    }

    /**
     * Helper function that handles waiting on started threads
     * @param {BlockUtility!} util - the util.
     * @returns {boolean} - true if still waiting on threads, false if done waiting.
     * @private
     */
    _waitForStartedThreads (util) {
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
            return true;
        }
        return false;
    }

    /**
     * Inject all code of util.target into spriteToInject (usually this is to inject all testcode).
     * @param {BlockUtility!} util - the block utility object.µ
     * @param {string!} spriteToInjectId - the sprite to inject the code into.
     * @private
     */
    _injectAllCodeIfNeeded (util, spriteToInjectId) {
        const spriteToInject = this.runtime.getTargetById(spriteToInjectId);
        if (!this.testCodeInjected.includes(spriteToInject.getName())) {
            const duplicatedBlocks = util.thread.target.blocks.duplicate();
            spriteToInject.blocks._blocks = Object.assign(spriteToInject.blocks._blocks, duplicatedBlocks._blocks);
            // Set "When tests started" block that was copied to spriteTarget lopLevel field to false
            // to avoid accidental execution and make it invisible to the user.
            spriteToInject.blocks._blocks[util.thread.topBlock].topLevel = false;
            this.testCodeInjected.push(spriteToInject.getName());
        }
    }

    /**
     * Check if the broadcast received block and its following blocks are present in the spriteToInject.
     * @param {BlockUtility!} util - the block utility object.
     * @param {string!} spriteToInjectId - id of the sprite to check if the broadcast received block is present in.
     * @param {string!} injecterBlockId - an id of an injecter block used to retrieve information about
     *      the corresponding injected event_whenbroadcastreceived blocks.
     * @returns {boolean} - true if broadcast thread is present, false otherwise.
     * @private
     */
    _broadcastReceivedBlockIsPresent (util, spriteToInjectId, injecterBlockId) {
        const spriteToInject = this.runtime.getTargetById(spriteToInjectId);
        if (!this.injecterBlockIdToInjectedSpriteIdToBroadcastMessage[injecterBlockId]) {
            this.injecterBlockIdToInjectedSpriteIdToBroadcastMessage[injecterBlockId] = {};
        }
        return this.injecterBlockIdToInjectedSpriteIdToBroadcastMessage[injecterBlockId][spriteToInject.id] !==
            undefined;
    }

    /**
     * Inject a broadcast received block and its following blocks into the spriteToInject.
     * @param {BlockUtility!} util - the block utility object.
     * @param {string!} spriteToInjectId - id of the sprite to check if the broadcast received block is present in.
     * @param {string!} injecterBlockId - an id of an injecter block used to retrieve information about
     *      the corresponding injected event_whenbroadcastreceived blocks.
     * @param {string!} broadcastNextBlockId -
     *      the id of the block that comes right after the event_whenbroadcastreceived block.
     * @param {string?} possiblyPresetBroadcastMessage - broadcast message of the event_whenbroadcastreceived block.
     * @private
     */
    _injectBroadcastThread (util, spriteToInjectId, injecterBlockId, broadcastNextBlockId, possiblyPresetBroadcastMessage) {
        if (!this.injecterBlockIdToInjectedSpriteIdToBroadcastId[injecterBlockId]) {
            this.injecterBlockIdToInjectedSpriteIdToBroadcastId[injecterBlockId] = {};
        }
        const spriteToInject = this.runtime.getTargetById(spriteToInjectId);
        // always use the same broadcast message for the same spriteFilter block injection
        const {whenBroadcastReceivedId, broadcastMessage} = this._createWhenBroadcastReceivedBlock(
            spriteToInject.blocks, broadcastNextBlockId, possiblyPresetBroadcastMessage);
        // save message that needs to be broadcast to execute the injected blocks
        this.injecterBlockIdToInjectedSpriteIdToBroadcastMessage[injecterBlockId][spriteToInject.id] =
            broadcastMessage;
        // save id of the event_whenbroadcastreceived block that corresponds to the spriteFilter block
        this.injecterBlockIdToInjectedSpriteIdToBroadcastId[injecterBlockId][spriteToInject.id] =
            whenBroadcastReceivedId;
    }

    /**
     * Adds a when broadcast received block to the given blocks.
     * @param {Blocks!} blocks - a blocks object of a sprite.
     * @param {string!} nextId - id of the block underneath the broadcast block.
     * @param {string?} broadcastMessage - possible broadcast message, if given, do not generate unique one.
     * @returns {{whenBroadcastReceivedId: string, broadcastMessage: string}} - the id of the broadcast received block
     *      and the message its waits for.
     * @private
     */
    _createWhenBroadcastReceivedBlock (blocks, nextId, broadcastMessage) {
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
        if (!broadcastMessage) broadcastMessage = uid();
        const whenBroadcastReceivedId = uid();
        const blockJson = {
            id: whenBroadcastReceivedId,
            opcode: 'event_whenbroadcastreceived',
            inputs: {},
            fields: {
                BROADCAST_OPTION: {
                    name: 'BROADCAST_OPTION',
                    id: uid(),
                    value: broadcastMessage,
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
        return {whenBroadcastReceivedId: whenBroadcastReceivedId, broadcastMessage: broadcastMessage};
    }

    /**
     * Start all injected threads with message broadcastMessage
     * @param {BlockUtility!} util - the block utility object.
     * @param {[Target]!} sprites - the sprites to add and remove hidden broadcast threads in.
     * @param {string!} injecterBlockId - the id of the block that injected the broadcast threads.
     * @param {string!} broadcastMessage - the message to broadcast.
     * @private
     */
    _runInjectedBroadcastThreadsIfNeeded (util, sprites, injecterBlockId, broadcastMessage) {
        // Have we started the injected broadcast blocks yet?
        if (!util.stackFrame.startedThreads) {
            // No - start hats for this broadcast.

            // We add and delete the event_whenbroadcastreceived scripts to avoid it being shown to the user.
            // Add them
            for (const spriteTarget of sprites) {
                spriteTarget.blocks._addScript(
                    this.injecterBlockIdToInjectedSpriteIdToBroadcastId[injecterBlockId][spriteTarget.id]
                );
                spriteTarget.blocks.resetCache();
            }

            // Start all broadcast threads with the same message
            util.stackFrame.startedThreads = util.startHats(
                'event_whenbroadcastreceived', {
                    BROADCAST_OPTION: broadcastMessage
                }
            );

            // Once started, delete them
            for (const spriteTarget of sprites) {
                spriteTarget.blocks._deleteScript(
                    this.injecterBlockIdToInjectedSpriteIdToBroadcastId[injecterBlockId][spriteTarget.id]
                );
                spriteTarget.blocks.resetCache();
            }
        }
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
     * Implement forSpriteDo.
     * @param {object} args - the block's arguments.
     * @param {BlockUtility} util - the util.
     */
    forSpriteDo (args, util) {
        // If the target sprite is the same as the sprite the test code is running in, don't do any injection,
        // just execute blocks.
        if (args.SPRITE === util.target.getName()) {
            util.startBranch(1, false);
        }

        const spriteTarget = this.runtime.getSpriteTargetByName(args.SPRITE);
        if (!spriteTarget) return;

        const firstBranchBlockId = util.thread.target.blocks.getBranch(this._getCurrentBlockId(util), 1);
        const currentBlockId = this._getCurrentBlockId(util);

        // no blocks to be injected and executed
        if (!firstBranchBlockId) return;

        // If we have not injected the testcode into the target sprite, inject it.
        // This is done the first time the first withSpriteDo block is executed in the test thread.
        // TODO: what about clones?
        this._injectAllCodeIfNeeded(util, spriteTarget.id);

        // If we have not injected the event_whenbroadcastreceived block with the corresponding following blocks
        // into the target sprite yet, inject it and save the broadcast message.
        // This is done the first time for every withSpriteDo block that is executed in the test thread.
        if (!this._broadcastReceivedBlockIsPresent(util, spriteTarget.id, currentBlockId)) {
            this._injectBroadcastThread(util, spriteTarget.id, currentBlockId, firstBranchBlockId);
        }

        // The remaining code is for starting the thread that waits for the broadcast message.
        // and waiting until it is done.

        this._runInjectedBroadcastThreadsIfNeeded(
            util,
            [spriteTarget],
            currentBlockId,
            this.injecterBlockIdToInjectedSpriteIdToBroadcastMessage[currentBlockId][spriteTarget.id]
        );

        this._waitForStartedThreads(util);
    }

    /**
     * Implement waitUntilOrStop.
     * @param {object} args - the block's arguments.
     * @param {BlockUtility} util - the util.
     */
    waitUntilOrStop (args, util) {
        // first time we execute this function, save the start time of the wait
        if (!util.stackFrame.startTime) {
            util.stackFrame.startTime = this.runtime.currentMSecs;
        }

        // time limit is reached, add feedback as failed feedback and stop the thread
        if (this.runtime.currentMSecs - util.stackFrame.startTime > args.SECONDS * 1000) {
            const tree = this._getCurrentFeedbackTree(util);
            // create a new node in the feedback tree and push it to the parseStack
            tree.getParseStack().push(tree.peekParseStack().insert(this._getCurrentBlockId(util), args.FEEDBACK));
            tree.peekParseStack().groupFailed();
            // a waitUntilOrStop is a leaf (has no children), so pop immediately from the parseStack
            tree.getParseStack().pop();

            // stop the thread because the wait until time limit was reached
            util.thread.stopThisScript();
            return;
        }

        if (args.CONDITION) {
            const tree = this._getCurrentFeedbackTree(util);
            // create a new node in the feedback tree and push it to the parseStack
            tree.getParseStack().push(tree.peekParseStack().insert(this._getCurrentBlockId(util), args.FEEDBACK));
            // a waitUntilOrStop is a leaf (has no children), so pop immediately from the parseStack
            tree.getParseStack().pop();
        } else {
            // We have waited before and are still waiting, so yield the thread.
            util.yieldTick();
        }
    }

    /**
     * Implement spriteFilter.
     * @param {object} args - the block's arguments.
     * @param {BlockUtility} util - the block utility object.
     */
    spriteFilter (args, util) {
        // make list of all sprite we need to check (isSprite is a property of RenderedTarget)
        const sprites = this.runtime.targets.filter(target => target.isSprite());
        // condition is undefined => all sprites are valid
        // eslint-disable-next-line no-undefined
        if (args.CONDITION === undefined) {
            util.target.lookupVariableByNameAndType(args.SELECTED_LIST, Variable.LIST_TYPE, false).value =
                sprites.map(sprite => sprite.getName());
            return;
        }

        const currentBlockId = this._getCurrentBlockId(util);
        const booleanStatementBlock = util.thread.target.blocks.getBlock(currentBlockId).inputs.CONDITION.block;

        if (Object.keys(this.injectedBooleanBlockIdToInjectedSpriteIdToBooleanBlockResult)
            .includes(booleanStatementBlock) && !util.stackFrame.inOriginalBlock) {
            // We are executing an injected block, thus all we need to do is save the result
            // of the condition for the sprite we are in.
            this.injectedBooleanBlockIdToInjectedSpriteIdToBooleanBlockResult[booleanStatementBlock][util.target.id] =
                args.CONDITION;
            return;
        }

        // From here on out the code in this function is always being executed in the original block.
        util.stackFrame.inOriginalBlock = true;

        if (!this.injectedBooleanBlockIdToInjectedSpriteIdToBooleanBlockResult[booleanStatementBlock]) {
            this.injectedBooleanBlockIdToInjectedSpriteIdToBooleanBlockResult[booleanStatementBlock] = {};
        }
        const broadcastMessage = uid();
        for (const spriteTarget of sprites) {
            if (spriteTarget.id === util.target.id) {
                // Dont inject into test sprite, just save condition result
                this.injectedBooleanBlockIdToInjectedSpriteIdToBooleanBlockResult[booleanStatementBlock][spriteTarget.id] =
                    args.CONDITION;
                continue;
            }
            // If we have not injected the testcode into the target sprite, inject it.
            // This is done the first time an injection block is executed in the test thread.
            // TODO: what about clones?
            // TODO: use target id, not name
            this._injectAllCodeIfNeeded(util, spriteTarget.id);

            // If we have not injected the event_whenbroadcastreceived block with the corresponding following block
            // into the target sprite yet, inject it and save the broadcast message.
            // This is done the first time for every spriteFilter block that is executed in the test thread.
            if (!this._broadcastReceivedBlockIsPresent(util, spriteTarget.id, currentBlockId)) {
                // Take the injected spriteFilter from the injected testcode,
                // so we can add the event_whenbroadcastreceived as its parent.
                this._sliceBlock(spriteTarget, currentBlockId);
                this._injectBroadcastThread(util, spriteTarget.id, currentBlockId, currentBlockId, broadcastMessage);
            }
        }

        // The remaining code is for starting the thread that waits for the broadcast message.
        // and waiting until it is done.

        this._runInjectedBroadcastThreadsIfNeeded(
            util,
            sprites.filter(sprite => sprite.id !== util.target.id),
            currentBlockId,
            // all broadcast messages are the same, so just take the first ones
            Object.values(this.injecterBlockIdToInjectedSpriteIdToBroadcastMessage[currentBlockId])[0]
        );

        // wait for started threads, when done waiting, use boolean condition results from all sprites to filter them
        if (!this._waitForStartedThreads(util)) {
            const list = util.target.lookupVariableByNameAndType(args.SELECTED_LIST, Variable.LIST_TYPE, false);
            sprites
                .filter(sprite =>
                    this.injectedBooleanBlockIdToInjectedSpriteIdToBooleanBlockResult[booleanStatementBlock][sprite.id])
                .forEach(sprite => list.value.push(sprite.getName()));
            list._monitorUpToDate = false;
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
        this._waitForStartedThreads(util);
    }

    /**
     * Implement clickSprite.
     * @param {object} args - the block's arguments.
     */
    clickSprite (args) {
        const clickTarget = this.runtime.getSpriteTargetByName(args.SPRITE);
        if (!clickTarget) {
            return;
        }
        this.runtime.startHats('event_whenthisspriteclicked', {}, clickTarget);
    }

    /**
     * Implement clickSpriteAndWait.
     * @param {object} args - the block's arguments.
     * @param {BlockUtility} util - the util.
     */
    clickSpriteAndWait (args, util) {
        // Have we run before, starting threads?
        if (!util.stackFrame.startedThreads) {
            // No - start hats for this broadcast.
            const clickTarget = this.runtime.getSpriteTargetByName(args.SPRITE);
            if (!clickTarget) {
                return;
            }

            util.stackFrame.startedThreads = util.startHats('event_whenthisspriteclicked', {}, clickTarget);

            if (util.stackFrame.startedThreads.length === 0) {
                // Nothing was started.
                return;
            }
        }
        this._waitForStartedThreads(util);
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

    /**
     * Implement answer.
     * @param {object} args - the block's arguments.
     * @param {BlockUtility} util - the util.
     */
    answer (args, util) {
        // if no questions are asked yet, wait for them to be asked
        if (this.questions.length === 0) {
            util.yieldTick();
        }
        // answer asked question
        this.runtime.emit('ANSWER', args.ANSWER);
        this.questions.shift();
        this.runtime.emitProjectChanged();
    }
}

module.exports = Scratch3ItchBlocks;
