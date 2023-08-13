import type { FilterQuery } from "mongoose";
import type { DocumentType } from "@typegoose/typegoose";
import { registry } from "./registry";
import type { JobInstance, JobState, RegisteredJob } from "./entities";
import { JobInitiator, JobInitiatorModel, JobInstanceModel } from "./entities";
import type { HasId } from "./util";
import { getId } from "./util";
import type { Target } from "./common";
import { resolveTarget } from "./common";

export class JobManager {
    async queue(
        jobName: string,
        initiator: JobInitiator,
        entityIds?: HasId | HasId[],
    ): Promise<DocumentType<JobInstance>[]> {
        const definition = registry.getJobByName(jobName);
        if (!definition) {
            throw new Error(`No job with name ${jobName}`);
        }

        if (definition.batch) {
            return Promise.all([this.queueOne(definition, initiator)]);
        }

        if (!entityIds) {
            throw new Error(`Missing entityIds`);
        }

        if (!Array.isArray(entityIds)) {
            entityIds = [entityIds];
        }

        initiator = await this.maybeInsertInitiator(initiator);

        // can be replaced with a bulk action
        return Promise.all(
            entityIds.map((id) => this.queueOne(definition, initiator, id)),
        );
    }

    private async queueOne(
        definition: RegisteredJob,
        initiator: JobInitiator,
        entityId?: HasId,
    ): Promise<DocumentType<JobInstance>> {
        const query: FilterQuery<JobInstance> = {
            jobName: definition.name,
            state: "ready",
        };
        entityId = getId(entityId);

        if (!definition.batch) {
            query.entityId = entityId!;
        }

        return JobInstanceModel.findOneAndUpdate(
            query,
            {
                $setOnInsert: {
                    isBatch: definition.batch,
                    entityId: definition.batch ? undefined : entityId,
                    initiator: await this.maybeInsertInitiator(initiator),
                },
            },
            { new: true, upsert: true },
        );
    }

    private async maybeInsertInitiator(
        initiator: JobInitiator,
    ): Promise<JobInitiator> {
        if (initiator._id) {
            return initiator;
        }

        return await JobInitiatorModel.create(initiator);
    }

    async waitForJobs(query: FilterQuery<JobInstance>): Promise<void> {
        query = {
            ...query,
            state: { $in: ["ready", "reserved"] as JobState[] },
        };
        while (await JobInstanceModel.count(query).exec()) {
            await new Promise((resolve) => setTimeout(resolve, 200));
        }
    }

    async getInitiators() {
        return JobInitiatorModel.find().exec();
    }

    async reprocess(target?: Target): Promise<JobInstance[]> {
        const initiator = new JobInitiator({ reprocessing: target });
        return (
            await Promise.all(
                registry.reprocessHandlers
                    .filter(
                        (handler) =>
                            !target || handler.target === resolveTarget(target),
                    )
                    .map(async (handler) => {
                        console.log("handler", handler);

                        const entityIds = await handler.func();
                        return Promise.all(
                            registry
                                .getTriggeredJobs({
                                    target: handler.target!,
                                    updates: true,
                                    creates: true,
                                })
                                .map((job) => {
                                    return this.queue(
                                        job.name,
                                        initiator,
                                        entityIds,
                                    );
                                }),
                        );
                    }),
            )
        ).flat(2);
    }
}
