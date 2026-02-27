import { FacilityStore, AppNotification, ABTCourse, IPEvent, VaxEvent, ResidentNote, Resident } from '../../domain/models';

export const runDetectionPipeline = (
  store: FacilityStore,
  facilityId: string,
  updateDB: (updater: (draft: any) => void) => void
) => {
  const meta = store.notificationMeta || {};
  const lastRun = meta.lastDetectionRunAtISO || '1970-01-01T00:00:00.000Z';
  const lastSeen = meta.lastSeenEventAtISO || '1970-01-01T00:00:00.000Z';
  const now = new Date();
  const nowISO = now.toISOString();
  const dateBucket = nowISO.split('T')[0];

  // Find the latest event in the store to see if we need to run
  const allEvents = [
    ...Object.values(store.abts || {}),
    ...Object.values(store.infections || {}),
    ...Object.values(store.vaxEvents || {}),
    ...Object.values(store.notes || {}),
    ...Object.values(store.residents || {})
  ];

  let currentMaxEventIso = lastSeen;
  for (const ev of allEvents) {
    const d = ev.updatedAt || ev.createdAt || '';
    if (d > currentMaxEventIso) {
      currentMaxEventIso = d;
    }
  }

  // If no new events and we've run before, we can skip unless it's a new day (for time-based rules)
  const isNewDay = lastRun.split('T')[0] !== dateBucket;
  if (currentMaxEventIso <= lastSeen && !isNewDay && lastRun !== '1970-01-01T00:00:00.000Z') {
    return; // Nothing new to process
  }

  const isNewer = (iso?: string) => iso && iso > lastRun;

  const detected: AppNotification[] = [];

  const getResDetails = (resId?: string) => {
    if (!resId) return {};
    const res = store.residents[resId];
    if (!res) return {};
    return {
      unit: res.currentUnit,
      room: res.currentRoom,
      name: res.displayName
    };
  };

  const addNotif = (
    ruleId: string,
    category: AppNotification['category'],
    residentId: string | undefined,
    refId: string,
    message: string,
    refs: any,
    clusterDetails?: AppNotification['clusterDetails'],
    unitOverride?: string
  ) => {
    // For cluster notifications, residentId might be undefined, but we need an ID.
    // If residentId is undefined, we use the unitOverride as part of the ID.
    const id = `${ruleId}_${residentId || unitOverride || 'facility'}_${refId}_${dateBucket}`;
    if (store.notifications?.[id]) return; // Already exists

    const { unit, room, name } = residentId ? getResDetails(residentId) : { unit: unitOverride, room: undefined, name: undefined };
    detected.push({
      id,
      facilityId,
      createdAtISO: nowISO,
      status: 'unread',
      category,
      residentId,
      unit,
      room,
      message,
      refs,
      ruleId,
      clusterDetails
    });
  };

  // 1. ABT Review (LINE_LIST_REVIEW)
  const respKeywords = ['pneumonia','uri','bronchitis','covid','influenza','rsv','resp'];
  const giKeywords = ['diarrhea','gastroenteritis','c. diff','cdiff','n/v','vomit','gi'];
  const utiKeywords = ['uti', 'urinary', 'cystitis', 'pyelonephritis', 'urine'];
  const deviceKeywords = ['foley', 'catheter', 'cath', 'device'];

  Object.values(store.abts || {}).forEach((abt: ABTCourse) => {
    if (abt.status === 'active' || isNewer(abt.updatedAt) || isNewer(abt.createdAt)) {
      const resId = abt?.residentRef?.id;
      const { name } = getResDetails(resId);

      // A1: Line Listing Review inclusion (Respiratory or GI)
      const indication = (abt.indication || '').toLowerCase();
      const syndrome = (abt.syndromeCategory || '').toLowerCase();
      const combined = `${indication} ${syndrome}`;
      
      const hasResp = respKeywords.some(k => combined.includes(k));
      const hasGi = giKeywords.some(k => combined.includes(k));
      
      if (hasResp || hasGi) {
        const typeStr = hasResp ? 'Respiratory' : 'GI';
        addNotif(
          'abt_syndrome_rule',
          'LINE_LIST_REVIEW',
          resId,
          abt.id,
          `${name || 'Unknown Resident'} started on antibiotic for ${typeStr} indication. Consider line list inclusion.`,
          { abtId: abt.id }
        );
      }

      // A3: Inter-module linkage: urinary ABT + device
      const isUti = utiKeywords.some(k => combined.includes(k));
      if (isUti && resId) {
        const ips = Object.values(store.infections || {}).filter(ip => ip.residentRef.id === resId);
        for (const ip of ips) {
          const ipDetails = `${ip.infectionCategory || ''} ${ip.notes || ''}`.toLowerCase();
          const hasDevice = deviceKeywords.some(k => ipDetails.includes(k));
          if (hasDevice) {
            addNotif(
              'uti_device_link_rule',
              'DEVICE_LINK',
              resId,
              `${abt.id}_${ip.id}`,
              `UTI-related antibiotic + urinary device present; review for CAUTI criteria and device necessity.`,
              { abtId: abt.id, ipId: ip.id }
            );
            break; // only one notification per ABT
          }
        }
      }

      if (abt.status === 'active') {
        const startDate = abt.startDate ? new Date(abt.startDate) : null;
        const endDate = abt.endDate ? new Date(abt.endDate) : null;
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        
        let needsReview = false;
        let reason = '';

        if (!endDate && startDate && startDate < sevenDaysAgo) {
          needsReview = true;
          reason = 'Active for > 7 days with no end date.';
        } else if (endDate && endDate < now) {
          needsReview = true;
          reason = 'End date has passed.';
        }

        if (needsReview) {
          const resId = abt?.residentRef?.id;
          const { name } = getResDetails(resId);
          addNotif(
            'abt_review_rule',
            'LINE_LIST_REVIEW',
            resId,
            abt.id,
            `${name || 'Unknown Resident'} is on ${abt.medication}. ${reason}`,
            { abtId: abt.id }
          );
        }
      }
    }
  });

  // 2. IP Review (LINE_LIST_REVIEW)
  Object.values(store.infections || {}).forEach((ip: IPEvent) => {
    if (ip.status === 'active' || isNewer(ip.updatedAt) || isNewer(ip.createdAt)) {
      if (ip.status === 'active') {
        const createdDate = new Date(ip.createdAt);
        const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        if (createdDate < fourteenDaysAgo) {
          const resId = ip?.residentRef?.id;
          const { name } = getResDetails(resId);
          addNotif(
            'ip_review_rule',
            'LINE_LIST_REVIEW',
            resId,
            ip.id,
            `${name || 'Unknown Resident'} has an active infection (${ip.infectionCategory || 'Unknown'}) for > 14 days. Consider reviewing isolation status.`,
            { ipId: ip.id }
          );
        }
      }
    }
  });

  // 3. VAX Due (VAX_GAP)
  Object.values(store.vaxEvents || {}).forEach((vax: VaxEvent) => {
    if (vax.status === 'due' || vax.status === 'overdue' || isNewer(vax.updatedAt) || isNewer(vax.createdAt)) {
      if (vax.status === 'due' || vax.status === 'overdue') {
        const dueDate = vax.dueDate ? new Date(vax.dueDate) : null;
        if (dueDate && dueDate <= now) {
          const resId = vax?.residentRef?.id;
          const { name } = getResDetails(resId);
          addNotif(
            'vax_due_rule',
            'VAX_GAP',
            resId,
            vax.id,
            `${name || 'Unknown Resident'} is due for ${vax.vaccine} vaccine.`,
            { vaxId: vax.id }
          );
        }
      }
    }
  });

  // 4. Admission Screening (ADMISSION_SCREENING)
  const screeningNotesByResident = Object.values(store.notes || {}).reduce((acc, note) => {
    if (note.noteType === 'Admission Screening' && note?.residentRef?.id) {
      acc[note.residentRef.id] = true;
    }
    return acc;
  }, {} as Record<string, boolean>);

  Object.values(store.residents || {}).forEach((res: Resident) => {
    if (isNewer(res.updatedAt) || isNewer(res.createdAt) || (res.status === 'Active' && res.admissionDate)) {
      if (res.status === 'Active' && res.admissionDate) {
        const adDate = new Date(res.admissionDate);
        const seventyTwoHoursAgo = new Date(now.getTime() - 72 * 60 * 60 * 1000);
        if (adDate > seventyTwoHoursAgo && !screeningNotesByResident[res.mrn]) {
          addNotif(
            'adm_screening_rule',
            'ADMISSION_SCREENING',
            res.mrn,
            res.mrn,
            `${res.displayName} was admitted recently. An admission screening note is required.`,
            {}
          );
        }
      }
    }
  });

  // 5. Symptom Watch (SYMPTOM_WATCH) & A2 (Hashtags)
  const keywords = ['fever', 'cough', 'antibiotic', 'infection', 'vomiting', 'diarrhea'];
  const triggerTags = ['#cough', '#runnynose', '#fever', '#sorethroat', '#abdominalpain', '#diarrhea', '#sob', '#vomiting', '#nausea'];

  Object.values(store.notes || {}).forEach((note: ResidentNote) => {
    if (isNewer(note.updatedAt) || isNewer(note.createdAt)) {
      const lowerBody = note.body?.toLowerCase() || '';
      const resId = note?.residentRef?.id;
      const { name } = getResDetails(resId);

      // A2: Hashtags in notes
      const words = lowerBody.split(/\s+/);
      const foundTags: string[] = [];
      for (const word of words) {
        const cleanWord = word.replace(/[.,!?;:]+$/, '');
        if (triggerTags.includes(cleanWord)) {
          foundTags.push(cleanWord);
        }
      }
      
      if (foundTags.length > 0) {
        const uniqueTags = Array.from(new Set(foundTags));
        addNotif(
          'note_hashtag_rule',
          'LINE_LIST_REVIEW',
          resId,
          note.id,
          `Symptom signal detected: ${uniqueTags.join(', ')}`,
          { noteId: note.id }
        );
      }

      // Original Symptom Watch
      const noteDate = new Date(note.createdAt);
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      if (noteDate > twentyFourHoursAgo) {
        const foundKeywords = keywords.filter(k => lowerBody.includes(k));
        if (foundKeywords.length > 0) {
          addNotif(
            'symptom_watch_rule',
            'SYMPTOM_WATCH',
            resId,
            note.id,
            `Recent note for ${name || 'Unknown Resident'} mentions: ${foundKeywords.join(', ')}.`,
            { noteId: note.id }
          );
        }
      }
    }
  });

  // 6. Detector B: Outbreak suggestion
  const ninetySixHoursAgo = new Date(now.getTime() - 96 * 60 * 60 * 1000);
  const clusterMap: Record<string, { residentId: string; residentName: string; refType: 'note' | 'abt'; refId: string }[]> = {};

  const addToCluster = (unit: string, syndrome: string, detail: { residentId: string; residentName: string; refType: 'note' | 'abt'; refId: string }) => {
    if (!unit) return;
    const key = `${unit}_${syndrome}`;
    if (!clusterMap[key]) clusterMap[key] = [];
    clusterMap[key].push(detail);
  };

  // Check ABTs in last 96h
  Object.values(store.abts || {}).forEach((abt: ABTCourse) => {
    const d = new Date(abt.createdAt || abt.updatedAt || '');
    if (d > ninetySixHoursAgo) {
      const resId = abt?.residentRef?.id;
      if (!resId) return;
      const { unit, name } = getResDetails(resId);
      if (!unit) return;

      const indication = (abt.indication || '').toLowerCase();
      const syndrome = (abt.syndromeCategory || '').toLowerCase();
      const combined = `${indication} ${syndrome}`;
      
      const hasResp = respKeywords.some(k => combined.includes(k));
      const hasGi = giKeywords.some(k => combined.includes(k));

      if (hasResp) {
        addToCluster(unit, 'Respiratory', { residentId: resId, residentName: name || 'Unknown', refType: 'abt', refId: abt.id });
      }
      if (hasGi) {
        addToCluster(unit, 'GI', { residentId: resId, residentName: name || 'Unknown', refType: 'abt', refId: abt.id });
      }
    }
  });

  // Check Notes in last 96h
  Object.values(store.notes || {}).forEach((note: ResidentNote) => {
    const d = new Date(note.createdAt || note.updatedAt || '');
    if (d > ninetySixHoursAgo) {
      const resId = note?.residentRef?.id;
      if (!resId) return;
      const { unit, name } = getResDetails(resId);
      if (!unit) return;

      const lowerBody = note.body?.toLowerCase() || '';
      const words = lowerBody.split(/\s+/);
      const foundTags = new Set<string>();
      for (const word of words) {
        const cleanWord = word.replace(/[.,!?;:]+$/, '');
        if (triggerTags.includes(cleanWord)) {
          foundTags.add(cleanWord);
        }
      }

      if (lowerBody.includes('fever')) {
        foundTags.add('fever');
      }
      if (lowerBody.includes('sore throat')) {
        foundTags.add('sore throat');
      }

      foundTags.forEach(tag => {
        addToCluster(unit, tag, { residentId: resId, residentName: name || 'Unknown', refType: 'note', refId: note.id });
      });
    }
  });

  // Evaluate clusters
  Object.entries(clusterMap).forEach(([key, details]) => {
    const [unit, syndrome] = key.split('_');
    const uniqueResidents = new Set(details.map(d => d.residentId));
    if (uniqueResidents.size >= 2) {
      // De-duplication: Check if there's already an unread notification for this unit and syndrome within the rolling window
      const recentNotif = Object.values(store.notifications || {}).find(n => 
        n.ruleId === 'outbreak_suggestion_rule' && 
        n.unit === unit && 
        n.message.includes(syndrome) &&
        n.status === 'unread' &&
        new Date(n.createdAtISO) > ninetySixHoursAgo
      );

      if (!recentNotif) {
        // Use a unique ID based on the current timestamp so it can fire again if the previous one was read/dismissed
        const uniqueRefId = `${unit}_${syndrome}_${now.getTime()}`;
        addNotif(
          'outbreak_suggestion_rule',
          'OUTBREAK_SUGGESTION',
          undefined, // no single resident
          uniqueRefId,
          `Possible cluster in Unit ${unit}: ${uniqueResidents.size} residents with ${syndrome} in 96h.`,
          {},
          details,
          unit
        );
      }
    }
  });

  // 7. Detector C: Vaccine gap - Influenza
  let seasonStartYear = now.getFullYear();
  if (now.getMonth() < 8) { // Jan-Aug (0-7)
    seasonStartYear--;
  }
  const seasonStart = new Date(seasonStartYear, 9, 1); // Oct 1
  const seasonEnd = new Date(seasonStartYear + 1, 4, 15); // May 15

  if (now >= seasonStart && now <= seasonEnd) {
    const fluVaxByResident: Record<string, boolean> = {};
    Object.values(store.vaxEvents || {}).forEach(vax => {
      if (vax.vaccine.toLowerCase().includes('influenza') || vax.vaccine.toLowerCase().includes('flu')) {
        if (vax.status === 'given' && vax.dateGiven) {
          const givenDate = new Date(vax.dateGiven);
          if (givenDate >= seasonStart && givenDate <= seasonEnd) {
            fluVaxByResident[vax.residentRef.id] = true;
          }
        }
      }
    });

    Object.values(store.residents || {}).forEach((res: Resident) => {
      if (res.status === 'Active') {
        if (!fluVaxByResident[res.mrn]) {
          addNotif(
            'vax_gap_flu_rule',
            'VAX_GAP',
            res.mrn,
            `${seasonStartYear}`,
            `Influenza vaccine missing for current season; offer/re-offer per protocol.`,
            {}
          );
        }
      }
    });
  }

  if (detected.length > 0 || currentMaxEventIso > lastSeen || isNewDay) {
    updateDB((draft: any) => {
      const facilityData = draft.data.facilityData[facilityId];
      if (!facilityData.notifications) facilityData.notifications = {};
      
      detected.forEach(d => {
        facilityData.notifications[d.id] = d;
      });

      if (!facilityData.notificationMeta) {
        facilityData.notificationMeta = {};
      }
      facilityData.notificationMeta.lastDetectionRunAtISO = nowISO;
      facilityData.notificationMeta.lastSeenEventAtISO = currentMaxEventIso;
    });
  }
};
