import type { Class } from "./common";
import { RegisteredConsumer } from "./entities/RegisteredConsumer";
import { RegisteredJob } from "./entities/RegisteredJob";
import type { ConsumerOptions } from "./consumer";
import type { JobOptions } from "./job";

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

    addConsumer(cls: Class, options: ConsumerOptions) {
        const consumer = new RegisteredConsumer(cls, options);
        this.consumers.push(consumer);
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

    getConsumers(target: Class): RegisteredConsumer[] {
        return this.consumers.filter((c) => {
            return c.options.target() === target;
        });
    }

    getJobs(target: Class): RegisteredJob[] {
        return this.getConsumers(target).flatMap((c) =>
            this.jobs.filter((j) => j.parentClass === c.cls),
        );
    }

    getJobsForTarget(target: Class): RegisteredJob[] {
        return this.jobs.filter((j) => j.target && j.target() === target);
    }

    getOnCreatedJobs(target: Class): RegisteredJob[] {
        return this.getJobsForTarget(target);
    }

    getOnChangedJobs(target: Class, modified: string[]) {
        const jobs = this.getJobsForTarget(target);

        return jobs.filter((j) => {
            if (!j.options.onChanged) {
                return false;
            }
            if (j.options.onChanged === true) {
                return true;
            }
            return hasOverlap(j.options.onChanged, modified);
        });
    }
}

export const registry = new Registry();

function hasOverlap<T>(arr1: T[], arr2: T[]): boolean {
    return arr1.some((element) => arr2.includes(element));
}
