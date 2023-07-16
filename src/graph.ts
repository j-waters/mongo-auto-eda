import { analyzeGraph } from "graph-cycles";
import type { RegisteredJob } from "./entities/RegisteredJob";

export interface JobNode {
    job: RegisteredJob;
    willTrigger: string[];
    triggeredBy: string[];
}

export class JobGraph {
    jobNodes = new Map<string, JobNode>();

    constructor(jobs: RegisteredJob[]) {
        for (const job of jobs) {
            const node: JobNode = {
                job,
                willTrigger: [],
                triggeredBy: [],
            };
            for (const otherJob of jobs) {
                if (job === otherJob) {
                    continue;
                }

                const willTrigger = job.willTriggerJob(otherJob);
                const triggeredBy = job.isTriggeredByJob(otherJob);
                if (willTrigger && triggeredBy) {
                    throw new Error(
                        `${job.name} and ${otherJob.name} both trigger each other`,
                    );
                }

                if (willTrigger) {
                    node.willTrigger.push(otherJob.name);
                }
                if (triggeredBy) {
                    node.triggeredBy.push(otherJob.name);
                }
            }
            this.jobNodes.set(job.name, node);
        }

        const res = analyzeGraph(
            [...this.jobNodes.values()].map((n) => [n.job.name, n.willTrigger]),
        );
        if (res.cycles.length > 0) {
            console.warn("Job cycles detected:", res.cycles);
        }
    }

    get(job: RegisteredJob) {
        return this.jobNodes.get(job.name);
    }
}
