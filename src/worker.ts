import type { ObjectId } from "mongodb";
import type { JobInstance, JobState } from "./entities/JobInstance";
import { JobInstanceModel } from "./entities/JobInstance";
import type { RegisteredJob } from "./entities/RegisteredJob";
import { registry } from "./registry";

type LeanJobInstance = Pick<JobInstance, "jobName" | "entityId" | "state"> & {
    _id: ObjectId;
};

export class Worker {
    private stopped = true;

    constructor(private parallel = 20) {}

    start() {
        this.stopped = false;
        return this.processLoop();
    }

    stop() {
        this.stopped = true;
    }

    private async processLoop() {
        let cursor = JobInstanceModel.find(
            {
                state: "ready",
            },
            ["jobName", "entityId", "state"],
        )
            .sort({ createdAt: 1, checkReadyAttempts: 1 })
            .lean()
            .cursor();

        while (!this.stopped) {
            const hasAny = false;
            const start = Date.now();

            await cursor.eachAsync(
                async (job) => {
                    console.log(job);
                    return this.handleJob(job);
                },
                { parallel: this.parallel },
            );

            if (start) {
                console.info(
                    "Finished batch in",
                    (Date.now() - start) / 1000,
                    "seconds",
                );
                // this.jobsService.pruneComplete();
            }

            if (this.stopped) {
                break;
            }

            if (!hasAny) {
                await new Promise<void>((resolve) =>
                    setTimeout(() => resolve(), 1000),
                );
            }

            cursor = cursor.rewind();
        }

        await cursor.close();
    }

    private async handleJob(job: LeanJobInstance) {
        const reserved = await this.reserveJob(job);
        if (!reserved) {
            return;
        }

        const jobDefinition = registry.getJobByName(job.jobName);
        if (!jobDefinition) {
            console.error(
                `No job definition for ${job.jobName}, burying job ${job._id} for entity ${job.entityId}`,
            );
            await this.buryJob(job);
            return;
        }

        if (await this.isJobReady(jobDefinition, job)) {
            await this.runJob(jobDefinition, job);
        } else {
            await this.jobNotReady(job);
        }
    }

    private async runJob(definition: RegisteredJob, job: LeanJobInstance) {
        let func = definition.func;
        if (definition.consumer && definition.consumer.instance) {
            const instance = definition.consumer.instance.deref();
            if (instance) {
                func = func.bind(instance);
            } else {
                console.warn(
                    `${definition.consumer.name} instance has been garbage collected`,
                );
            }
        }

        try {
            await func(job.entityId);
        } catch (err) {
            console.error(
                `Error running job ${job.jobName} with entityId ${job.entityId}; `,
                err,
            );
            await this.buryJob(job);
            return;
        }

        await this.updateState(job, "complete");
    }

    private async isJobReady(
        _definition: RegisteredJob,
        _job: LeanJobInstance,
    ): Promise<boolean> {
        return true;
    }

    private async updateState(
        job: LeanJobInstance,
        state: JobState,
    ): Promise<boolean> {
        const res = await JobInstanceModel.findOneAndUpdate(
            { _id: job._id, state: job.state },
            { state },
        ).exec();

        return !!res;
    }

    private async reserveJob(job: LeanJobInstance): Promise<boolean> {
        const res = await JobInstanceModel.findOneAndUpdate(
            { _id: job._id, state: job.state },
            { state: "reserved", reservedAt: new Date() },
        ).exec();

        if (res) {
            console.info(`Reserved job ${job.jobName}<${job.entityId}>`);
        }

        return !!res;
    }

    private buryJob(job: LeanJobInstance): Promise<boolean> {
        console.warn(`Buried job ${job.jobName}<${job.entityId}>`);
        return this.updateState(job, "buried");
    }

    private jobNotReady(job: LeanJobInstance) {
        return JobInstanceModel.findOneAndUpdate(
            { _id: job._id, state: job.state },
            { state: "ready", $inc: { checkReadyAttempts: 1 } },
        ).exec();
    }
}
