import type { Class } from "./common";
import { registry } from "./registry";

export interface ConsumerOptions {
    target: () => Class;
}

export function Consumer<T extends object>(options: ConsumerOptions) {
    return function (cls: Class<T>): Class<T> {
        const consumer = registry.addConsumer(cls, options);
        class ConsumerWrapper extends (cls as Class) {
            constructor(...args: any[]) {
                super(...args);
                if (consumer.instance && consumer.instance.deref()) {
                    console.warn(`${consumer.name} already has an instance`);
                } else {
                    consumer.instance = new WeakRef(this);
                }
            }
        }

        return ConsumerWrapper as Class<T>;
    };
}
