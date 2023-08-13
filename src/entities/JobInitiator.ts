import type { Base } from "@typegoose/typegoose/lib/defaultClasses";
import type { Ref, mongoose } from "@typegoose/typegoose";
import { PropType, prop } from "@typegoose/typegoose";
import type { Types } from "mongoose";
import { TimeStamps } from "@typegoose/typegoose/lib/defaultClasses";
import type { ChangeInfo } from "../job";
import type { Target } from "../common";
import { resolveTarget } from "../common";
import { JobInstance } from "./JobInstance";

export class JobInitiator extends TimeStamps implements Base {
    constructor(
        opts:
            | { change: ChangeInfo }
            | { name: string }
            | { reprocessing: Target | undefined },
    ) {
        super();
        if ("change" in opts) {
            const change = opts.change;
            this.target = resolveTarget(change.target).name;
            this.created = !!change.creates;
            this.deleted = !!change.removes;
            this.updated = (
                Array.isArray(change.updates) ? change.updates : []
            ) as mongoose.Types.Array<string>;

            this.name = `<${this.target}>(`;
            this.name += (["created", "updated", "deleted"] as const)
                .flatMap((prop) => {
                    const val = this[prop];
                    if (
                        (val && !Array.isArray(val)) ||
                        (Array.isArray(val) && val.length)
                    ) {
                        return [
                            `${prop}: ${
                                Array.isArray(val) ? `[${val.join(", ")}]` : val
                            }`,
                        ];
                    }
                    return [];
                })
                .join(", ");
            this.name += ")";
        } else if ("name" in opts) {
            this.name = opts.name;
        } else {
            if (opts.reprocessing) {
                this.target = resolveTarget(opts.reprocessing).name;
                this.name = `reprocessing<${this.target}>`;
            } else {
                this.name = `reprocessing`;
            }
        }
    }

    @prop({ type: () => String })
    name: string;

    @prop({ type: () => String })
    target?: string;

    @prop({ type: () => Boolean })
    created?: boolean;

    @prop({ type: () => Boolean })
    deleted?: boolean;

    @prop({ type: () => Boolean })
    reprocessing?: boolean;

    @prop({ type: () => [String] }, PropType.ARRAY)
    updated?: string[];

    @prop({
        ref: () => {
            console.log(">>", JobInstance);
            return JobInstance;
        },
        foreignField: "initiator",
        localField: "_id",
    })
    jobs: Ref<JobInstance>[];

    _id: Types.ObjectId;
    id: string;
}
