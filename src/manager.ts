import type { ObjectId } from "mongodb";
import type { FilterQuery } from "mongoose";
import { registry } from "./registry";
import type { JobInstance } from "./entities/JobInstance";
import { JobInstanceModel } from "./entities/JobInstance";
import type { RegisteredJob } from "./entities/RegisteredJob";

export class JobManager {
    queue(jobName: string, entityIds?: ObjectId | ObjectId[]) {
        const definition = registry.getJobByName(jobName);
        if (!definition) {
            throw new Error(`No job with name ${jobName}`);
        }

        if (definition.batch) {
            return this.queueOne(definition);
        }

        if (!entityIds) {
            throw new Error(`Missing entityIds`);
        }

        if (!Array.isArray(entityIds)) {
            entityIds = [entityIds];
        }

        // can be replaced with a bulk action
        return Promise.all(
            entityIds.map((id) => this.queueOne(definition, id)),
        );
    }

    private queueOne(definition: RegisteredJob, entityId?: ObjectId) {
        const query = {
            jobName: definition.name,
            state: "ready",
        } as FilterQuery<JobInstance>;
        if (!definition.batch) {
            query.entityId = entityId!;
        }

        return JobInstanceModel.findOneAndUpdate(
            query,
            {
                $setOnInsert: {
                    isBatch: definition.batch,
                    entityId: definition.batch ? undefined : entityId,
                },
            },
            { new: true, upsert: true },
        );
    }
}
