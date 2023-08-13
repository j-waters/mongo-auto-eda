import type {
    ChangeStreamDeleteDocument,
    ChangeStreamDocument,
    ChangeStreamInsertDocument,
    ChangeStreamUpdateDocument,
    ObjectId,
} from "mongodb";
import type { DocumentType } from "@typegoose/typegoose";
import { getClass, mongoose } from "@typegoose/typegoose";
import type { Document } from "mongoose";
import { registry } from "./registry";
import type { Class, Targetable } from "./common";
import type { ChangeInfo } from "./job";
import { JobManager } from "./manager";
import type { RegisteredJob } from "./entities";
import { getIds } from "./util";

import { JobInitiator, JobInitiatorModel } from "./entities";

// TODO: handle multiple triggers of the same type, so that
// different transformers can be run for different updates

// interface ChangeEvent<T> {
//     operationType: "insert";
//     fullDocument: T;
// }

export class Watcher {
    registry = registry;

    manager = new JobManager();

    stopCallback?: () => void;
    changeStream?: mongoose.mongo.ChangeStream<
        any,
        mongoose.mongo.ChangeStreamDocument<any>
    >;

    constructor(
        private connection: mongoose.Connection = mongoose.connection,
        private dryrun = false,
    ) {}

    async start() {
        if (this.stopCallback) {
            throw new Error("Watcher already running");
        }

        console.info(
            `Starting watcher with ${registry.jobs.length} registered`,
        );

        console.log(registry.graph.toDot());

        this.changeStream = this.connection.watch(undefined, {
            fullDocumentBeforeChange: "whenAvailable",
        });

        this.changeStream.on("change", (event) => {
            this.onChange(event);
        });

        return new Promise<void>((resolve) => {
            this.stopCallback = resolve;
        });
    }

    async stop() {
        if (!this.stopCallback || !this.changeStream) {
            return;
        }

        await this.changeStream.close();
        this.stopCallback();

        this.stopCallback = undefined;
        this.changeStream = undefined;
    }

    private async onChange<T extends Targetable>(
        event: ChangeStreamDocument<Document<T>>,
    ) {
        // console.log(event);
        if (!checkEvent(event)) {
            return;
        }

        const model = this.getModel(event);
        if (!model) {
            console.warn("No model found", event);
            return;
        }

        const target = this.getTarget(model, event);
        if (!target) {
            console.warn("No target found", event);
            return;
        }

        const entityId = event.documentKey._id as ObjectId;

        const changeInfo: ChangeInfo<Targetable> = {
            target,
        };
        switch (event.operationType) {
            case "insert":
                changeInfo.creates = true;
                break;
            case "update":
                changeInfo.updates = generateModifiedFields(
                    event.updateDescription.updatedFields,
                );
                break;
            case "delete":
                changeInfo.removes = true;
        }

        const jobs = this.registry.getTriggeredJobs(changeInfo);

        if (jobs.length === 0) {
            return [];
        }

        const initiator = await JobInitiatorModel.create(
            new JobInitiator({ change: changeInfo }),
        );

        return Promise.all(
            jobs.map(async (job) => {
                const entityIds = await this.applyTriggerTransformer(
                    job,
                    target,
                    model,
                    entityId,
                    event,
                );
                if (this.dryrun) {
                    console.info(
                        `Would have run job ${
                            job.name
                        } with entity IDs ${entityIds.join(", ")}`,
                    );
                } else {
                    return this.manager.queue(job.name, initiator, entityIds);
                }
            }),
        );
    }

    private async applyTriggerTransformer<T extends Targetable>(
        job: RegisteredJob,
        resolvedTarget: Class<T>,
        model: mongoose.Model<T>,
        entityId: ObjectId,
        event: ChangeStreamDocument<Document<T>>,
    ): Promise<ObjectId[]> {
        const trigger = job.triggerMap.get(resolvedTarget);
        if (!trigger) {
            throw new Error(`Missing trigger for target ${resolvedTarget}`);
        }

        if (!("transformer" in trigger && trigger.transformer)) {
            if (resolvedTarget === job.target) {
                return [entityId];
            }

            throw new Error(`Trigger for missing transformer`);
        }

        let entity: DocumentType<any> | undefined;
        if ("fullDocument" in event) {
            entity = event.fullDocument;
        } else if ("fullDocumentBeforeChange" in event) {
            entity = event.fullDocumentBeforeChange;
        }

        if (entity) {
            entity = model.hydrate(entity);
        }

        if (!entity && event.operationType !== "delete") {
            entity = await model.findById(entityId);
        }

        const res = await job.bind(trigger.transformer)(entity, {
            changeStreamEvent: event,
            type: event.operationType,
            modifiedFields:
                event.operationType === "update"
                    ? generateModifiedFields(
                          event.updateDescription.updatedFields,
                      )
                    : [],
        });
        return getIds(res);
    }

    private getModel<T extends Targetable>(
        event: ChangeStreamDocument,
    ): mongoose.Model<T> | undefined {
        if (!checkEvent(event)) {
            return;
        }

        return Object.values(this.connection.models).find(
            (m) => m.collection.collectionName === event.ns.coll,
        );
    }

    private getTarget<T extends Targetable>(
        model: mongoose.Model<T>,
        event: ChangeStreamDocument,
    ): Class<T> | undefined {
        const target = getClass(model.modelName);
        if (!target) {
            console.warn("No target found", event, model);
            return;
        }

        return target as Class<T>;
    }
}

function checkEvent(
    event: ChangeStreamDocument,
): event is
    | ChangeStreamInsertDocument
    | ChangeStreamUpdateDocument
    | ChangeStreamDeleteDocument {
    switch (event.operationType) {
        case "insert":
        case "update":
        case "delete":
            return true;
        default:
            return false;
    }
}

export function generateModifiedFields(
    updated?: Record<string, unknown>,
): string[] {
    if (!updated) {
        return [];
    }

    const fields = Object.keys(updated);
    for (const field of fields) {
        if (field.includes(".")) {
            const parts = field.split(".");
            fields.push(parts.slice(0, -1).join("."));
        }
    }

    return fields;
}
