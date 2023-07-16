import { beforeEach, describe, expect, it } from "vitest";
import { Consumer, Job, addJob } from "../src/index";
import { registry } from "../src/registry";
import { RegisteredJob } from "../src/entities/RegisteredJob";
import { RegisteredConsumer } from "../src/entities/RegisteredConsumer";

beforeEach(() => {
    registry.consumers = [];
    registry.jobs = [];
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
                utils.diff(receivedObj, expectedObj),
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

        const pass = equals(receivedVal, expected);

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
});

class TestTarget {}

describe("consumer", () => {
    it("registers consumer", () => {
        @Consumer({ target: () => TestTarget })
        class Test {}

        expect(registry.consumers).toEqual([
            expect.instance(
                new RegisteredConsumer(Test, {
                    target: expect.returns(TestTarget),
                }),
            ),
        ]);
    });

    it("registers job", () => {
        @Consumer({ target: () => TestTarget })
        class TestConsumer {
            @Job({ onChanged: ["prop"] })
            testJob() {}
        }

        const expectedJob = new RegisteredJob(
            new TestConsumer().testJob,
            { onChanged: ["prop"] },
            "testJob",
            TestConsumer,
        );

        expect(registry.jobs).toEqual([expect.instance(expectedJob)]);

        expect(expectedJob.name).toEqual("TestConsumer<TestTarget>.testJob");
    });
});

describe("standalone function", () => {
    it("registers", () => {
        function Test() {}

        const anon = () => {};

        addJob(Test, { onChanged: ["prop"], target: () => TestTarget });
        addJob("anonJob", anon, { target: () => TestTarget });

        expect(() => addJob(() => {}, {})).toThrowError(/has no name/);
        expect(() => addJob("anonJob", anon, {})).toThrowError(
            /duplicate name/,
        );

        const expectedJobs = [
            expect.instance(
                new RegisteredJob(Test, {
                    onChanged: ["prop"],
                    target: expect.returns(TestTarget),
                }),
            ),
            expect.instance(
                new RegisteredJob(
                    anon,
                    { target: expect.returns(TestTarget) },
                    "anonJob",
                ),
            ),
        ];

        expect(registry.jobs).toEqual(expectedJobs);
        expect(registry.jobs.map((j) => j.name)).toEqual(["Test", "anonJob"]);
    });
});

// eventual tests for getting the correct jobs:
/*
const expectedJobs = [
            expect.instance(
                new RegisteredJob(
                    new TestConsumer().onCreate,
                    {},
                    "onCreate",
                    TestConsumer,
                ),
            ),
            expect.instance(
                new RegisteredJob(
                    new TestConsumer().onChange,
                    { onChanged: true },
                    "onChange",
                    TestConsumer,
                ),
            ),
            expect.instance(
                new RegisteredJob(
                    new TestConsumer().onChangeProp,
                    { onChanged: ["prop"] },
                    "onChangeProp",
                    TestConsumer,
                ),
            ),
        ];

expect(registry.getJobsForTarget(TestTarget)).toEqual(expectedJobs);
expect(registry.getOnCreatedJobs(TestTarget)).toEqual(expectedJobs);
expect(registry.getOnChangedJobs(TestTarget, ["prop", "foo"])).toEqual([
    expectedJobs[1],
    expectedJobs[2],
]);
 */
