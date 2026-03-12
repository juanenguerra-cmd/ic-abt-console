import React, { useMemo } from 'react';
import { useFacilityData } from '../../app/providers';
import { Activity, Shield, Syringe, FileText, StickyNote, Trash2, Edit2, GitBranch } from 'lucide-react';
import { formatDateLikeForDisplay } from '../../lib/dateUtils';
import { getPrecautionLabel, getInfectionSourceLabel } from '../../utils/ipEventFormatters';

interface Props {
  residentId: string;
  onEditAbt?: (id: string) => void;
  onEditIp?: (id: string) => void;
  onEditVax?: (id: string) => void;
  onDeleteAbt?: (id: string) => void;
  onDeleteIp?: (id: string) => void;
  onDeleteVax?: (id: string) => void;
  onStartContactTrace?: (ref: { kind: 'ipEvent'; id: string } | { kind: 'symptom'; residentMrn: string; startISO: string }) => void;
}

interface TimelineEvent {
  id: string;
  date: string;
  type: 'ABT' | 'Infection' | 'Vax' | 'Note';
  title: string;
  description?: string;
  icon: React.ElementType;
  colorClass: string;
  bgClass: string;
  originalData?: any;
}

export const ResidentTimeline: React.FC<Props> = ({ 
  residentId,
  onEditAbt,
  onEditIp,
  onEditVax,
  onDeleteAbt,
  onDeleteIp,
  onDeleteVax,
  onStartContactTrace
}) => {
  const { store } = useFacilityData();

  const events = useMemo(() => {
    const allEvents: TimelineEvent[] = [];

    // ABTs
    Object.values(store.abts).forEach((abt) => {
      if (abt.residentRef.kind === 'mrn' && abt.residentRef.id === residentId) {
        const details = [
            abt.dose,
            abt.doseUnit,
            abt.route,
            abt.frequency
        ].filter(Boolean).join(' ');

        allEvents.push({
          id: abt.id,
          date: abt.startDate || abt.createdAt,
          type: 'ABT',
          title: `Antibiotic: ${abt.medication} ${details}`,
          description: `${abt.indication || 'No indication'} • ${abt.status}`,
          icon: Activity,
          colorClass: 'text-emerald-600',
          bgClass: 'bg-emerald-100',
          originalData: abt
        });
      }
    });

    // Infections
    Object.values(store.infections).forEach((ip) => {
      if (ip.residentRef.kind === 'mrn' && ip.residentRef.id === residentId) {
        allEvents.push({
          id: ip.id,
          date: ip.onsetDate || ip.createdAt,
          type: 'Infection',
          title: `Infection: ${getPrecautionLabel(ip)}`,
          description: `${getInfectionSourceLabel(ip)} • ${ip.status}`,
          icon: Shield,
          colorClass: 'text-amber-600',
          bgClass: 'bg-amber-100',
          originalData: ip
        });
      }
    });

    // Vax Events
    Object.values(store.vaxEvents).forEach((vax) => {
      if (vax.residentRef.kind === 'mrn' && vax.residentRef.id === residentId) {
        const date = vax.dateGiven || vax.administeredDate || vax.createdAt;
        allEvents.push({
          id: vax.id,
          date: date,
          type: 'Vax',
          title: `Vaccine: ${vax.vaccine}`,
          description: `${vax.status} • ${vax.dose || ''}`,
          icon: Syringe,
          colorClass: 'text-purple-600',
          bgClass: 'bg-purple-100',
          originalData: vax
        });
      }
    });

    // Notes
    Object.values(store.notes).forEach((note) => {
      if (note.residentRef.kind === 'mrn' && note.residentRef.id === residentId) {
        allEvents.push({
          id: note.id,
          date: note.createdAt,
          type: 'Note',
          title: note.title || 'Note',
          description: note.body,
          icon: StickyNote,
          colorClass: 'text-blue-600',
          bgClass: 'bg-blue-100',
          originalData: note
        });
      }
    });

    return allEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [store, residentId]);

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-neutral-500">
        <FileText className="w-12 h-12 mb-3 opacity-20" />
        <p>No timeline events found for this resident.</p>
      </div>
    );
  }

  return (
    <div className="relative border-l-2 border-neutral-200 ml-3 space-y-8 py-4">
      {events.map((event, index) => {
        const Icon = event.icon;
        
        const handleEdit = () => {
          if (event.type === 'ABT' && onEditAbt) onEditAbt(event.id);
          if (event.type === 'Infection' && onEditIp) onEditIp(event.id);
          if (event.type === 'Vax' && onEditVax) onEditVax(event.id);
        };

        const handleDelete = (e: React.MouseEvent) => {
          e.stopPropagation();
          if (event.type === 'ABT' && onDeleteAbt) onDeleteAbt(event.id);
          if (event.type === 'Infection' && onDeleteIp) onDeleteIp(event.id);
          if (event.type === 'Vax' && onDeleteVax) onDeleteVax(event.id);
        };

        const handleTrace = (e: React.MouseEvent) => {
          e.stopPropagation();
          if (event.type === 'Infection' && onStartContactTrace) onStartContactTrace({ kind: 'ipEvent', id: event.id });
        };

        const isClickable = (event.type === 'ABT' && onEditAbt) || 
                            (event.type === 'Infection' && onEditIp) || 
                            (event.type === 'Vax' && onEditVax);

        return (
          <div 
            key={event.id} 
            className={`relative pl-8 ${isClickable ? 'cursor-pointer group' : ''}`}
            onClick={isClickable ? handleEdit : undefined}
          >
            {/* Dot on the line */}
            <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-white ${event.bgClass.replace('bg-', 'bg-')} ${event.colorClass.replace('text-', 'bg-')}`} />
            
            <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
              <h4 className={`text-sm font-bold ${isClickable ? 'group-hover:text-indigo-600 transition-colors' : 'text-neutral-900'}`}>
                {event.title}
              </h4>
              <time className="text-xs text-neutral-500 font-mono">
                {formatDateLikeForDisplay(event.date)}
              </time>
            </div>
            
            <p className="text-sm text-neutral-600 mt-1">{event.description}</p>
            
            <div className="flex items-center gap-2 mt-2">
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${event.bgClass} ${event.colorClass}`}>
                {event.type}
              </span>

              {/* Action Buttons */}
              <div className="flex items-center gap-1">
                {event.type === 'Infection' && onStartContactTrace && (
                  <button
                    onClick={handleTrace}
                    className="p-1 text-teal-600 hover:bg-teal-50 rounded"
                    title="Start Contact Trace"
                  >
                    <GitBranch className="w-3.5 h-3.5" />
                  </button>
                )}
                {isClickable && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleEdit(); }}
                    className="p-1 text-indigo-600 hover:bg-indigo-50 rounded"
                    title="Edit"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                )}
                {((event.type === 'ABT' && onDeleteAbt) || (event.type === 'Infection' && onDeleteIp) || (event.type === 'Vax' && onDeleteVax)) && (
                  <button
                    onClick={handleDelete}
                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
