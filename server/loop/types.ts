export type PMRole = 'ux' | 'feature';
export type DevId = 'dev1' | 'dev2';

// ── PM Analysis ──────────────────────────────────────────────────────────────

export interface ProposalItem {
  id: string;
  title: string;
  description: string;
  files?: string[];
  effort: 'small' | 'medium' | 'large';
  impact: 'high' | 'medium' | 'low';
  rationale: string;
}

export interface PMAnalysis {
  score: number;           // 0-10, current product quality
  assessment: string;
  top_issues: string[];
  proposals: ProposalItem[];
}

// ── PM Debate ────────────────────────────────────────────────────────────────

export interface PMDebateResponse {
  agreements: string[];   // ids of the other PM's proposals they agree with
  disputes: Array<{ id: string; reason: string; counter?: string }>;
  additions: Omit<ProposalItem, 'id'>[];
  priority_order: string[]; // ordered list of all accepted proposal ids
}

// ── Requirements (consensus) ─────────────────────────────────────────────────

export interface RequirementItem {
  id: string;
  title: string;
  description: string;
  files_to_modify: string[];
  acceptance_criteria: string[];
}

export interface LoopRequirements {
  requirements: RequirementItem[];
  this_iteration: string[];   // top 1-3 requirement ids for THIS iteration
  iteration_goal: string;
}

// ── Developer Pair ───────────────────────────────────────────────────────────

export interface FileChange {
  file: string;
  content: string;   // complete new file content
  description: string;
}

export interface DevImplementation {
  changes: FileChange[];
  summary: string;
  implemented_requirements: string[];
  unimplemented: string[];
}

export interface DevReview {
  approved_files: string[];          // files from implementer that are good as-is
  refined_changes: FileChange[];     // files with reviewer improvements applied
  feedback: string;
  issues_found: string[];
  overall_quality: 'approved' | 'needs_revision';
}

// ── Test Phase ───────────────────────────────────────────────────────────────

export interface TestResult {
  passed: number;
  failed: number;
  skipped: number;
  success: boolean;
  output: string;
  error?: string;
}

// ── PM Evaluation ─────────────────────────────────────────────────────────────

export interface PMEvaluation {
  score: number;
  previous_score: number;
  improvements_observed: string[];
  remaining_gaps: string[];
  is_stunning: boolean;   // true when score >= 9 and no critical gaps remain
  reasoning: string;
}

// ── Iteration Record ─────────────────────────────────────────────────────────

export interface LoopIteration {
  number: number;
  started_at: string;
  finished_at?: string;

  // Phase 1: PM Analysis
  ux_analysis?: PMAnalysis;
  feature_analysis?: PMAnalysis;

  // Phase 2: PM Debate
  ux_debate?: PMDebateResponse;
  feature_debate?: PMDebateResponse;

  // Phase 3: Requirements Consensus
  requirements?: LoopRequirements;

  // Phase 4: Development
  implementer: DevId;
  implementation?: DevImplementation;
  review?: DevReview;
  applied_files?: string[];

  // Phase 5: Testing
  test_result?: TestResult;

  // Phase 6: PM Evaluation
  ux_evaluation?: PMEvaluation;
  feature_evaluation?: PMEvaluation;

  // Outcome
  is_stunning: boolean;
  error?: string;
}

// ── Loop State ────────────────────────────────────────────────────────────────

export interface LoopState {
  running: boolean;
  current_iteration: number;
  max_iterations: number;
  iterations: LoopIteration[];
  started_at: string | null;
  finished_at: string | null;
  stop_reason: 'stunning' | 'max_iterations' | 'error' | 'stopped' | null;
}

// ── SSE Events ────────────────────────────────────────────────────────────────

export type LoopEventType =
  | 'loop:start'
  | 'loop:stop'
  | 'loop:error'
  | 'loop:state'
  | 'iteration:start'
  | 'iteration:complete'
  | 'pm:analysis'
  | 'pm:debate'
  | 'pm:requirements'
  | 'dev:implementation'
  | 'dev:review'
  | 'dev:applied'
  | 'test:result'
  | 'pm:evaluation';

export interface LoopEvent {
  type: LoopEventType;
  data: unknown;
  timestamp: string;
}
