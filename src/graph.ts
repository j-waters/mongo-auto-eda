import { analyzeGraph } from "graph-cycles";
import type { RegisteredJob } from "./entities/RegisteredJob";

export interface JobNode {
    job: RegisteredJob;
    willTriggerSpecific: string[];
    willTriggerAny: string[];
    triggeredBySpecific: string[];
    triggeredByAny: string[];
}

export class JobGraph {
    jobNodes = new Map<string, JobNode>();

    constructor(jobs: RegisteredJob[]) {
        for (const job of jobs) {
            const node: JobNode = {
                job,
                willTriggerSpecific: [],
                willTriggerAny: [],
                triggeredBySpecific: [],
                triggeredByAny: [],
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
                    if (job.target === otherJob.target) {
                        node.willTriggerSpecific.push(otherJob.name);
                    } else {
                        node.willTriggerAny.push(otherJob.name);
                    }
                }
                if (triggeredBy) {
                    if (job.target === otherJob.target) {
                        node.triggeredBySpecific.push(otherJob.name);
                    } else {
                        node.triggeredByAny.push(otherJob.name);
                    }
                }
            }
            this.jobNodes.set(job.name, node);
        }

        let res = analyzeGraph(
            [...this.jobNodes.values()].map((n) => [
                n.job.name,
                n.willTriggerAny,
            ]),
        );
        if (res.cycles.length > 0) {
            console.warn("Job cycles detected (willTriggerAny):", res.cycles);
        }

        res = analyzeGraph(
            [...this.jobNodes.values()].map((n) => [
                n.job.name,
                n.willTriggerSpecific,
            ]),
        );
        if (res.cycles.length > 0) {
            console.warn(
                "Job cycles detected (willTriggerSpecific):",
                res.cycles,
            );
        }
    }

    get(job: RegisteredJob) {
        return this.jobNodes.get(job.name);
    }

    toDot() {
        let out = "digraph {\n";

        for (const job of this.jobNodes.values()) {
            for (const willTriggerSpecific of job.willTriggerSpecific) {
                out += `  "${job.job.name}" -> "${willTriggerSpecific}" [label=specific]\n`;
            }
            for (const willTriggerAny of job.willTriggerAny) {
                out += `  edge [style=dashed]\n  "${job.job.name}" -> "${willTriggerAny}" [label=any]\n`;
            }

            if (
                job.willTriggerSpecific.length + job.willTriggerAny.length ===
                0
            ) {
                out += `  "${job.job.name}"\n`;
            }
        }

        out += `}`;

        return out;
    }
}
