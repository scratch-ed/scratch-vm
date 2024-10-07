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

    closeTest (status, feedback) {
        const passed = status === 'correct';
        this.children.push({name: this.currentTestName, passed, feedback, id: v4()});
        if (!passed) {
            this.groupFailed();
        }
    }

    groupFailed () {
        this.testsPassed = false;
        if (this.parent) {
            this.parent.groupFailed();
        }
    }
}

class TestProcessor {
    constructor () {
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
        }

        if (command === 'start-group') {
            let group;
            if (this.currentGroup === null) {
                group = new TestGroup(null, message.name, message.visibility);
                this.groups.push(group);
            } else {
                group = this.currentGroup.addGroup(message.name, message.visibility);
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
            this.currentGroup.closeTest(message.status, message.feedback);
        }
    }

    results () {
        return this.groups;
    }
}

module.exports = {TestProcessor, TestGroup};
