import type { ObjectId } from "mongodb";
import type { Awaitable, Class, Target, Targetable } from "../common";
import { resolveTarget } from "../common";
import type { RegisteredConsumer } from "./RegisteredConsumer";

export interface ReprocessOptions<T extends Targetable = Targetable> {
    target: Target<T>;
}

export type HandlerFunction = () => Awaitable<ObjectId[]>;

export class RegisteredReprocessHandler<T extends Targetable = Targetable> {
    consumer?: RegisteredConsumer<T>;

    constructor(
        public _func: HandlerFunction,
        private options?: ReprocessOptions<T>,
        public consumerClass?: Class,
    ) {}

    registerConsumer(consumer: RegisteredConsumer<T>) {
        this.consumer = consumer;
    }

    get func() {
        return this.bind(this._func);
    }

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

    get target(): Class<T> | undefined {
        if (this.options && "target" in this.options && this.options.target) {
            return resolveTarget(this.options.target);
        }

        if (this.consumer) {
            return this.consumer.target;
        }
    }
}
