import type { Class, Target, Targetable } from "../common";
import { registry } from "../registry";
import "reflect-metadata";

export interface ConsumerOptions<T extends Targetable> {
    target: Target<T>;
}

export function Consumer<ConsumerClass extends object, T extends Targetable>(
    options: ConsumerOptions<T>,
) {
    return function (cls: Class<ConsumerClass>): Class<ConsumerClass> {
        console.log("REGISTER CONSUMER");
        const consumer = registry.addConsumer(cls, options);
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
        } as Class<ConsumerClass>;
    };
}
