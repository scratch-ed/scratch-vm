const Timer = require('../util/timer');
const Thread = require('./thread');
const execute = require('./execute.js');

/**
 * Profiler frame name for stepping a single thread.
 * @const {string}
 */
const stepThreadProfilerFrame = 'Sequencer.stepThread';

/**
 * Profiler frame name for the inner loop of stepThreads.
 * @const {string}
 */
const stepThreadsInnerProfilerFrame = 'Sequencer.stepThreads#inner';

/**
 * Profiler frame name for execute.
 * @const {string}
 */
const executeProfilerFrame = 'execute';

/**
 * Profiler frame ID for stepThreadProfilerFrame.
 * @type {number}
 */
let stepThreadProfilerId = -1;

/**
 * Profiler frame ID for stepThreadsInnerProfilerFrame.
 * @type {number}
 */
let stepThreadsInnerProfilerId = -1;

/**
 * Profiler frame ID for executeProfilerFrame.
 * @type {number}
 */
let executeProfilerId = -1;

class Sequencer {
    constructor (runtime) {
        /**
         * A utility timer for timing thread sequencing.
         * @type {!Timer}
         */
        this.timer = new Timer();

        /**
         * Reference to the runtime owning this sequencer.
         * @type {!Runtime}
         */
        this.runtime = runtime;

        this.activeThread = null;
    }

    /**
     * Time to run a warp-mode thread, in ms.
     * @type {number}
     */
    static get WARP_TIME () {
        return 10000;
    }

    round (threads, firstRoundInFrame) {
        if (this.runtime.profiler !== null) {
            if (stepThreadsInnerProfilerId === -1) {
                stepThreadsInnerProfilerId = this.runtime.profiler.idByName('round');
            }
            this.runtime.profiler.start(stepThreadsInnerProfilerId);
        }
        let executedThread = false;
        for (let i = 0; i < threads.length; i++) {
            // Set the active thread, used by runtime:stopAll().
            this.activeThread = threads[i];
            // Clear yield tick status from last frame
            if (this.activeThread.status === Thread.STATUS_YIELD_TICK && firstRoundInFrame) {
                this.activeThread.status = Thread.STATUS_RUNNING;
            }
            // Thread can do a turn!
            if (this.activeThread.status === Thread.STATUS_RUNNING || this.activeThread.status === Thread.STATUS_YIELD) {
                if (this.runtime.profiler !== null) {
                    if (stepThreadProfilerId === -1) {
                        stepThreadProfilerId = this.runtime.profiler.idByName('turn');
                    }
                    // Increment the number of times turn is called.
                    this.runtime.profiler.increment(stepThreadProfilerId);
                }
                executedThread |= this.turn(this.activeThread);
                // Reset warp timer for next round
                this.activeThread.warpTimer = null;
            }
            // If the active thread encountered a breakpoint, pause runtime and stop round
            if (this.runtime.pauseRequested) {
                this.runtime.pause();
                this.runtime.pauseRequested = false;
                break;
            }
        }
        if (this.runtime.profiler !== null) {
            this.runtime.profiler.stop();
        }
        // (Blink) If a thread was executed in this round, take a snapshot
        if (executedThread) {
            // TODO: only take snapshot when executedThreads are not just monitors!
            this.runtime.emit('THREADS_EXECUTED');
        }
        // Reset active thread
        this.activeThread = null;
        return executedThread;
    }

    isFinished (thread) {
        return thread.stack.length === 0 || thread.status === Thread.STATUS_DONE;
    }

    turn (thread, inWarp = false) {
        let currentBlockId = thread.peekStack();
        if (!currentBlockId) {
            // A "null block" - empty branch.
            thread.popStack();

            // Did the null follow a hat block?
            if (thread.stack.length === 0) {
                thread.status = Thread.STATUS_DONE;
                return false;
            }
            currentBlockId = thread.peekStack();
        }
        // Execute the current block.
        if (this.runtime.profiler !== null) {
            if (executeProfilerId === -1) {
                executeProfilerId = this.runtime.profiler.idByName(executeProfilerFrame);
            }

            // Increment the number of times execute is called.
            this.runtime.profiler.increment(executeProfilerId);
        }
        if (thread.target === null) {
            this.retireThread(thread);
        } else {
            execute(this, thread);
        }
        if (!inWarp) {
            thread.blockGlowInFrame = currentBlockId;
        }
        // If the thread has yielded or is waiting, yield to other threads.
        if (thread.status === Thread.STATUS_YIELD) {
            // Mark as running for next iteration.
            thread.status = Thread.STATUS_RUNNING;
            return false;
        } else if (thread.status === Thread.STATUS_PROMISE_WAIT) {
            // A promise was returned by the primitive. Yield the thread
            // until the promise resolves. Promise resolution should reset
            // thread.status to Thread.STATUS_RUNNING.
            return true;
        } else if (thread.status === Thread.STATUS_YIELD_TICK) {
            // round will reset the thread to Thread.STATUS_RUNNING
            return true;
        }

        // If no control flow has happened, switch to next block.
        if (thread.peekStack() === currentBlockId) {
            thread.goToNextBlock();
        }
        // If no next block has been found at this point, look on the stack.
        while (!thread.peekStack()) {
            thread.popStack();

            if (thread.stack.length === 0) {
                // No more stack to run!
                thread.status = Thread.STATUS_DONE;
                return true;
            }

            const stackFrame = thread.peekStackFrame();
            if (stackFrame.isLoop) {
                // Don't go to the next block for this level of the stack,
                // since loops need to be re-executed.
                continue;
            } else if (stackFrame.waitingReporter) {
                // This level of the stack was waiting for a value.
                // This means a reporter has just returned - so don't go
                // to the next block for this level of the stack.
                return true;
            }

            // Get next block of existing block on the stack.
            thread.goToNextBlock();
        }

        if (!inWarp && thread.peekStackFrame().warpMode) {
            if (!thread.warpTimer) {
                thread.warpTimer = new Timer();
                thread.warpTimer.start();
            }
            this.warpTurn(thread);
        }
        return true;
    }

    warpTurn (thread) {
        let pauseRequested = this.runtime.pauseRequested;
        while (!this.isFinished(thread) && !pauseRequested && thread.warpTimer.timeElapsed() < Sequencer.WARP_TIME) {
            this.turn(thread, true);
            pauseRequested = this.runtime.pauseRequested;
        }
    }

    /**
     * Step a thread into a block's branch.
     * @param {!Thread} thread Thread object to step to branch.
     * @param {number} branchNum Which branch to step to (i.e., 1, 2).
     * @param {boolean} isLoop Whether this block is a loop.
     */
    stepToBranch (thread, branchNum, isLoop) {
        if (!branchNum) {
            branchNum = 1;
        }
        const currentBlockId = thread.peekStack();
        const branchId = thread.target.blocks.getBranch(
            currentBlockId,
            branchNum
        );
        thread.peekStackFrame().isLoop = isLoop;
        if (branchId) {
            // Push branch ID to the thread's stack.
            thread.pushStack(branchId);
        } else {
            thread.pushStack(null);
        }
    }

    /**
     * Step a procedure.
     * @param {!Thread} thread Thread object to step to procedure.
     * @param {!string} procedureCode Procedure code of procedure to step to.
     */
    stepToProcedure (thread, procedureCode) {
        const definition = thread.target.blocks.getProcedureDefinition(procedureCode);
        if (!definition) {
            return;
        }
        // Check if the call is recursive.
        // If so, set the thread to yield after pushing.
        const isRecursive = thread.isRecursiveCall(procedureCode);
        // To step to a procedure, we put its definition on the stack.
        // Execution for the thread will proceed through the definition hat
        // and on to the main definition of the procedure.
        // When that set of blocks finishes executing, it will be popped
        // from the stack by the sequencer, returning control to the caller.
        thread.pushStack(definition);
        // In known warp-mode threads, only yield when time is up.
        if (thread.peekStackFrame().warpMode && thread.warpTimer.timeElapsed() > Sequencer.WARP_TIME) {
            thread.status = Thread.STATUS_YIELD;
        } else {
            // Look for warp-mode flag on definition, and set the thread
            // to warp-mode if needed.
            const definitionBlock = thread.target.blocks.getBlock(definition);
            const innerBlock = thread.target.blocks.getBlock(
                definitionBlock.inputs.custom_block.block);
            let doWarp = false;
            if (innerBlock && innerBlock.mutation) {
                const warp = innerBlock.mutation.warp;
                if (typeof warp === 'boolean') {
                    doWarp = warp;
                } else if (typeof warp === 'string') {
                    doWarp = JSON.parse(warp);
                }
            }
            if (doWarp) {
                thread.peekStackFrame().warpMode = true;
            } else if (isRecursive) {
                // In normal-mode threads, yield any time we have a recursive call.
                thread.status = Thread.STATUS_YIELD;
            }
        }
    }

    /**
     * Retire a thread in the middle, without considering further blocks.
     * @param {!Thread} thread Thread object to retire.
     */
    retireThread (thread) {
        thread.stack = [];
        thread.stackFrame = [];
        thread.requestScriptGlowInFrame = false;
        thread.status = Thread.STATUS_DONE;
    }
}

module.exports = Sequencer;
