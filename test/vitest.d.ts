import type { Assertion, AsymmetricMatchersContaining } from "vitest";
import { Target, Targetable } from "../src/common";

interface CustomMatchers<R = unknown> {
    instance<T>(expected: T): T;
    target<T extends Target<Targetable>>(expected: T): T;
}

declare module "vitest" {
    interface Assertion<T = any> extends CustomMatchers<T> {}
    interface AsymmetricMatchersContaining extends CustomMatchers {}
}
