import { getModelForClass } from "@typegoose/typegoose";
import { JobInitiator } from "./JobInitiator";
import { JobInstance } from "./JobInstance";

export { JobInitiator } from "./JobInitiator";
export { JobInstance } from "./JobInstance";
export type { JobState } from "./JobInstance";
export { RegisteredConsumer } from "./RegisteredConsumer";
export { RegisteredJob } from "./RegisteredJob";

export const JobInitiatorModel = getModelForClass(JobInitiator);
export const JobInstanceModel = getModelForClass(JobInstance);
