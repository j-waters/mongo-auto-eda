import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { getModelForClass, mongoose, prop } from "@typegoose/typegoose";
import { Worker } from "../src/worker";
import { Consumer, Job, addJob } from "../src";
import { JobInstanceModel } from "../src/entities/JobInstance";

class TestTarget {
    @prop({ type: () => String })
    name!: string;
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

describe("worker", () => {
    const worker = new Worker();

    afterEach(() => worker.stop());

    it("can be stopped", () =>
        new Promise<void>((resolve) => {
            worker.start().then(() => resolve());
            worker.stop();
        }));

    it("can run a basic job", () =>
        // eslint-disable-next-line no-async-promise-executor
        new Promise<void>(async (resolve) => {
            worker.start();

            addJob(
                "testJob",
                () => {
                    resolve();
                },
                { target: () => TestTarget },
            );

            const entity = await TestModel.create({ name: "name" });

            await JobInstanceModel.create({
                jobName: "testJob",
                entityId: entity._id,
            });
        }));

    it("can run a consumer job", () =>
        // eslint-disable-next-line no-async-promise-executor
        new Promise<void>(async (resolve) => {
            worker.start();

            let consumerInstance: TestConsumer;

            @Consumer<TestConsumer>({ target: () => TestTarget })
            class TestConsumer {
                private prop = "foo";

                @Job({})
                testJob() {
                    expect(this).toBe(consumerInstance);
                    expect(this.prop).toEqual("foo");
                    resolve();
                }
            }

            consumerInstance = new TestConsumer();

            const entity = await TestModel.create({ name: "name" });

            await JobInstanceModel.create({
                jobName: "TestConsumer<TestTarget>.testJob",
                entityId: entity._id,
            });
        }));
});
