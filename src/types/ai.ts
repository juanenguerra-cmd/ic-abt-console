export interface OutbreakRiskResult {
  riskDetected: boolean;
  riskLevel: 'low' | 'moderate' | 'high';
  summary: string;
  affectedUnit?: string;
  suspectedPathogen?: string;
  recommendedAction?: string;
  triggeredRules: string[];
  analyzedEntryCount: number;
  analyzedWindowHours: 72;
}

export interface SBARHandoff {
  situation: string;
  background: string;
  assessment: string;
  recommendation: string;
  generatedAt: string;
  shiftLabel: string;
  entryCount: number;
  rulesSummary: string;
}

export type RiskAnalysisStatus =
  | 'idle'
  | 'analyzing'
  | 'complete'
  | 'insufficient_data';
