import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import {
  residents as residentsRepo,
  abts as abtsRepo,
  ipEvents as ipEventsRepo,
  vaccinations as vaccinationsRepo,
  notifications as notificationsRepo,
} from '../storage/repository';
import type { Resident, ABT, IPEvent, Vaccination, Notification } from '../types';

interface Props {
  user: User;
  /** Guaranteed to be a non-empty Firestore document ID */
  facilityId: string;
  onSignOut: () => void;
}

type Tab = 'residents' | 'abts' | 'ipEvents' | 'vaccinations' | 'notifications';

const TAB_LABELS: Record<Tab, string> = {
  residents: 'Residents',
  abts: 'Antibiotics',
  ipEvents: 'IP Events',
  vaccinations: 'Vaccinations',
  notifications: 'Notifications',
};

const Dashboard: React.FC<Props> = ({ user, facilityId, onSignOut }) => {
  const [activeTab, setActiveTab] = useState<Tab>('residents');

  const [residentList, setResidentList] = useState<Resident[]>([]);
  const [abtList, setAbtList] = useState<ABT[]>([]);
  const [ipEventList, setIpEventList] = useState<IPEvent[]>([]);
  const [vaccinationList, setVaccinationList] = useState<Vaccination[]>([]);
  const [notificationList, setNotificationList] = useState<Notification[]>([]);

  const uid = user.uid;

  // ─── onSnapshot listeners – live updates across devices ──────────────────
  useEffect(() => {
    if (!facilityId) return;

    const unsubs = [
      residentsRepo.subscribe(uid, facilityId, setResidentList),
      abtsRepo.subscribe(uid, facilityId, setAbtList),
      ipEventsRepo.subscribe(uid, facilityId, setIpEventList),
      vaccinationsRepo.subscribe(uid, facilityId, setVaccinationList),
      notificationsRepo.subscribe(uid, facilityId, setNotificationList),
    ];

    return () => unsubs.forEach((u) => u());
  }, [uid, facilityId]);

  const unreadCount = notificationList.filter((n) => !n.read).length;

  return (
    <div className="min-h-screen bg-neutral-100">
      {/* ── Header ── */}
      <header className="bg-emerald-700 text-white px-6 py-4 flex items-center justify-between shadow">
        <div>
          <h1 className="text-xl font-bold tracking-tight">IC Nurse Console</h1>
          <p className="text-sm text-emerald-200 mt-0.5">{user.email}</p>
        </div>
        <button
          onClick={onSignOut}
          className="text-sm bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 rounded transition-colors"
        >
          Sign out
        </button>
      </header>

      {/* ── Tab nav ── */}
      <nav className="bg-white border-b border-neutral-200 px-6 flex gap-1 overflow-x-auto">
        {(Object.keys(TAB_LABELS) as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              activeTab === tab
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            {TAB_LABELS[tab]}
            {tab === 'notifications' && unreadCount > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-xs bg-red-500 text-white rounded-full">
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* ── Content ── */}
      <main className="p-6">
        {activeTab === 'residents' && (
          <CollectionTable
            title="Residents"
            items={residentList as unknown as AnyRecord[]}
            columns={['name', 'unit', 'room', 'status']}
            emptyMessage="No residents recorded yet."
          />
        )}

        {activeTab === 'abts' && (
          <CollectionTable
            title="Antibiotic Courses"
            items={abtList as unknown as AnyRecord[]}
            columns={['residentName', 'medication', 'indication', 'startDate', 'reviewDate', 'status']}
            emptyMessage="No antibiotic courses recorded yet."
          />
        )}

        {activeTab === 'ipEvents' && (
          <CollectionTable
            title="IP Events"
            items={ipEventList as unknown as AnyRecord[]}
            columns={['residentName', 'infectionType', 'symptomOnsetDate', 'status']}
            emptyMessage="No IP events recorded yet."
          />
        )}

        {activeTab === 'vaccinations' && (
          <CollectionTable
            title="Vaccinations"
            items={vaccinationList as unknown as AnyRecord[]}
            columns={['residentName', 'vaccineType', 'status', 'date']}
            emptyMessage="No vaccination records yet."
          />
        )}

        {activeTab === 'notifications' && (
          <CollectionTable
            title="Notifications"
            items={notificationList as unknown as AnyRecord[]}
            columns={['title', 'message', 'type', 'read', 'createdAt']}
            emptyMessage="No notifications."
          />
        )}
      </main>
    </div>
  );
};

// ─── Generic table component ──────────────────────────────────────────────────

type AnyRecord = { id?: unknown } & { [key: string]: unknown };

interface TableProps {
  title: string;
  items: AnyRecord[];
  columns: string[];
  emptyMessage: string;
}

function CollectionTable({ title, items, columns, emptyMessage }: TableProps) {
  const formatHeader = (col: string) =>
    col.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());

  const formatCell = (value: unknown): string => {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (Array.isArray(value)) return value.join(', ');
    return String(value);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
        <h2 className="text-base font-semibold text-neutral-800">{title}</h2>
        <span className="text-sm text-neutral-400">
          {items.length} record{items.length !== 1 ? 's' : ''}
        </span>
      </div>

      {items.length === 0 ? (
        <p className="px-5 py-8 text-sm text-neutral-400 text-center">{emptyMessage}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col}
                    className="px-4 py-2.5 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide"
                  >
                    {formatHeader(col)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {items.map((item, i) => (
                <tr
                  key={String(item.id ?? i)}
                  className="hover:bg-neutral-50 transition-colors"
                >
                  {columns.map((col) => (
                    <td key={col} className="px-4 py-2.5 text-neutral-700">
                      {formatCell(item[col])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
