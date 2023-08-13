import type { Target, Targetable } from "../common";
import type {
    TargetProps,
    TransformerFunc,
    Trigger,
    TriggerOptions,
} from "../job";

export function JobTrigger<_T extends Targetable>(): MethodDecorator;
export function JobTrigger<T extends Targetable>(
    props: TargetProps<T>,
): MethodDecorator;
export function JobTrigger<T extends Targetable>(
    options: TriggerOptions<T>,
): MethodDecorator;
export function JobTrigger<T extends Targetable>(
    target: Target<T>,
    options: TriggerOptions<T> | TransformerFunc<T>,
): MethodDecorator;
export function JobTrigger<T extends Targetable>(
    target: Target<T>,
    props: TargetProps<T>,
    transformer?: TransformerFunc<T>,
): MethodDecorator;
export function JobTrigger<T extends Targetable>(
    targetOrOptionsOrProps?: Target<T> | TriggerOptions<T> | TargetProps<T>,
    optionsOrPropsOrTransformer?:
        | TriggerOptions<T>
        | TargetProps<T>
        | TransformerFunc<T>,
    transformer?: TransformerFunc<T>,
): MethodDecorator {
    return function (
        cls: any,
        propertyKey: string | symbol,
        _descriptor: PropertyDescriptor,
    ) {
        const existingTriggers =
            (Reflect.getMetadata("triggers", cls, propertyKey) as Trigger[]) ??
            [];

        let options: TriggerOptions<T>;
        if (Array.isArray(targetOrOptionsOrProps)) {
            options = {
                onCreate: true,
                onUpdate: targetOrOptionsOrProps,
            };
        } else if (typeof targetOrOptionsOrProps === "function") {
            options = {
                target: targetOrOptionsOrProps,
            };
            if (Array.isArray(optionsOrPropsOrTransformer)) {
                options.onUpdate = optionsOrPropsOrTransformer;
                options.transformer = transformer;
            } else if (typeof optionsOrPropsOrTransformer === "function") {
                options.transformer = optionsOrPropsOrTransformer;
                options = {
                    ...options,
                    onUpdate: true,
                    onCreate: true,
                    onRemove: true,
                };
            } else {
                options = { ...options, ...optionsOrPropsOrTransformer };
            }
        } else if (targetOrOptionsOrProps) {
            options = targetOrOptionsOrProps;
        } else {
            options = {
                onUpdate: true,
                onCreate: true,
                onRemove: true,
            };
        }

        // let options: TriggerOptions<T> | undefined;
        // if (Array.isArray(optionsOrProps)) {
        //     options = { onCreate: true, onUpdate: optionsOrProps };
        // } else {
        //     options = optionsOrProps;
        // }
        //
        // let target: Target<T> | undefined;
        // if (typeof targetOrOptionsOrProps === "function") {
        //     target = targetOrOptionsOrProps;
        //     if (!options) {
        //         options = {
        //             onRemove: true,
        //             onCreate: true,
        //             onUpdate: true,
        //         };
        //     }
        // } else if (Array.isArray(targetOrOptionsOrProps)) {
        //     options = {
        //         onCreate: true,
        //         onUpdate: targetOrOptionsOrProps,
        //     };
        // } else {
        //     options = targetOrOptionsOrProps;
        // }
        //
        // if (!options) {
        //     options = {
        //         onUpdate: true,
        //         onCreate: true,
        //         onRemove: true,
        //     };
        // }

        Reflect.defineMetadata(
            "triggers",
            [...existingTriggers, options],
            cls,
            propertyKey,
        );
    };
}
