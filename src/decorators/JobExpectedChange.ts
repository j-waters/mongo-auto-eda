import type { Target, Targetable } from "../common";
import type { ChangeInfo, ExpectedChangeOptions, TargetProps } from "../job";

export function JobExpectedChange<T extends Targetable>(
    props: TargetProps<T>,
): MethodDecorator;
export function JobExpectedChange<T extends Targetable>(
    options: ExpectedChangeOptions<T>,
): MethodDecorator;
export function JobExpectedChange<T extends Targetable>(
    target: Target<T>,
    options?: ExpectedChangeOptions<T>,
): MethodDecorator;
export function JobExpectedChange<T extends Targetable>(
    targetOrOptionsOrProps:
        | Target<T>
        | ExpectedChangeOptions<T>
        | TargetProps<T>,
    options?: ExpectedChangeOptions<T>,
): MethodDecorator {
    return function (
        cls: any,
        propertyKey: string | symbol,
        _descriptor: PropertyDescriptor,
    ) {
        const existingExpectedChanges =
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
            [...existingExpectedChanges, { target, ...options }],
            cls,
            propertyKey,
        );
    };
}
