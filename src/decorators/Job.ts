import type { Targetable } from "../common";
import { registry } from "../registry";
import type { BaseJobOptions, ChangeInfo, Trigger } from "../job";

export interface JobDecoratorOptions extends BaseJobOptions {}

export function Job(decoratorOptions?: JobDecoratorOptions): MethodDecorator {
    console.log("register job");
    return function (
        target: any,
        propertyKey: string | symbol,
        descriptor: PropertyDescriptor,
    ) {
        const triggers =
            (Reflect.getMetadata(
                "triggers",
                target,
                propertyKey,
            ) as Trigger<Targetable>[]) ?? [];
        const willChange =
            (Reflect.getMetadata(
                "willChange",
                target,
                propertyKey,
            ) as ChangeInfo<Targetable>[]) ?? [];

        const options = { ...(decoratorOptions ?? {}) };
        const job = registry.addJob(
            descriptor.value,
            options,
            propertyKey.toString(),
            target.constructor,
        );
        job.addTriggers(...triggers);
        job.addExpectedChange(...willChange);
    };
}
