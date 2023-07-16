export * from "./registry";
export * from "./decorators/Consumer";
export * from "./job";
export { JobTrigger } from "./decorators/JobTrigger";
export { Job } from "./decorators/Job";

export class JobManager {
    register() {
        console.log("register");
    }
}
