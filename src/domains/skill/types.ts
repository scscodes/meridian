/**
 * Skill Domain Types — composite command result types.
 */

import { GitStatus, WorkspaceScan } from "../../types";
import { GeneratedPR, GeneratedPRReview, ConflictResolutionProse, InboundChanges } from "../git/types";

export interface SkillOverviewResult {
  status: GitStatus;
  briefing: string;
}

export interface SkillPrReadyResult {
  scan: WorkspaceScan;
  review: GeneratedPRReview;
  pr: GeneratedPR;
}

export interface SkillPreMergeResult {
  inbound: InboundChanges;
  conflicts: ConflictResolutionProse;
}
