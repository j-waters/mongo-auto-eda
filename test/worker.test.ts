import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { getModelForClass, mongoose, prop } from "@typegoose/typegoose";
import type { ObjectId } from "mongodb";
import { Worker } from "../src/worker";
import { Consumer, Job, JobManager, Watcher, addJob } from "../src";
import { JobInstanceModel } from "../src/entities/JobInstance";

class TestTargetA {
    _id!: ObjectId;

    @prop({ type: () => String })
    name!: string;

    @prop({ type: () => String })
    triggerBatch!: string;

    @prop({ type: () => String })
    afterBatch!: string;
}

const TestModel = getModelForClass(TestTargetA);

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
    const worker = new Worker(1);
    afterEach(() => worker.stop());

    const manager = new JobManager();

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
                { target: () => TestTargetA },
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

            @Consumer<TestConsumer, TestTargetA>({ target: () => TestTargetA })
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
                jobName: "TestConsumer<TestTargetA>.testJob",
                entityId: entity._id,
            });
        }));

    it("can run jobs in the correct order", () =>
        // eslint-disable-next-line no-async-promise-executor
        new Promise<void>(async (resolve) => {
            const executedJobs = [] as string[];
            const expectedJobOrder = ["jobB", "jobA"];
            function handleJobExecution(name: string) {
                executedJobs.push(name);

                if (executedJobs.length === expectedJobOrder.length) {
                    expect(executedJobs).toEqual(expectedJobOrder);
                    resolve();
                }
            }

            addJob(
                "jobA",
                () => {
                    handleJobExecution("jobA");
                },
                {
                    target: () => TestTargetA,
                    triggers: [{ onUpdate: ["foo"] }],
                },
            );

            addJob(
                "jobB",
                () => {
                    handleJobExecution("jobB");
                },
                {
                    target: () => TestTargetA,
                    expectedChanges: [{ updates: ["foo"] }],
                },
            );

            const entity = await TestModel.create({ name: "name" });

            await JobInstanceModel.create({
                jobName: "jobA",
                entityId: entity._id,
            });

            await JobInstanceModel.create({
                jobName: "jobB",
                entityId: entity._id,
            });

            worker.start();
        }));

    it("can run batch jobs in the correct order", () =>
        // eslint-disable-next-line no-async-promise-executor
        new Promise<void>(async (resolve) => {
            const executedJobs = [] as string[];
            const expectedJobOrder = [
                "preBatch",
                "preBatch",
                "preBatch",
                "batch",
                "postBatch",
                "postBatch",
                "postBatch",
            ];
            function handleJobExecution(name: string) {
                executedJobs.push(name);

                if (executedJobs.length === expectedJobOrder.length) {
                    expect(executedJobs).toEqual(expectedJobOrder);
                    resolve();
                }
            }

            addJob(
                "preBatch",
                () => {
                    handleJobExecution("preBatch");
                },
                {
                    target: () => TestTargetA,
                    expectedChanges: [{ updates: ["triggerBatch"] }],
                },
            );

            addJob(
                "batch",
                () => {
                    handleJobExecution("batch");
                },
                {
                    target: () => TestTargetA,
                    triggers: [{ onUpdate: ["triggerBatch"] }],
                    expectedChanges: [{ updates: ["afterBatch"] }],
                    batch: true,
                },
            );

            addJob(
                "postBatch",
                () => {
                    handleJobExecution("postBatch");
                },
                {
                    target: () => TestTargetA,
                    triggers: [{ onUpdate: ["afterBatch"] }],
                },
            );

            const entities = [
                await TestModel.create({ name: "one" }),
                await TestModel.create({ name: "two" }),
                await TestModel.create({ name: "three" }),
            ];

            await manager.queue(
                "postBatch",
                entities.map((e) => e._id),
            );
            await manager.queue(
                "preBatch",
                entities.map((e) => e._id),
            );
            await manager.queue(
                "batch",
                entities.map((e) => e._id),
            );

            worker.start();
        }));
});

describe("worker works with watcher", () => {
    const watcher = new Watcher();
    afterEach(() => watcher.stop());

    const worker = new Worker(1);
    afterEach(() => worker.stop());

    it("handles batch", () =>
        // eslint-disable-next-line no-async-promise-executor
        new Promise<void>(async (resolve) => {
            const executedJobs = [] as string[];
            const expectedJobOrder = [
                "preBatch",
                "preBatch",
                "preBatch",
                "batch",
                "postBatch",
                "postBatch",
            ];
            function handleJobExecution(name: string) {
                executedJobs.push(name);
                console.log(executedJobs);

                if (executedJobs.length === expectedJobOrder.length) {
                    expect(executedJobs).toEqual(expectedJobOrder);
                    resolve();
                }
            }

            addJob(
                "preBatch",
                async (entityId) => {
                    await TestModel.findByIdAndUpdate(entityId, {
                        triggerBatch: "changed",
                    });
                    handleJobExecution("preBatch");
                },
                {
                    target: () => TestTargetA,
                    triggers: [{ onCreate: true }],
                    expectedChanges: [{ updates: ["triggerBatch"] }],
                },
            );

            addJob(
                "batch",
                async () => {
                    const models = await TestModel.find().limit(2).exec();
                    for (const model of models) {
                        await model.updateOne({ afterBatch: "updated" }).exec();
                    }
                    handleJobExecution("batch");
                },
                {
                    target: () => TestTargetA,
                    triggers: [{ onUpdate: ["triggerBatch"] }],
                    expectedChanges: [{ updates: ["afterBatch"] }],
                    batch: true,
                },
            );

            addJob(
                "postBatch",
                () => {
                    handleJobExecution("postBatch");
                },
                {
                    target: () => TestTargetA,
                    triggers: [{ onUpdate: ["afterBatch"] }],
                },
            );

            worker.start();
            watcher.start();

            const entities = [
                await TestModel.create({ name: "one" }),
                await TestModel.create({ name: "two" }),
                await TestModel.create({ name: "three" }),
            ];
        }));
});
