import type { HttpClient } from "@/core/http/httpClient";

import { endpoints } from "./endpoints";
import { callEndpoint } from "./request";
import type { JobAccepted, Page, ReviewAccepted, ReviewSubmission, TaskDetail, TaskStatus, TaskSummary } from "./types";

export interface TaskFilters {
  status?: TaskStatus | "";
  domain?: string;
}

/** Fila de curadoria, revisão e publicação. Operações longas devolvem `job_id`. */
export interface CurationApi {
  list(filters: TaskFilters, page: Page): Promise<TaskSummary[]>;
  get(taskId: number): Promise<TaskDetail>;
  start(taskId: number): Promise<JobAccepted>;
  review(taskId: number, submission: ReviewSubmission): Promise<ReviewAccepted>;
  publish(taskId: number): Promise<{ publication_id: number }>;
}

export function createCurationApi(http: HttpClient): CurationApi {
  return {
    list: (filters, page) =>
      callEndpoint(http, endpoints.tasks, {}, {
        query: { status: filters.status, domain: filters.domain, page: page.page, page_size: page.pageSize },
      }),
    get: (taskId) => callEndpoint(http, endpoints.task, { task_id: taskId }),
    start: (taskId) => callEndpoint(http, endpoints.taskStart, { task_id: taskId }),
    review: (taskId, submission) => callEndpoint(http, endpoints.taskReview, { task_id: taskId }, { json: submission }),
    publish: (taskId) => callEndpoint(http, endpoints.taskPublish, { task_id: taskId }),
  };
}
