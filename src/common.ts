import type { ObjectId } from "mongodb";

export type Class<T extends object = object> = new (...args: any[]) => T;

export type JobFunction = (entityId: ObjectId) => void;
