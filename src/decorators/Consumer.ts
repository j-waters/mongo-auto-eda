import type { Class, Target, Targetable } from "../common";
import { registry } from "../registry";
import "reflect-metadata";

export interface ConsumerOptions<T extends Targetable> {
    target: Target<T>;
}

export function Consumer<T extends Targetable>(
    optionsOrTarget: ConsumerOptions<T> | Target<T>,
): ClassDecorator {
    let options: ConsumerOptions<T>;
    if (typeof optionsOrTarget === "object") {
        options = optionsOrTarget;
    } else {
        options = {
            target: optionsOrTarget,
        };
    }

    return function<TClass extends object>(cls: TClass) {
        const consumer = registry.addConsumer(cls as Class<object>, options);
        Reflect.defineMetadata("target", options.target, cls);
        return class extends (cls as Class) {
            constructor(...args: any[]) {
                super(...args);
                if (consumer.instance && consumer.instance.deref()) {
                    console.warn(`${consumer.name} already has an instance`);
                } else {
                    consumer.instance = new WeakRef(this);
                }
            }
        } as TClass;
    };
}
