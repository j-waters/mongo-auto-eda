import { registry } from "./registry";
import type { Class, JobFunction } from "./common";
import type { RegisteredJob } from "./entities/RegisteredJob";

export interface JobOptions<T> {
    onChanged?: (keyof T | string)[] | boolean;
    canRun?: (entity: T) => Promise<boolean>;
}

export interface StandaloneJobOptions<T> extends JobOptions<T> {
    target: () => Class;
}

export function Job<T>(options: JobOptions<T>) {
    return function (
        target: any,
        propertyKey: string,
        descriptor: PropertyDescriptor,
    ) {
        registry.addJob(
            descriptor.value,
            options,
            propertyKey,
            target.constructor,
        );
    };
}

export function addJob<T>(
    func: JobFunction<T>,
    options: StandaloneJobOptions<T>,
): RegisteredJob;
export function addJob<T>(
    name: string,
    func: JobFunction<T>,
    options: StandaloneJobOptions<T>,
): RegisteredJob;
export function addJob<T>(
    a: string | JobFunction<T>,
    b: JobFunction<T> | StandaloneJobOptions<T>,
    c?: StandaloneJobOptions<T>,
): RegisteredJob {
    if (typeof a === "string") {
        return registry.addJob(
            b as JobFunction<T>,
            c as StandaloneJobOptions<T>,
            a,
        );
    } else {
        return registry.addJob(
            a as JobFunction<T>,
            b as StandaloneJobOptions<T>,
        );
    }
}
