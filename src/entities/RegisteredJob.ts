import type { Class, JobFunction, Targetable } from "../common";
import { CurrentJobTargetPlaceholder, resolveTarget } from "../common";
import type {
    ChangeInfo,
    ExpectedChangeOptions,
    JobOptions,
    Trigger,
    TriggerOptions,
} from "../job";
import type { RegisteredConsumer } from "./RegisteredConsumer";

export class RegisteredJob<T extends Targetable = Targetable> {
    triggerMap: Map<Class<Targetable>, Trigger> = new Map();

    willChangeMap: Map<Class<Targetable>, ChangeInfo> = new Map();

    consumer?: RegisteredConsumer<T>;

    constructor(
        public _func: JobFunction,
        private options: JobOptions<T>,
        private nameOrProp?: string,
        public consumerClass?: Class,
    ) {
        if (!this.name) {
            throw new Error("New job has no name");
        }
    }

    registerConsumer(consumer: RegisteredConsumer<T>) {
        this.consumer = consumer;

        for (const [key, value] of this.triggerMap.entries()) {
            if (key === CurrentJobTargetPlaceholder) {
                this.triggerMap.delete(key);

                value.target = this.target!;
                this.triggerMap.set(value.target, value);
            }
        }

        for (const [key, value] of this.willChangeMap.entries()) {
            if (key === CurrentJobTargetPlaceholder) {
                this.willChangeMap.delete(key);

                value.target = this.target!;
                this.willChangeMap.set(value.target, value);
            }
        }
    }

    get func() {
        return this.bind(this._func);
    }

    // eslint-disable-next-line @typescript-eslint/ban-types
    bind<F extends Function>(func: F): F {
        if (this.consumer && this.consumer.instance) {
            const instance = this.consumer.instance.deref();
            if (instance) {
                func = func.bind(instance);
            } else {
                console.warn(
                    `${this.consumer.name} instance once existed but has been garbage collected`,
                );
            }
        }
        return func;
    }

    get name() {
        if (this.consumer) {
            return `${this.consumer.name}.${this.nameOrProp}`;
        }
        if (this.nameOrProp) {
            return this.nameOrProp;
        }

        return this.func.name;
    }

    get target(): Class<T> | undefined {
        if ("target" in this.options && this.options.target) {
            return resolveTarget(this.options.target);
        }

        if (this.consumer) {
            return this.consumer.target;
        }
    }

    get batch() {
        return this.options.batch;
    }

    addTriggers(...triggers: TriggerOptions[]) {
        for (const trigger of triggers) {
            const target =
                resolveTarget(trigger.target) ??
                this.target ??
                CurrentJobTargetPlaceholder;

            if (
                target !== this.target &&
                target !== CurrentJobTargetPlaceholder &&
                !trigger.transformer &&
                !this.batch
            ) {
                throw new Error(
                    `Registering trigger ${JSON.stringify(trigger)} for job ${
                        this.name
                    }, and the targets don't align (${trigger.target} vs ${
                        this.target
                    }). Add a transformer to the trigger`,
                );
            }

            const existing = this.triggerMap.get(target);
            if (!existing) {
                this.triggerMap.set(target, { target, ...trigger });
                continue;
            }

            if (trigger.onUpdate) {
                if (typeof trigger.onUpdate === "boolean") {
                    existing.onUpdate = trigger.onUpdate;
                } else if (!existing.onUpdate) {
                    existing.onUpdate = trigger.onUpdate;
                } else if (Array.isArray(existing.onUpdate)) {
                    existing.onUpdate.push(...trigger.onUpdate);
                }
            }

            existing.onCreate ??= trigger.onCreate;
            existing.onRemove ??= trigger.onRemove;
        }
    }

    addExpectedChange(...willChanges: ExpectedChangeOptions[]) {
        for (const change of willChanges) {
            const target =
                resolveTarget(change.target) ??
                this.target ??
                CurrentJobTargetPlaceholder;

            const existing = this.willChangeMap.get(target);
            if (!existing) {
                this.willChangeMap.set(target, { target, ...change });
                continue;
            }

            if (change.updates) {
                if (typeof change.updates === "boolean") {
                    existing.updates = change.updates;
                } else if (!existing.updates) {
                    existing.updates = change.updates;
                } else if (Array.isArray(existing.updates)) {
                    existing.updates.push(...change.updates);
                }
            }

            existing.creates ??= change.creates;
            existing.removes ??= change.removes;
        }
    }

    // Checks if the given change matches any of our triggers
    isTriggered(change: ChangeInfo): boolean {
        const target = resolveTarget(change.target);
        if (!target) {
            return false;
        }

        const trigger = this.triggerMap.get(target);
        if (!trigger) {
            return false;
        }

        return changeAndTriggerOverlap(change, trigger);
    }

    // Checks if the given trigger will be matched by any of our changes
    willTrigger(trigger: Trigger): boolean {
        const target = resolveTarget(trigger.target);
        if (!target) {
            return false;
        }

        const change = this.willChangeMap.get(target);
        if (!change) {
            return false;
        }

        return changeAndTriggerOverlap(change, trigger);
    }

    isTriggeredByJob(job: RegisteredJob): boolean {
        for (const trigger of this.triggerMap.values()) {
            if (job.willTrigger(trigger)) {
                return true;
            }
        }

        return false;
    }

    willTriggerJob(job: RegisteredJob): boolean {
        for (const change of this.willChangeMap.values()) {
            if (job.isTriggered(change)) {
                return true;
            }
        }

        return false;
    }
}

function hasOverlap<T>(arr1: T[], arr2: T[]): boolean {
    return arr1.some((element) => arr2.includes(element));
}

function changeAndTriggerOverlap<T extends Targetable>(
    change: ChangeInfo<T>,
    trigger: Trigger<T>,
): boolean {
    if (change.creates && trigger.onCreate) {
        return true;
    }

    if (change.removes && trigger.onRemove) {
        return true;
    }

    if (change.updates && trigger.onUpdate) {
        if (change.updates === true || trigger.onUpdate === true) {
            return true;
        }

        if (hasOverlap(change.updates, trigger.onUpdate)) {
            return true;
        }
    }

    return false;
}
