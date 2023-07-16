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

        job.addWillChange(
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

    it("can generate a simple graph", () => {
        const jobA = new RegisteredJob<TestTargetA>(
            () => {},
            {
                target: TestTargetA,
            },
            "jobA",
        );
        jobA.addWillChange({
            target: TestTargetB,
            creates: true,
        });

        const jobB = new RegisteredJob<TestTargetA>(
            () => {},
            {
                target: TestTargetB,
            },
            "jobB",
        );
        jobB.addTriggers({
            onCreate: true,
        });

        const graph = new JobGraph([jobA, jobB]);

        const expected = new Map<string, JobNode>();
        expected.set("jobA", {
            job: jobA,
            willTrigger: ["jobB"],
            triggeredBy: [],
        });
        expected.set("jobB", {
            job: jobB,
            willTrigger: [],
            triggeredBy: ["jobA"],
        });

        expect(graph.jobNodes).toEqual(expected);
    });
});
