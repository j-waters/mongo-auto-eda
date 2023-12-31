import type { ChangeStreamDocument } from "mongodb";
import type { DocumentType } from "@typegoose/typegoose";
import type { Document } from "mongoose";
import { registry } from "./registry";
import type { Awaitable, JobFunction, Target, Targetable } from "./common";
import type { RegisteredJob } from "./entities/RegisteredJob";
import type { HasId } from "./util";

export type TargetProps<T extends Targetable = Targetable> = (
    | keyof T
    | string
)[];

export interface ChangeEvent<T extends Targetable> {
    changeStreamEvent: ChangeStreamDocument<Document<T>>;
    type: ChangeStreamDocument<Document<T>>["operationType"];
    modifiedFields: (keyof T | string)[];
}

export type TransformerFunc<T extends Targetable> = (
    entity: DocumentType<T>,
    event: ChangeEvent<T>,
) => Awaitable<HasId | HasId[] | undefined | void>;

export interface TriggerOptions<T extends Targetable = Targetable> {
    onUpdate?: TargetProps<T> | boolean;
    onCreate?: boolean;
    onRemove?: boolean;
    target?: Target<T>;
    transformer?: TransformerFunc<T>;
}

export interface Trigger<T extends Targetable = Targetable>
    extends TriggerOptions<T> {
    target: Target<T>;
}

export interface ExpectedChangeOptions<T extends Targetable = Targetable> {
    updates?: TargetProps<T> | boolean;
    creates?: boolean;
    removes?: boolean;
    target?: Target<T>;
}

export interface ChangeInfo<T extends Targetable = Targetable>
    extends ExpectedChangeOptions<T> {
    target: Target<T>;
}

export interface BaseJobOptions<T extends Targetable> {
    batch?: boolean;
    target?: Target<T>;
}

export interface JobOptions<T extends Targetable> extends BaseJobOptions<T> {}

export interface StandaloneJobOptions<T extends Targetable>
    extends JobOptions<T> {
    triggers?: TriggerOptions[];
    expectedChanges?: ExpectedChangeOptions[];
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

    const { triggers, expectedChanges, ...options } = standaloneOptions;

    const job = registry.addJob(func, options, name);
    job.addTriggers(...(triggers ?? []));
    job.addExpectedChange(...(expectedChanges ?? []));

    return job;
}
