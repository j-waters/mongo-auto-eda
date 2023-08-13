import { afterEach, expect } from "vitest";
import { resolveTarget } from "../src/common";
import { registry } from "../src/registry";

afterEach(() => {
    registry.consumers = [];
    registry.jobs = [];
    registry.reprocessHandlers = [];
});

expect.extend({
    instance(received, expected) {
        const { isNot, equals, utils } = this;
        const receivedObj = { ...received };
        const expectedObj = { ...expected };

        const pass = equals(receivedObj, expectedObj);

        if (!isNot && !pass) {
            console.log(
                "Instance inequality:\n",
                utils.diff(expectedObj, receivedObj),
            );
        }

        return {
            pass,
            message: () =>
                `${receivedObj} ${
                    isNot ? "doesn't equal" : "equals"
                } ${expectedObj}`,
            actual: receivedObj,
            expected: expectedObj,
        };
    },
    returns(received, expected) {
        const { isNot, equals, utils } = this;
        const receivedVal = received();

        const pass = equals(expected, receivedVal);

        if (!isNot && !pass) {
            console.log(
                "Return value inequality:\n",
                utils.diff(receivedVal, expected),
            );
        }

        return {
            pass,
            message: () =>
                `${receivedVal} ${
                    isNot ? "doesn't equal" : "equals"
                } ${expected}`,
            actual: receivedVal,
            expected,
        };
    },
    target(received, expected) {
        const { isNot, equals, utils } = this;
        const receivedObj = resolveTarget(received);
        const expectedObj = resolveTarget(expected);

        const pass = equals(expectedObj, receivedObj);

        if (!isNot && !pass) {
            console.log(
                "Target inequality:\n",
                utils.diff(receivedObj, expectedObj),
            );
        }

        return {
            pass,
            message: () =>
                `target ${receivedObj} ${
                    isNot ? "doesn't equal" : "equals"
                } ${expectedObj}`,
            actual: receivedObj,
            expected: expectedObj,
        };
    },
});
