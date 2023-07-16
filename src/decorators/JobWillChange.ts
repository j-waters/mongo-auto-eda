import type { Target, Targetable } from "../common";
import type { ChangeInfo, TargetProps, WillChangeOptions } from "../job";

export function JobWillChange<T extends Targetable>(
    props: TargetProps<T>,
): MethodDecorator;
export function JobWillChange<T extends Targetable>(
    options: WillChangeOptions<T>,
): MethodDecorator;
export function JobWillChange<T extends Targetable>(
    target: Target<T>,
    options?: WillChangeOptions<T>,
): MethodDecorator;
export function JobWillChange<T extends Targetable>(
    targetOrOptionsOrProps: Target<T> | WillChangeOptions<T> | TargetProps<T>,
    options?: WillChangeOptions<T>,
): MethodDecorator {
    return function (
        cls: any,
        propertyKey: string | symbol,
        _descriptor: PropertyDescriptor,
    ) {
        const existingWillChanges =
            (Reflect.getMetadata(
                "willChange",
                cls,
                propertyKey,
            ) as ChangeInfo<Targetable>[]) ?? [];

        let target: Target<T> | undefined;
        if (typeof targetOrOptionsOrProps === "function") {
            target = targetOrOptionsOrProps;
            if (!options) {
                options = {
                    creates: true,
                    updates: true,
                };
            }
        } else if (Array.isArray(targetOrOptionsOrProps)) {
            options = {
                updates: targetOrOptionsOrProps,
            };
        } else {
            options = targetOrOptionsOrProps;
        }

        Reflect.defineMetadata(
            "willChange",
            [...existingWillChanges, { target, ...options }],
            cls,
            propertyKey,
        );
    };
}
