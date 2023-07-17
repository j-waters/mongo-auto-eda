import { describe, expect, it } from "vitest";
import type { ObjectId } from "mongodb";
import { RegisteredJob } from "../src/entities/RegisteredJob";
import type { JobNode } from "../src/graph";
import { JobGraph } from "../src/graph";

class TestTargetA {
    _id!: ObjectId;
}

class TestTargetB {
    _id!: ObjectId;
}

class TestTargetC {
    _id!: ObjectId;
}

class TestTargetD {
    _id!: ObjectId;
}

const emptyExpectation = {
    willTriggerSpecific: [],
    willTriggerAny: [],
    triggeredBySpecific: [],
    triggeredByAny: [],
};

describe("job", () => {
    it("can return a map of triggers", () => {
        const job = new RegisteredJob<TestTargetA>(() => {}, {
            target: TestTargetA,
        });

        job.addTriggers(
            { onUpdate: ["own1"] },
            { onUpdate: ["own2"] },
            { target: () => TestTargetA, onUpdate: ["own3"] },
            { target: TestTargetA, onUpdate: ["own4"] },
            { target: TestTargetB, onUpdate: ["other1", "other2"] },
            { target: TestTargetC, onUpdate: true },
            { target: TestTargetC, onUpdate: ["nope"] },
            { target: TestTargetC, onRemove: true },
        );

        const expectedMap = new Map();
        expectedMap.set(TestTargetA, {
            target: expect.anything(),
            onUpdate: ["own1", "own2", "own3", "own4"],
        });
        expectedMap.set(TestTargetB, {
            target: expect.anything(),
            onUpdate: ["other1", "other2"],
        });
        expectedMap.set(TestTargetC, {
            target: expect.anything(),
            onUpdate: true,
            onRemove: true,
        });

        expect(job.triggerMap).toEqual(expectedMap);
    });

    it("can return a map of changes", () => {
        const job = new RegisteredJob<TestTargetA>(() => {}, {
            target: TestTargetA,
        });

        job.addExpectedChange(
            { updates: ["own1"] },
            { updates: ["own2"] },
            { target: () => TestTargetA, updates: ["own3"] },
            { target: TestTargetA, updates: ["own4"] },
            { target: TestTargetB, updates: ["other1", "other2"] },
            { target: TestTargetC, updates: true },
            { target: TestTargetC, updates: ["nope"] },
            { target: TestTargetC, removes: true },
        );

        const expectedMap = new Map();
        expectedMap.set(TestTargetA, {
            target: expect.anything(),
            updates: ["own1", "own2", "own3", "own4"],
        });
        expectedMap.set(TestTargetB, {
            target: expect.anything(),
            updates: ["other1", "other2"],
        });
        expectedMap.set(TestTargetC, {
            target: expect.anything(),
            updates: true,
            removes: true,
        });

        expect(job.willChangeMap).toEqual(expectedMap);
    });

    it("can generate a graph with one type", () => {
        const job1 = new RegisteredJob<TestTargetA>(
            () => {},
            {
                target: TestTargetA,
            },
            "job1",
        );
        job1.addExpectedChange({
            updates: true,
        });

        const job2 = new RegisteredJob<TestTargetA>(
            () => {},
            {
                target: TestTargetA,
            },
            "job2",
        );
        job2.addTriggers({
            onUpdate: true,
        });

        const graph = new JobGraph([job1, job2]);

        const expected = new Map<string, JobNode>();
        expected.set("job1", {
            job: job1,
            ...emptyExpectation,
            willTriggerSpecific: ["job2"],
        });
        expected.set("job2", {
            job: job2,
            ...emptyExpectation,
            triggeredBySpecific: ["job1"],
        });

        expect(graph.jobNodes).toEqual(expected);
    });

    it("can generate a graph with multiple types", () => {
        const job1 = new RegisteredJob<TestTargetA>(
            () => {},
            {
                target: TestTargetA,
            },
            "job1",
        );
        job1.addExpectedChange({
            updates: ["p1", "p2"],
        });
        job1.addTriggers({
            onCreate: true,
        });

        const job2 = new RegisteredJob<TestTargetB>(
            () => {},
            {
                target: TestTargetB,
            },
            "job2",
        );
        job2.addExpectedChange({
            target: TestTargetA,
            creates: true,
        });

        const job3 = new RegisteredJob<TestTargetA>(
            () => {},
            {
                target: TestTargetA,
            },
            "job3",
        );
        job3.addTriggers({
            onUpdate: ["p2", "p3"],
            onCreate: true,
        });

        const graph = new JobGraph([job1, job2, job3]);

        const expected = new Map<string, JobNode>();
        expected.set("job1", {
            job: job1,
            ...emptyExpectation,
            willTriggerSpecific: ["job3"],
            triggeredByAny: ["job2"],
        });
        expected.set("job2", {
            job: job2,
            ...emptyExpectation,
            willTriggerAny: ["job1", "job3"],
        });
        expected.set("job3", {
            job: job3,
            ...emptyExpectation,
            triggeredBySpecific: ["job1"],
            triggeredByAny: ["job2"],
        });

        expect(graph.jobNodes).toEqual(expected);
    });
});
