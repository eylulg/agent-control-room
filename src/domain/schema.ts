import { z } from 'zod/mini';
import type { OperatorCommand } from './types';
import { workflowSchema } from './workflow/schema';

export const optionKey = z.enum(['A', 'B']);
export const guardAction = z.enum(['merge', 'mark-ready', 'skip-hooks', 'post-as-owner']);
export const routingTable = z.object({
  feature: z.string(),
  bug: z.string(),
  chore: z.string(),
  'review-fix': z.string(),
  release: z.string(),
});

export const operatorCommand: z.ZodMiniType<OperatorCommand> = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('approval.answer'),
    approvalId: z.string(),
    option: optionKey,
    note: z.optional(z.string()),
  }),
  z.object({ type: z.literal('job.hold'), jobId: z.string(), reason: z.string() }),
  z.object({ type: z.literal('job.resume'), jobId: z.string() }),
  z.object({ type: z.literal('job.cancel'), jobId: z.string() }),
  z.object({ type: z.literal('job.retry'), jobId: z.string() }),
  z.object({ type: z.literal('routing.set'), routing: routingTable }),
  z.object({ type: z.literal('guard.toggle'), guardId: z.string(), enabled: z.boolean() }),
  z.object({ type: z.literal('workflow.publish'), workflow: workflowSchema }),
]);
