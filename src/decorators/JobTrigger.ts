import type { Target, Targetable } from "../common";
import type { TargetProps, Trigger, TriggerOptions } from "../job";

export function JobTrigger<T extends Targetable>(
    props: TargetProps<T>,
): MethodDecorator;
export function JobTrigger<T extends Targetable>(
    options: TriggerOptions<T>,
): MethodDecorator;
export function JobTrigger<T extends Targetable>(
    target: Target<T>,
    options?: TriggerOptions<T>,
): MethodDecorator;
export function JobTrigger<T extends Targetable>(
    targetOrOptionsOrProps: Target<T> | TriggerOptions<T> | TargetProps<T>,
    options?: TriggerOptions<T>,
): MethodDecorator {
    return function (
        cls: any,
        propertyKey: string | symbol,
        _descriptor: PropertyDescriptor,
    ) {
        const existingTriggers =
            (Reflect.getMetadata("triggers", cls, propertyKey) as Trigger[]) ??
            [];

        let target: Target<T> | undefined;
        if (typeof targetOrOptionsOrProps === "function") {
            target = targetOrOptionsOrProps;
            if (!options) {
                options = {
                    onRemove: true,
                    onCreate: true,
                    onUpdate: true,
                };
            }
        } else if (Array.isArray(targetOrOptionsOrProps)) {
            options = {
                onCreate: true,
                onUpdate: targetOrOptionsOrProps,
            };
        } else {
            options = targetOrOptionsOrProps;
        }

        Reflect.defineMetadata(
            "triggers",
            [...existingTriggers, { target, ...options }],
            cls,
            propertyKey,
        );
    };
}
