import { registry } from "../registry";

export function Reprocess(): MethodDecorator {
    return function (
        target: any,
        propertyKey: string | symbol,
        descriptor: PropertyDescriptor,
    ) {
        registry.addReprocessHandler(
            descriptor.value,
            undefined,
            target.constructor,
        );
    };
}
