import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import type { DocumentType } from "@typegoose/typegoose";
import { getModelForClass, mongoose, prop } from "@typegoose/typegoose";
import { ObjectId } from "mongodb";
import { Watcher, generateModifiedFields } from "../src/watcher";
import type { JobInstance, JobState } from "../src/entities";
import { JobInitiatorModel, JobInstanceModel } from "../src/entities";
import { Consumer, Job, JobTrigger, addJob } from "../src";

class SubDocument {
    @prop({ type: () => Number })
    prop!: number;
}

class TestTarget {
    _id!: ObjectId;

    @prop({ type: () => String })
    name!: string;

    @prop({ type: () => Number })
    age!: number;

    @prop({ type: () => SubDocument })
    subDoc!: SubDocument;
}

const TestModel = getModelForClass(TestTarget);

class TestTargetB {
    _id!: ObjectId;
}

beforeEach(async () => {
    const replSet = new MongoMemoryReplSet({
        replSet: { count: 1 },
        instanceOpts: [{ storageEngine: "wiredTiger" }],
    });
    await replSet.start();

    // Get the connection URI for the replica set
    const uri = replSet.getUri();

    await mongoose.connect(uri);

    // clean up function, called once after each test run
    return async () => {
        await replSet.stop();
    };
});

function sleep(t = 250) {
    return new Promise<void>((resolve) => setTimeout(resolve, t));
}

const expectedJobCommon = {
    _id: expect.any(ObjectId),
    __v: expect.any(Number),
    checkReadyAttempts: 0,
    createdAt: expect.any(Date),
    updatedAt: expect.any(Date),
    state: "ready" as JobState,
};

const expectedInitiatorCommon = {
    _id: expect.any(ObjectId),
    __v: expect.any(Number),
    createdAt: expect.any(Date),
    updatedAt: expect.any(Date),
};

describe("watcher", () => {
    const watcher = new Watcher();

    afterEach(() => watcher.stop());

    it("can be stopped", () =>
        new Promise<void>((resolve) => {
            watcher.start().then(() => resolve());
            watcher.stop();
        }));

    it("queues job on insert", async () => {
        addJob("testJob", () => {}, {
            target: () => TestTarget,
            triggers: [
                {
                    onCreate: true,
                },
            ],
        });

        watcher.start();

        const entity = await TestModel.create({ name: "name" });

        while (true) {
            const jobs = await JobInstanceModel.find().lean().exec();
            if (jobs.length !== 1) {
                continue;
            }
            await sleep();

            const initiators = await JobInitiatorModel.find().lean().exec();
            expect(initiators).toEqual([
                {
                    ...expectedInitiatorCommon,
                    created: true,
                    deleted: false,
                    updated: [],
                    name: "<TestTarget>(created: true)",
                    target: "TestTarget",
                },
            ]);

            expect(jobs).toEqual([
                {
                    jobName: "testJob",
                    entityId: entity._id,
                    initiator: initiators[0]._id,
                    ...expectedJobCommon,
                },
            ]);
            break;
        }
    });

    it("queues job on update", async () => {
        addJob("onUpdateAny", () => {}, {
            target: () => TestTarget,
            triggers: [
                {
                    onUpdate: true,
                },
            ],
        });
        addJob("onUpdatePath", () => {}, {
            target: () => TestTarget,
            triggers: [
                {
                    onUpdate: ["name"],
                },
            ],
        });
        addJob("onUpdateWrongPath", () => {}, {
            target: () => TestTarget,
            triggers: [
                {
                    onUpdate: ["age"],
                },
            ],
        });
        addJob("noUpdate", () => {}, {
            target: () => TestTarget,
            triggers: [
                {
                    onUpdate: false,
                },
            ],
        });

        const entity = await TestModel.create({ name: "name" });

        watcher.start();

        await entity.updateOne({ name: "other" });
        await entity.updateOne({ name: "another" });

        while (true) {
            const jobs = await JobInstanceModel.find().lean().exec();
            if (jobs.length !== 2) {
                continue;
            }
            await sleep();

            const initiators = await JobInitiatorModel.find().lean().exec();
            expect(initiators).toEqual([
                {
                    ...expectedInitiatorCommon,
                    created: false,
                    deleted: false,
                    updated: ["name"],
                    name: "<TestTarget>(updated: [name])",
                    target: "TestTarget",
                },
                {
                    ...expectedInitiatorCommon,
                    created: false,
                    deleted: false,
                    updated: ["name"],
                    name: "<TestTarget>(updated: [name])",
                    target: "TestTarget",
                },
            ]);

            expect(jobs).toEqual([
                {
                    jobName: "onUpdateAny",
                    entityId: entity._id,
                    initiator: initiators[0]._id,
                    ...expectedJobCommon,
                },
                {
                    jobName: "onUpdatePath",
                    entityId: entity._id,
                    initiator: initiators[0]._id,
                    ...expectedJobCommon,
                },
            ]);
            break;
        }
    });

    it("queues job on subdoc update", async () => {
        expect(
            generateModifiedFields({ "a.b.c": 1, single: 1 }).sort(),
        ).toEqual(["a", "a.b", "a.b.c", "single"].sort());

        addJob("onUpdatePath", () => {}, {
            target: () => TestTarget,
            triggers: [
                {
                    onUpdate: ["subDoc"],
                },
            ],
        });

        const entity = await TestModel.create({
            name: "name",
            subDoc: { prop: 3 },
        });

        watcher.start();

        entity.subDoc.prop = 5;

        await entity.save();

        while (true) {
            const jobs = await JobInstanceModel.find().lean().exec();
            if (jobs.length !== 1) {
                continue;
            }
            await sleep();

            const initiators = await JobInitiatorModel.find().lean().exec();
            expect(initiators).toEqual([
                {
                    ...expectedInitiatorCommon,
                    created: false,
                    deleted: false,
                    updated: ["subDoc.prop", "subDoc"],
                    name: "<TestTarget>(updated: [subDoc.prop, subDoc])",
                    target: "TestTarget",
                },
            ]);

            expect(jobs).toEqual([
                {
                    jobName: "onUpdatePath",
                    entityId: entity._id,
                    initiator: initiators[0]._id,
                    ...expectedJobCommon,
                },
            ]);
            break;
        }
    });

    it("handles deletion and bulk", async () => {
        addJob("batchRemove", () => {}, {
            target: () => TestTarget,
            batch: true,
            triggers: [
                {
                    onRemove: true,
                },
            ],
        });
        const entity = await TestModel.create({ name: "foo" });
        const entity2 = await TestModel.create({ name: "bar" });

        watcher.start();

        await entity.deleteOne();
        await entity2.deleteOne();

        while (true) {
            const jobs = await JobInstanceModel.find().lean().exec();
            if (jobs.length !== 1) {
                continue;
            }
            await sleep();

            const initiators = await JobInitiatorModel.find().lean().exec();
            expect(initiators).toEqual([
                {
                    ...expectedInitiatorCommon,
                    created: false,
                    deleted: true,
                    updated: [],
                    name: "<TestTarget>(deleted: true)",
                    target: "TestTarget",
                },
            ]);

            expect(jobs).toEqual([
                {
                    jobName: "batchRemove",
                    isBatch: true,
                    initiator: initiators[0]._id,
                    ...expectedJobCommon,
                },
            ]);
            break;
        }
    });

    it("runs transformers on create", async () => {
        let entityPromise: Promise<DocumentType<TestTarget>>;
        const targetBIds = [new ObjectId(), new ObjectId()];

        addJob("job", () => {}, {
            target: () => TestTargetB,
            triggers: [
                {
                    target: TestTarget,
                    onCreate: true,
                    async transformer(gotEntity) {
                        const entity = await entityPromise;
                        expect(gotEntity!.toObject()).toEqual(
                            entity.toObject(),
                        );
                        expect(this).toBeUndefined();
                        return targetBIds;
                    },
                },
            ],
        });

        watcher.start();

        entityPromise = TestModel.create({ name: "test" });

        await waitForExpectedJobs(
            targetBIds.map((id) => ({
                jobName: "job",
                entityId: id,
                initiator: expect.any(ObjectId),
                ...expectedJobCommon,
            })),
        );
    });

    it("runs transformers on update", async () => {
        let entity: DocumentType<TestTarget>;
        const targetBId = new ObjectId();

        addJob("job", () => {}, {
            target: () => TestTargetB,
            triggers: [
                {
                    target: TestTarget,
                    onUpdate: true,
                    async transformer(curEntity, event) {
                        expect(curEntity!.toObject()).toEqual({
                            ...entity.toObject(),
                            name: "changed",
                        });
                        expect(event).toEqual({
                            changeStreamEvent: expect.anything(),
                            type: "update",
                            modifiedFields: ["name"],
                        });
                        expect(this).toBeUndefined();
                        return targetBId;
                    },
                },
            ],
        });

        entity = await TestModel.create({ name: "test" });

        watcher.start();

        await entity.updateOne({ name: "changed" }).exec();

        await waitForExpectedJobs([
            {
                jobName: "job",
                entityId: targetBId,
                initiator: expect.any(ObjectId),
                ...expectedJobCommon,
            },
        ]);
    });

    it("runs transformers on delete", async () => {
        addJob("job", () => {}, {
            target: () => TestTargetB,
            triggers: [
                {
                    target: TestTarget,
                    onRemove: true,
                    async transformer(curEntity, event) {
                        expect(curEntity).toBeUndefined();
                        expect(event).toEqual({
                            changeStreamEvent: expect.anything(),
                            type: "delete",
                            modifiedFields: [],
                        });
                        expect(this).toBeUndefined();
                    },
                },
            ],
        });

        await TestModel.create({ name: "test" });

        watcher.start();

        await TestModel.deleteMany();

        await sleep(1000);

        await waitForExpectedJobs([]);
    });

    it("runs transformers in the consumer's context", async () => {
        let entityPromise: Promise<DocumentType<TestTarget>>;
        const targetBIds = [new ObjectId(), new ObjectId()];

        let consumerInstance: TestConsumer;
        @Consumer(TestTargetB)
        class TestConsumer {
            @Job()
            @JobTrigger(
                TestTarget,
                async function (this: TestConsumer, gotEntity) {
                    const entity = await entityPromise;
                    expect(gotEntity!.toObject()).toEqual(entity.toObject());
                    expect(this).toBe(consumerInstance);
                    return targetBIds;
                },
            )
            testJob() {}
        }

        consumerInstance = new TestConsumer();

        watcher.start();

        entityPromise = TestModel.create({ name: "test" });

        while (true) {
            const jobs = await JobInstanceModel.find().lean().exec();
            if (jobs.length !== targetBIds.length) {
                continue;
            }
            await sleep();

            expect(jobs).toEqual(
                targetBIds.map((id) => ({
                    jobName: "TestConsumer<TestTargetB>.testJob",
                    entityId: id,
                    initiator: expect.any(ObjectId),
                    ...expectedJobCommon,
                })),
            );
            break;
        }
    });
});

async function waitForExpectedJobs(expectedJobs: Omit<JobInstance, "id">[]) {
    while (true) {
        const jobs = await JobInstanceModel.find().lean().exec();
        if (jobs.length !== expectedJobs.length) {
            continue;
        }
        await sleep();

        expect(jobs).toEqual(expect.arrayContaining(expectedJobs));
        return;
    }
}
