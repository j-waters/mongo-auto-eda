import type { Ref } from "@typegoose/typegoose";
import { index, modelOptions, prop } from "@typegoose/typegoose";
import { ObjectId } from "mongodb";
import type { Base } from "@typegoose/typegoose/lib/defaultClasses";
import { TimeStamps } from "@typegoose/typegoose/lib/defaultClasses";
import type { Types } from "mongoose";
import { JobInitiator } from "./JobInitiator";

export type JobState = "ready" | "complete" | "reserved" | "buried";

@modelOptions({ options: { customName: "jobs" } })
@index({ jobName: 1, itemId: 1 })
@index({ createdAt: 1, checkReadyAttempts: 1 })
export class JobInstance extends TimeStamps implements Base {
    @prop({ type: () => String })
    jobName: string;

    @prop({ type: () => ObjectId })
    entityId: ObjectId;

    @prop({ type: () => String, default: "ready", index: true })
    state: JobState;

    @prop({ type: () => Date })
    reservedAt?: Date;

    @prop({ type: () => Number, default: 0 })
    checkReadyAttempts: number;

    @prop({ type: () => Boolean })
    isBatch?: boolean;

    @prop({ ref: () => JobInitiator })
    initiator: Ref<JobInitiator>;

    _id: Types.ObjectId;
    id: string;
}
