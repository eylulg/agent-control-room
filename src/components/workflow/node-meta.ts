import type { BadgeColor } from '@eylulg/ui/badge';
import {
  Flag,
  GitBranch,
  Hammer,
  Hourglass,
  ListChecks,
  MessageSquareText,
  ShieldCheck,
  Signpost,
  TestTube,
  UserCheck,
  Zap,
} from 'lucide-react';
import type { NodeRunState } from '@/domain/workflow/overlay';
import type { NodeType } from '@/domain/workflow/types';

export const NODE_ICON: Record<NodeType, typeof Zap> = {
  trigger: Zap,
  plan: ListChecks,
  approval: UserCheck,
  implement: Hammer,
  ci: TestTube,
  review: MessageSquareText,
  condition: GitBranch,
  'wait-dependency': Hourglass,
  guard: ShieldCheck,
  'mark-ready': Signpost,
  end: Flag,
};

export const RUN_STATE: Record<NodeRunState, { label: string; color: BadgeColor }> = {
  idle: { label: 'Idle', color: 'gray' },
  running: { label: 'Running', color: 'brand' },
  waiting: { label: 'Waiting', color: 'warning' },
  passed: { label: 'Passed', color: 'success' },
  failed: { label: 'Failed', color: 'error' },
  skipped: { label: 'Skipped', color: 'gray' },
};
