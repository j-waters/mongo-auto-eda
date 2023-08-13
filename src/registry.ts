import type { Class, JobFunction, Targetable } from "./common";
import { RegisteredConsumer } from "./entities/RegisteredConsumer";
import { RegisteredJob } from "./entities/RegisteredJob";
import type { ConsumerOptions } from "./decorators/Consumer";
import type { ChangeInfo, JobOptions } from "./job";
import { JobGraph } from "./graph";
import type {
    HandlerFunction,
    ReprocessOptions,
} from "./entities/RegisteredReprocessHandler";
import { RegisteredReprocessHandler } from "./entities/RegisteredReprocessHandler";

// interface RegisteredJob {
//     name: string;
//     cls: Class;
//     propertyKey: string;
//     func: (...args: any[]) => any;
//     options: JobOptions<any>;
//     consumer: RegisteredConsumer;
// }
//
// interface RegisteredConsumer {
//     name: string;
//     options: ConsumerOptions;
//     cls: Class;
// }

export class Registry {
    consumers: RegisteredConsumer[] = [];
    jobs: RegisteredJob[] = [];
    reprocessHandlers: RegisteredReprocessHandler[] = [];

    addConsumer<T extends Targetable>(cls: Class, options: ConsumerOptions<T>) {
        const consumer = new RegisteredConsumer(cls, options);
        this.consumers.push(consumer);
        [...this.jobs, ...this.reprocessHandlers]
            .filter((j) => j.consumerClass === consumer.cls)
            .forEach((j) => j.registerConsumer(consumer));
        return consumer;
    }

    addJob(
        func: JobFunction,
        options: JobOptions<any>,
        nameOrProp?: string,
        parentClass?: Class,
    ): RegisteredJob {
        const job = new RegisteredJob(func, options, nameOrProp, parentClass);
        if (!job.name) {
            throw new Error(`New job ${job} has no name`);
        }
        if (this.getJobByName(job.name)) {
            throw new Error(`New job ${job} has duplicate name ${job.name}`);
        }

        this.jobs.push(job);
        return job;
    }

    addReprocessHandler(
        func: HandlerFunction,
        options?: ReprocessOptions,
        parentClass?: Class,
    ) {
        const handler = new RegisteredReprocessHandler(
            func,
            options,
            parentClass,
        );
        this.reprocessHandlers.push(handler);
        return handler;
    }

    getJobByName(name: string): RegisteredJob | undefined {
        return this.jobs.find((j) => j.name === name);
    }

    // Get all the jobs that will be triggered by the given change
    getTriggeredJobs(change: ChangeInfo) {
        if (!change) {
            return [];
        }

        return this.jobs.filter((j) => j.isTriggered(change));
    }

    get graph() {
        return new JobGraph(this.jobs);
    }
}

export const registry = new Registry();
