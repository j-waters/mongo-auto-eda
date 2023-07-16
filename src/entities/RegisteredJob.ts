import type { Class, JobFunction } from "../common";
import type { JobOptions, StandaloneJobOptions } from "../job";
import { registry } from "../registry";
import type { RegisteredConsumer } from "./RegisteredConsumer";

export class RegisteredJob<T = any> {
    constructor(
        public func: JobFunction<T>,
        public options: JobOptions<T> | StandaloneJobOptions<T>,
        private nameOrProp?: string,
        public parentClass?: Class,
    ) {}

    get consumer(): RegisteredConsumer | undefined {
        return registry.consumers.find((c) => c.cls === this.parentClass);
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

    get target() {
        if (this.consumer) {
            return this.consumer.options.target;
        }
        if ("target" in this.options) {
            return this.options.target;
        }
    }
}
