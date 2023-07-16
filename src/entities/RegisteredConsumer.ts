import type { Class } from "../common";
import type { ConsumerOptions } from "../consumer";
import { registry } from "../registry";

export class RegisteredConsumer {
    instance?: WeakRef<object>;

    constructor(public cls: Class, public options: ConsumerOptions) {}

    get name() {
        return `${this.cls.name}<${this.options.target().name}>`;
    }

    get jobs() {
        return registry.jobs.filter((j) => j.parentClass === this.cls);
    }
}
