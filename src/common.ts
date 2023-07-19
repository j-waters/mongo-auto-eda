import type { ObjectId } from "mongodb";
import { isConstructor } from "@typegoose/typegoose/lib/internal/utils";

export type Targetable = object;

export type Class<T extends object = object> = new (...args: any[]) => T;

export class CurrentJobTargetPlaceholder {}

export type Target<T extends Targetable = Targetable> =
    | Class<T>
    | (() => Class<T>);

export type JobFunction = (entityId: ObjectId) => void | PromiseLike<void>;

// function isConstructor(obj: any): obj is AnyParamConstructor<any> {
//     return (
//         typeof obj === "function" &&
//         !isNullOrUndefined(obj.prototype?.constructor?.name)
//     );
// }

export function resolveTarget<T extends Targetable>(
    target: Target<T>,
): Class<T>;
export function resolveTarget<_T extends Targetable>(
    target: undefined,
): undefined;
export function resolveTarget<T extends Targetable>(
    target: Target<T> | undefined,
): Class<T> | undefined;
export function resolveTarget<T extends Targetable>(
    target: Target<T> | undefined,
): Class<T> | undefined {
    if (isConstructor(target)) {
        return target;
    } else if (typeof target === "function") {
        return target();
    }
}

export const combineIterators = function*<T>(...iterators: Iterable<T>[]) {
    for (const it of iterators) yield* it;
};
