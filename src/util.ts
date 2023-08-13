import type { Ref } from "@typegoose/typegoose";
import { ObjectId } from "mongodb";
import type { Types } from "mongoose";

export type HasId =
    | Ref<{ id: string }>
    | Ref<{ _id: ObjectId }>
    | { id: string }
    | { id: ObjectId }
    | ObjectId
    | string;

export function getId(doc: null | undefined): undefined;
export function getId(doc: HasId): ObjectId;
export function getId(doc: HasId | null | undefined): ObjectId | undefined;
export function getId(
    doc: Ref<{ id: string }, Types.ObjectId | undefined>,
): ObjectId | undefined;
export function getId(doc: HasId | null | undefined): ObjectId | undefined {
    if (!doc) {
        return undefined;
    }
    if (doc instanceof ObjectId) {
        return doc;
    }
    if (typeof doc === "string") {
        return new ObjectId(doc);
    }
    if (typeof doc === "object") {
        if ("id" in doc) {
            return getId(doc.id);
        } else if ("_id" in doc) {
            return getId(doc._id);
        }
    }
    throw new Error(`Cannot get id from ${JSON.stringify(doc)}`);
}

export function getIds(docs?: HasId | HasId[] | void): ObjectId[] {
    if (!docs) {
        return [];
    }
    if (!Array.isArray(docs)) {
        return [getId(docs)];
    }
    return docs.map((doc) => getId(doc));
}
