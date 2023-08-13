import { beforeEach, describe, expect, it } from "vitest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { mongoose } from "@typegoose/typegoose";
import { ObjectId } from "mongodb";
import { Consumer, JobManager, Reprocess, addJob } from "../src";
import { JobInstanceModel } from "../src/entities";

class TestTargetA {}
class TestTargetB {}

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

describe("reprocess", () => {
    const manager = new JobManager();

    it("should reprocess specific target", async () => {
        const entityIds = [new ObjectId(), new ObjectId()];

        @Consumer(TestTargetA)
        class TestConsumer {
            @Reprocess()
            async reprocess() {
                return entityIds;
            }
        }

        addJob("t1", () => {}, {
            target: TestTargetA,
            triggers: [
                {
                    onUpdate: ["prop"],
                },
            ],
        });
        addJob("t2", () => {}, {
            target: TestTargetA,
            triggers: [
                {
                    onCreate: true,
                },
            ],
        });
        addJob("t3", () => {}, {
            target: TestTargetA,
            triggers: [
                {
                    onRemove: true,
                },
            ],
        });

        await manager.reprocess(TestTargetA);

        const jobs = await JobInstanceModel.find().lean().exec();

        expect(jobs).toHaveLength(entityIds.length * 2);
        expect(jobs).toEqual(
            expect.arrayContaining(
                entityIds.flatMap((entityId) => [
                    expect.objectContaining({
                        entityId,
                        jobName: "t1",
                    }),
                    expect.objectContaining({
                        entityId,
                        jobName: "t2",
                    }),
                ]),
            ),
        );
    });

    it("should reprocess every target", async () => {
        const entityAIds = [new ObjectId(), new ObjectId()];
        const entityBIds = [new ObjectId(), new ObjectId()];

        @Consumer(TestTargetA)
        class TestConsumerA {
            @Reprocess()
            async reprocess() {
                return entityAIds;
            }
        }

        @Consumer(TestTargetB)
        class TestConsumerB {
            @Reprocess()
            reprocess() {
                return entityBIds;
            }
        }

        addJob("t1", () => {}, {
            target: TestTargetA,
            triggers: [
                {
                    onCreate: true,
                },
            ],
        });
        addJob("t2", () => {}, {
            target: TestTargetB,
            triggers: [
                {
                    onCreate: true,
                },
            ],
        });

        await manager.reprocess();

        const jobs = await JobInstanceModel.find().lean().exec();

        const entityIds = [entityAIds, entityBIds];

        expect(jobs).toHaveLength(entityIds.length * 2);
        expect(jobs).toEqual(
            expect.arrayContaining([
                ...entityAIds.map((entityId) =>
                    expect.objectContaining({
                        entityId,
                        jobName: "t1",
                    }),
                ),
                ...entityBIds.map((entityId) =>
                    expect.objectContaining({
                        entityId,
                        jobName: "t2",
                    }),
                ),
            ]),
        );
    });
});
