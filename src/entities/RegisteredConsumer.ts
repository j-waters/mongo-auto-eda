import type { Class, Targetable } from "../common";
import type { ConsumerOptions } from "../decorators/Consumer";
import { registry } from "../registry";
import { resolveTarget } from "../common";

export class RegisteredConsumer<T extends Targetable = Targetable> {
    instance?: WeakRef<object>;

    constructor(public cls: Class, public options: ConsumerOptions<T>) {}

    get name() {
        return `${this.cls.name}<${this.target?.name}>`;
    }

    get jobs() {
        return registry.jobs.filter((j) => j.consumerClass === this.cls);
    }

    get target() {
        return resolveTarget(this.options.target);
    }
}
