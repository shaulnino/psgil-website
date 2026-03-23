export type StewardRole = "admin" | "steward" | "member";

export type CaseStatus =
  | "Open"
  | "Waiting for Response"
  | "Under Review"
  | "Verdict Ready"
  | "Closed"
  | "Archived";

export type WeekendSession = "Qualifying" | "Race";

export type AttachmentRef = {
  name: string;
  url: string;
};

export type StewardUser = {
  id: string;
  name: string;
  email: string;
  roles: StewardRole[];
  passwordHash: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CaseResponse = {
  id: string;
  caseId: string;
  userId: string;
  text: string;
  attachments: AttachmentRef[];
  links: string[];
  createdAt: string;
  updatedAt: string;
};

export type InternalComment = {
  id: string;
  caseId: string;
  authorId: string;
  text: string;
  stewardOnly: true;
  createdAt: string;
  updatedAt: string;
};

/** Per-driver penalty entry inside a case verdict. */
export type DriverVerdict = {
  id: string;
  caseId: string;
  driverId: string;
  license_points: number | null;
  time_penalty_seconds: number | null;
  warning_text: string | null;
  createdAt: string;
  updatedAt: string;
};

export type VerdictDecision =
  | "Racing Incident"
  | "No Further Action"
  | "Penalty Imposed"
  | "Driver Reprimand"
  | "Other";

export type Verdict = {
  id: string;
  caseId: string;
  verdict_decision: VerdictDecision | null;
  verdict_summary: string;
  verdict_full_text: string;
  is_published: boolean;
  published_at: string | null;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  /** @deprecated Legacy single-verdict penalty fields — migrated to driverVerdicts on first read */
  license_points?: number | null;
  time_penalty_seconds?: number | null;
  warning_text?: string | null;
};

export type StewardCase = {
  id: string;
  caseNumber: number;
  title: string;
  season: string;
  round: string;
  weekendSession: WeekendSession;
  incidentLapNumber: number | null;
  qualifyingTime: string | null;
  complainantId: string;
  involvedDriverIds: string[];
  description: string;
  status: CaseStatus;
  attachments: AttachmentRef[];
  links: string[];
  responseIds: string[];
  internalCommentIds: string[];
  verdictId: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  archivedAt: string | null;
};

export type PenaltyToServeStatus =
  | "pending"
  | "assigned"
  | "awaiting_confirmation"
  | "served"
  | "not_served"
  | "rolled_forward"
  | "cancelled";

export type PenaltyToServe = {
  id: string;
  driverId: string;
  /** "threshold" = auto-generated from license-point rule; "manual" = admin-created */
  sourceType: "threshold" | "manual";
  /** The license-point threshold that triggered this (null for manual) */
  sourceThresholdPoints: number | null;
  /** Case IDs whose verdicts pushed the driver over the threshold */
  sourceCaseIds: string[];
  penaltyType: string;        // e.g. "qualifying_ban"
  penaltyLabel: string;       // e.g. "Qualifying Ban"
  penaltyDescription: string;
  /** event_id from schedule CSV */
  assignedRaceId: string | null;
  /** Human-readable race label, snapshotted at creation time */
  assignedRaceLabel: string | null;
  /** ISO timestamp of race start, used for "awaiting confirmation" promotion */
  assignedRaceStartTime: string | null;
  status: PenaltyToServeStatus;
  servedAt: string | null;
  adminNotes: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  /** ID of the penalty this record was rolled forward from */
  rolledFromPenaltyId: string | null;
  /** 1 = original issue, 2 = first roll-forward, etc. */
  cycleNumber: number;
};

export type StewardStore = {
  users: StewardUser[];
  cases: StewardCase[];
  responses: CaseResponse[];
  internalComments: InternalComment[];
  verdicts: Verdict[];
  driverVerdicts: DriverVerdict[];
  penaltiesToServe: PenaltyToServe[];
};
