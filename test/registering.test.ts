import { describe, expect, it } from "vitest";
import type { ObjectId } from "mongodb";
import { Consumer, Job, JobExpectedChange, JobTrigger, addJob } from "../src";
import { registry } from "../src/registry";
import { RegisteredJob } from "../src/entities/RegisteredJob";
import { RegisteredConsumer } from "../src/entities/RegisteredConsumer";

class TestTargetA {
    _id!: ObjectId;
}
class TestTargetB {
    _id!: ObjectId;
}

class TestTargetC {
    _id!: ObjectId;
}

describe("consumer", () => {
    it("registers consumer", () => {
        @Consumer({ target: () => TestTargetA })
        class Test {}

        expect(registry.consumers).toEqual([
            expect.instance(
                new RegisteredConsumer(expect.instance(Test), {
                    target: expect.target(TestTargetA),
                }),
            ),
        ]);
    });

    it("registers job", () => {
        @Consumer({ target: () => TestTargetA })
        class TestConsumer {
            @Job()
            @JobTrigger(["own1"])
            @JobTrigger({ onRemove: true })
            @JobTrigger(TestTargetB, () => {})
            @JobTrigger(TestTargetC, { onRemove: true, transformer() {} })
            @JobExpectedChange(["own2"])
            @JobExpectedChange({ removes: true })
            @JobExpectedChange(TestTargetB)
            @JobExpectedChange(TestTargetC, { removes: true })
            testJob() {}
        }

        const instance = new TestConsumer();

        const expectedJob = new RegisteredJob(
            instance.testJob,
            {},
            "testJob",
            expect.instance(TestConsumer),
        );

        expectedJob.consumer = new RegisteredConsumer(
            expect.instance(TestConsumer),
            {
                target: TestTargetA,
            },
        );
        expectedJob.consumer.instance = new WeakRef(instance);

        // TODO: fix this test.
        // I was adding the transformer feature to triggers
        expectedJob.addTriggers(
            {
                target: TestTargetC,
                onRemove: true,
                transformer: expect.any(Function),
            },
            {
                target: TestTargetB,
                onCreate: true,
                onUpdate: true,
                onRemove: true,
                transformer: expect.any(Function),
            },
            {
                target: TestTargetA,
                onCreate: true,
                onUpdate: ["own1"],
                onRemove: true,
            },
        );

        expect(registry.jobs[0].triggerMap).toEqual(expectedJob.triggerMap);

        expectedJob.addExpectedChange(
            {
                target: TestTargetC,
                removes: true,
            },
            {
                target: TestTargetB,
                creates: true,
                updates: true,
                removes: true,
            },
            {
                removes: true,
                updates: ["own2"],
            },
        );

        expect(registry.jobs[0].willChangeMap).toEqual(
            expectedJob.willChangeMap,
        );

        expectedJob.consumer!.options.target = expect.target(
            expectedJob.consumer!.options.target,
        );
        expectedJob.consumer = expect.instance(expectedJob.consumer);

        expect(registry.jobs).toEqual([expect.instance(expectedJob)]);
        expect(registry.jobs[0].target).toEqual(expect.target(TestTargetA));
        expect(registry.jobs[0].name).toEqual(
            "TestConsumer<TestTargetA>.testJob",
        );
    });
});

describe("standalone function", () => {
    it("registers", () => {
        function Test() {}

        const anon = () => {};

        addJob(Test, { target: () => TestTargetA });
        addJob("anonJob", anon, { target: () => TestTargetA });

        expect(() => addJob(() => {}, {})).toThrowError(/has no name/);
        expect(() => addJob("anonJob", anon, {})).toThrowError(
            /duplicate name/,
        );

        const expectedJobs = [
            expect.instance(
                new RegisteredJob(Test, {
                    target: expect.target(TestTargetA),
                }),
            ),
            expect.instance(
                new RegisteredJob(
                    anon,
                    { target: expect.target(TestTargetA) },
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

expect(registry.getJobsForTarget(TestTargetA)).toEqual(expectedJobs);
expect(registry.getOnCreatedJobs(TestTargetA)).toEqual(expectedJobs);
expect(registry.getOnChangedJobs(TestTargetA, ["prop", "foo"])).toEqual([
    expectedJobs[1],
    expectedJobs[2],
]);
 */
