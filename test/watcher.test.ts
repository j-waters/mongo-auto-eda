import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { getModelForClass, mongoose, prop } from "@typegoose/typegoose";
import { ObjectId } from "mongodb";
import { Watcher, generateModifiedFields } from "../src/watcher";
import { JobInstanceModel } from "../src/entities/JobInstance";
import { addJob } from "../src";

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

function sleep() {
    return new Promise<void>((resolve) => setTimeout(resolve, 250));
}

const expectedJobCommon = {
    _id: expect.any(ObjectId),
    __v: expect.any(Number),
    checkReadyAttempts: 0,
    createdAt: expect.any(Date),
    updatedAt: expect.any(Date),
    state: "ready",
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

            expect(jobs).toEqual([
                {
                    jobName: "testJob",
                    entityId: entity._id,
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

            expect(jobs).toEqual([
                {
                    jobName: "onUpdateAny",
                    entityId: entity._id,
                    ...expectedJobCommon,
                },
                {
                    jobName: "onUpdatePath",
                    entityId: entity._id,
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

            expect(jobs).toEqual([
                {
                    jobName: "onUpdatePath",
                    entityId: entity._id,
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

            expect(jobs).toEqual([
                {
                    jobName: "batchRemove",
                    isBatch: true,
                    ...expectedJobCommon,
                },
            ]);
            break;
        }
    });
});

// TODO: add transformer tests
