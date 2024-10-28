const {v4} = require('uuid');

class TestGroup {
    constructor (parent, name, visibility) {
        this.parent = parent;
        this.children = [];
        this.name = name;
        this.visibility = visibility;
        this.summary = null;
        this.testsPassed = true;
        this.currentTestName = null;
        this.id = v4();
    }

    setSummary (summary) {
        this.summary = summary;
    }

    addGroup (name, visibility) {
        const group = new TestGroup(this, name, visibility);
        this.children.push(group);
        return group;
    }

    startTest (name) {
        this.currentTestName = name;
    }

    closeTest (status, feedback, marker) {
        const passed = status === 'correct';
        const test = {name: this.currentTestName, passed, feedback, marker, id: v4()};
        this.children.push(test);
        if (!passed) {
            this.groupFailed();
        }
        return test;
    }

    groupFailed () {
        this.testsPassed = false;
        if (this.parent) {
            this.parent.groupFailed();
        }
    }
}

class TestProcessor {
    constructor (onTestFinished) {
        this.onTestFinished = onTestFinished;
        this.markedTests = [];
        this.groups = [];
        /** @type {TestGroup} */
        this.currentGroup = null;
    }

    process (message) {
        /** @type {string} */
        const command = message.command;

        if (command === 'start-judgement') {
            this.groups = [];
            this.start = new Date();
        }

        if (command === 'close-judgement') {
            this.duration = new Date() - this.start;
            this.onTestFinished();
        }

        if (command === 'start-group') {
            let group;
            if (this.currentGroup === null) {
                group = new TestGroup(null, message.name, message.visibility === 'show');
                this.groups.push(group);
            } else {
                group = this.currentGroup.addGroup(message.name, message.visibility === 'show');
            }
            this.currentGroup = group;
        }

        if (command === 'close-group') {
            this.currentGroup.setSummary(message.summary);
            this.currentGroup = this.currentGroup.parent;
        }

        if (command === 'start-test') {
            this.currentGroup.startTest(message.name);
        }

        if (command === 'close-test') {
            const test = this.currentGroup.closeTest(message.status, message.feedback, message.marker);
            if (message.marker) {
                this.markedTests.push(test);
            }
        }
    }

    results () {
        return this.groups;
    }

    markers () {
        return this.markedTests;
    }

    clear () {
        this.groups = [];
    }
}

module.exports = {TestProcessor, TestGroup};
