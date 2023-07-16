import { registry } from "./registry";
import type { JobFunction, Target, Targetable } from "./common";
import type { RegisteredJob } from "./entities/RegisteredJob";
import "reflect-metadata";

export type TargetProps<T extends Targetable = Targetable> = (
    | keyof T
    | string
)[];

export interface TriggerOptions<T extends Targetable = Targetable> {
    onUpdate?: TargetProps<T> | boolean;
    onCreate?: boolean;
    onRemove?: boolean;
    target?: Target<T>;
}

export interface Trigger<T extends Targetable = Targetable>
    extends TriggerOptions<T> {
    target: Target<T>;
}

export interface WillChangeOptions<T extends Targetable = Targetable> {
    updates?: TargetProps<T> | boolean;
    creates?: boolean;
    removes?: boolean;
    target?: Target<T>;
}

export interface ChangeInfo<T extends Targetable = Targetable>
    extends WillChangeOptions<T> {
    target: Target<T>;
}

export interface BaseJobOptions {}

export interface JobOptions<T extends Targetable> extends BaseJobOptions<T> {
    target?: Target<T>;
}

export interface StandaloneJobOptions<T extends Targetable>
    extends JobOptions<T> {
    triggers?: TriggerOptions[];
    willChange?: WillChangeOptions[];
}

export function addJob<T extends Targetable>(
    func: JobFunction,
    options: StandaloneJobOptions<T>,
): RegisteredJob;
export function addJob<T extends Targetable>(
    name: string,
    func: JobFunction,
    options: StandaloneJobOptions<T>,
): RegisteredJob;
export function addJob<T extends Targetable>(
    a: string | JobFunction,
    b: JobFunction | StandaloneJobOptions<T>,
    c?: StandaloneJobOptions<T>,
): RegisteredJob {
    let standaloneOptions: StandaloneJobOptions<T>;
    let func: JobFunction;
    let name: string | undefined;
    if (typeof a === "string") {
        standaloneOptions = c as StandaloneJobOptions<T>;
        func = b as JobFunction;
        name = a;
    } else {
        func = a as JobFunction;
        standaloneOptions = b as StandaloneJobOptions<T>;
    }

    const { triggers, willChange, ...options } = standaloneOptions;

    const job = registry.addJob(func, options, name);
    job.addTriggers(...(triggers ?? []));
    job.addWillChange(...(willChange ?? []));

    return job;
}
