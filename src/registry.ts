import type { Class, Targetable } from "./common";
import { RegisteredConsumer } from "./entities/RegisteredConsumer";
import { RegisteredJob } from "./entities/RegisteredJob";
import type { ConsumerOptions } from "./decorators/Consumer";
import type { ChangeInfo, JobOptions } from "./job";

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

    addConsumer<T extends Targetable>(cls: Class, options: ConsumerOptions<T>) {
        const consumer = new RegisteredConsumer(cls, options);
        this.consumers.push(consumer);
        this.jobs
            .filter((j) => j.consumerClass === consumer.cls)
            .forEach((j) => j.registerConsumer(consumer));
        return consumer;
    }

    addJob(
        func: (...args: any[]) => any,
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

    getJobByName(name: string): RegisteredJob | undefined {
        return this.jobs.find((j) => j.name === name);
    }

    // Get all the jobs that match the given target and will be triggered by the given change
    getTriggeredJobs(change: ChangeInfo) {
        if (!change) {
            return [];
        }

        return this.jobs.filter((j) => j.isTriggered(change));
    }

    // Get all the jobs that match the given target and would cause the given change
    getPrerequisiteJobs<T extends Targetable>(change: ChangeInfo<T>) {
        if (!change) {
            return [];
        }

        return this.jobs.filter((j) => j.willTrigger(change));
    }
}

export const registry = new Registry();
