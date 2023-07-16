import {
    getModelForClass,
    index,
    modelOptions,
    prop,
} from "@typegoose/typegoose";
import { ObjectId } from "mongodb";

export type JobState = "ready" | "complete" | "reserved" | "buried";

@modelOptions({ options: { customName: "jobs" } })
@index({ jobName: 1, itemId: 1 })
@index({ createdAt: 1, checkReadyAttempts: 1 })
export class JobInstance {
    @prop({ type: () => String })
    jobName!: string;

    @prop({ type: () => ObjectId })
    entityId!: ObjectId;

    @prop({ type: () => String, default: "ready", index: true })
    state!: JobState;

    @prop({ type: () => Date, default: () => new Date() })
    createdAt!: Date;

    @prop({ type: () => Date })
    reservedAt?: Date;

    @prop({ type: () => Number, default: 0 })
    checkReadyAttempts!: number;
}

export const JobInstanceModel = getModelForClass(JobInstance);
