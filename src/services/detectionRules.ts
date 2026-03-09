import { ABTCourse, IPEvent, FacilityStore, AppNotification } from '../domain/models';

export interface DetectionResult {
  ruleId: string;
  category: AppNotification['category'];
  message: string;
  refs: {
    abtId?: string;
    ipId?: string;
    vaxId?: string;
    noteId?: string;
  };
  action?: AppNotification['action'];
  payload?: any;
}

/**
 * Pure detection rules that identify clinical risks or stewardship opportunities.
 */
export const DetectionRules = {
  /**
   * G4: ABT Stewardship Escalation
   * Active antibiotic course beyond 14 days requires escalation.
   */
  checkAbt14DayEscalation: (abt: ABTCourse, now: Date): DetectionResult | null => {
    if (abt.status !== 'active' || !abt.startDate) return null;
    const startDate = new Date(abt.startDate);
    const msElapsed = now.getTime() - startDate.getTime();
    const daysElapsed = msElapsed / (1000 * 60 * 60 * 24);

    if (daysElapsed >= 14) {
      return {
        ruleId: 'abt_14day_timeout_rule',
        category: 'ABT_STEWARDSHIP',
        message: `Antibiotic course for ${abt.medication} has exceeded 14 days. Escalate to prescribing provider for stewardship review.`,
        refs: { abtId: abt.id }
      };
    }
    return null;
  },

  /**
   * G5: IP Isolation Review
   * Active infection event without isolationType for more than 4 hours requires review.
   */
  checkIpNoIsolationAlert: (ip: IPEvent, now: Date): DetectionResult | null => {
    if (ip.status !== 'active') return null;
    const createdDate = new Date(ip.createdAt);
    const msElapsed = now.getTime() - createdDate.getTime();
    const hoursElapsed = msElapsed / (1000 * 60 * 60);

    if (!ip.isolationType && !ip.ebp && hoursElapsed >= 4) {
      return {
        ruleId: 'ip_no_isolation_rule',
        category: 'LINE_LIST_REVIEW',
        message: `Active infection (${ip.infectionCategory || 'Unknown'}) has no isolation type assigned for > 4 hours. Review and assign precautions.`,
        refs: { ipId: ip.id }
      };
    }
    return null;
  },

  /**
   * ABT 48-72h Stewardship Time-out
   */
  checkAbtStewardshipTimeout: (abt: ABTCourse, now: Date): DetectionResult | null => {
    if (abt.status !== 'active' || !abt.startDate) return null;
    const startDate = new Date(abt.startDate);
    const hoursElapsed = (now.getTime() - startDate.getTime()) / (1000 * 60 * 60);
    
    if (hoursElapsed >= 48 && hoursElapsed < 96) {
      return {
        ruleId: 'abt_stewardship_timeout_rule',
        category: 'ABT_STEWARDSHIP',
        message: `48–72h stewardship time-out review is due for ${abt.medication}.`,
        refs: { abtId: abt.id }
      };
    }
    return null;
  }
};

/**
 * Orchestrator to run all rules against a resident's data.
 * Useful for real-time UI alerts without waiting for the background pipeline.
 */
export const getResidentAlerts = (residentId: string, store: FacilityStore, now: Date = new Date()): DetectionResult[] => {
  const alerts: DetectionResult[] = [];

  // Check ABTs
  Object.values(store.abts || {}).forEach(abt => {
    if (abt.residentRef.id !== residentId) return;
    
    const escalation = DetectionRules.checkAbt14DayEscalation(abt, now);
    if (escalation) alerts.push(escalation);

    const timeout = DetectionRules.checkAbtStewardshipTimeout(abt, now);
    if (timeout) alerts.push(timeout);
  });

  // Check IPs
  Object.values(store.infections || {}).forEach(ip => {
    if (ip.residentRef.id !== residentId) return;

    const isolationAlert = DetectionRules.checkIpNoIsolationAlert(ip, now);
    if (isolationAlert) alerts.push(isolationAlert);
  });

  return alerts;
};
