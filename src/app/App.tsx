import React from "react";
import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation, useNavigate } from "react-router-dom";
import { AppProviders, useFacilityData, useDatabase } from "./providers";
import { ErrorBoundary } from "./ErrorBoundary";
import { RoleProvider } from "../context/RoleContext";
import { ResidentBoard } from "../features/ResidentBoard";
import { OutbreakManager } from "../features/Outbreaks";
import { PacketBuilder } from "../features/SurveyPackets/PacketBuilder";
import { SettingsConsole } from "../features/Settings";
import { QuarantineInbox } from "../features/Quarantine";
import { FloorMap } from "../features/Heatmap/FloorMap";
import { LS_LAST_BACKUP_TS } from "../constants/storageKeys";
import { Floorplan } from "../features/Floorplan";
import { ResidentChat } from "../features/Notes";
import { ShiftLogPage } from "../features/Notes/ShiftLogPage";
import { ReportBuilder } from "../features/Reports/ReportBuilder";
import { NoteGenerator } from "../features/Notes/NoteGenerator";
import { Dashboard } from "../features/Dashboard";
import { NotificationsPage, useNotifications } from "../features/Notifications";
import StaffPage from '../features/Staff';
import ReportsConsole from '../features/Reports';
import InfectionControlAuditCenter from "../pages/InfectionControlAuditCenter";
import AuditReportPrint from "../pages/print/AuditReportPrint";
import { GlobalSearch } from "../components/GlobalSearch";
import { UndoToastProvider } from "../components/UndoToast";
import { BackOfficePage } from "../pages/BackOfficePage";

import { LockScreen } from './LockScreen';
import { 
  LayoutDashboard, 
  Users, 
  AlertCircle, 
  FileText, 
  Settings, 
  Inbox, 
  Building2,
  Menu,
  X,
  MessageSquare,
  FileBarChart,
  PenSquare,
  ClipboardCheck,
  Bell,
  Database,
  Map,
  Activity
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// --- Layout Shell ---

const FloorplanPage = () => {
  const navigate = useNavigate();
  return <Floorplan onBack={() => navigate(-1)} />;
};

const SidebarLink = ({ to, icon: Icon, label, badge, alertBadge }: { to: string, icon: any, label: string, badge?: number, alertBadge?: boolean }) => {
  return (
    <NavLink 
      to={to}
      data-testid={`sidebar-link-${label.toLowerCase().replace(/\s+/g, '-')}`}
      aria-label={badge && badge > 0 ? `${label} (${badge} unread)` : label}
      className={({ isActive }) => `
        flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors active:scale-95
        ${isActive 
          ? "bg-neutral-100 text-neutral-900" 
          : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
        }
      `}
    >
      <div className="flex items-center gap-3">
        <div className="relative">
          <Icon className="w-5 h-5" aria-hidden="true" />
          {alertBadge && badge !== undefined && badge > 0 && (
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" aria-hidden="true" />
          )}
        </div>
        {label}
      </div>
      {badge !== undefined && badge > 0 && (
        <span
          aria-hidden="true"
          className={`px-2 py-0.5 rounded-full text-xs font-bold ${alertBadge ? "bg-red-100 text-red-700" : "bg-neutral-200 text-neutral-600"}`}
        >
          {badge}
        </span>
      )}
    </NavLink>
  );
};

const AppShell = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isPrintRoute = location.pathname === "/print/audit-report";
  const { db } = useDatabase();
  const { activeFacilityId, setActiveFacilityId, store } = useFacilityData();
  const { notifications } = useNotifications();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isFacilitySwitcherOpen, setIsFacilitySwitcherOpen] = React.useState(false);
  const facilitySwitcherRef = React.useRef<HTMLDivElement>(null);
  const [showBackupBanner, setShowBackupBanner] = React.useState(false);
  const [lastBackupLabel, setLastBackupLabel] = React.useState<string | null>(null);
  const [isLocked, setIsLocked] = React.useState(!isPrintRoute);

  React.useEffect(() => {
    const lastBackupTimestamp = localStorage.getItem(LS_LAST_BACKUP_TS);
    if (lastBackupTimestamp) {
      const lastBackupDate = new Date(parseInt(lastBackupTimestamp, 10));
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      if (lastBackupDate < oneDayAgo) {
        setShowBackupBanner(true);
      }
      // Format a human-readable label for the header badge
      const diffMs = Date.now() - lastBackupDate.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      if (diffHours < 24) {
        setLastBackupLabel(`Backup: ${diffHours}h ago`);
      } else {
        const diffDays = Math.floor(diffHours / 24);
        setLastBackupLabel(`Backup: ${diffDays}d ago`);
      }
    } else {
      // If no backup has ever been made, show the banner
      setShowBackupBanner(true);
      setLastBackupLabel('No backup');
    }
  }, []);

  React.useEffect(() => {
    if (!isFacilitySwitcherOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (facilitySwitcherRef.current && !facilitySwitcherRef.current.contains(e.target as Node)) {
        setIsFacilitySwitcherOpen(false);
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [isFacilitySwitcherOpen]);

  const facilities = Object.values(db.data.facilities.byId) as any[];
  const activeFacility = db.data.facilities.byId[activeFacilityId];
  const quarantineCount = Object.keys(store.quarantine).length;

  if (isPrintRoute) {
    return <AuditReportPrint />;
  }

  if (isLocked) {
    return <LockScreen onUnlock={() => setIsLocked(false)} />;
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      {showBackupBanner && (
        <div className="bg-red-600 text-white text-sm text-center py-2 px-4">
          <strong>Warning:</strong> No backup in the last 24 hours. Go to{' '}
          <a href="/settings" className="underline font-semibold hover:text-red-100">Settings</a> to create a backup now.
        </div>
      )}
      {/* Top Navigation */}
      <header className="bg-white border-b border-neutral-200 h-16 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button 
            aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={isMobileMenuOpen}
            aria-controls="sidebar-nav"
            className="lg:hidden p-2 -ml-2 text-neutral-500 hover:bg-neutral-100 rounded-md active:scale-95"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" aria-hidden="true" /> : <Menu className="w-6 h-6" aria-hidden="true" />}
          </button>
          
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center" aria-hidden="true">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg text-emerald-900 hidden sm:inline-block">Infection Control & Antibiotic Stewardship Console</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <GlobalSearch />

          <div className="relative" ref={facilitySwitcherRef}>
            <button
              data-testid="facility-switcher-button"
              aria-label={`Active facility: ${activeFacility?.name || "Select Facility"}. Click to switch.`}
              aria-haspopup="listbox"
              aria-expanded={isFacilitySwitcherOpen}
              onClick={() => setIsFacilitySwitcherOpen(prev => !prev)}
              className="flex items-center gap-2 text-sm font-medium text-neutral-700 hover:text-neutral-900 px-3 py-1.5 rounded-md hover:bg-neutral-50 border border-transparent hover:border-neutral-200 transition-all active:scale-95"
            >
              <span>{activeFacility?.name || "Select Facility"}</span>
              <Building2 className="w-4 h-4 text-neutral-400" aria-hidden="true" />
            </button>
            
            {/* Facility Switcher Dropdown */}
            {isFacilitySwitcherOpen && (
              <div role="listbox" aria-label="Facilities" className="absolute right-0 top-full mt-1 w-56 bg-white rounded-md shadow-lg border border-neutral-200 py-1">
                {facilities.map(f => (
                  <button
                    key={f.id}
                    data-testid={`facility-option-${f.id}`}
                    role="option"
                    aria-selected={activeFacilityId === f.id}
                    onClick={() => {
                      setActiveFacilityId(f.id);
                      setIsFacilitySwitcherOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-sm ${
                      activeFacilityId === f.id ? "bg-indigo-50 text-indigo-700 font-medium" : "text-neutral-700 hover:bg-neutral-50"
                    }`}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          {/* G7: Last backup badge */}
          {lastBackupLabel && (
            <button
              onClick={() => navigate('/settings')}
              title="Click to go to Settings and create a backup"
              className={`hidden sm:flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border transition-colors ${
                showBackupBanner
                  ? 'bg-red-50 text-red-700 border-red-300 hover:bg-red-100'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
              }`}
              aria-label={`Last backup status: ${lastBackupLabel}`}
            >
              <Database className="w-3 h-3" aria-hidden="true" />
              {lastBackupLabel}
            </button>
          )}

          <div className="h-8 w-8 rounded-full bg-neutral-200 flex items-center justify-center text-neutral-500 font-medium text-sm" aria-label={`Current user: ${activeFacility?.auditorName || "Unknown"}`}>
            {activeFacility?.auditorName
              ? activeFacility.auditorName.trim().split(/\s+/).filter(w => w.length > 0).slice(0, 2).map(w => w[0].toUpperCase()).join("")
              : "?"}
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Navigation */}
        <aside
          id="sidebar-nav"
          aria-label="Main navigation"
          className={`
            fixed inset-y-0 left-0 z-20 w-64 bg-white border-r border-neutral-200 transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:h-[calc(100vh-4rem)]
            ${isMobileMenuOpen ? "translate-x-0 mt-16" : "-translate-x-full lg:mt-0"}
          `}
        >
          <nav className="p-4 space-y-1" aria-label="App sections">
            <SidebarLink to="/" icon={LayoutDashboard} label="Dashboard" />
            <SidebarLink to="/resident-board" icon={Users} label="Resident Board" />
            <SidebarLink to="/floorplan" icon={Map} label="Floor Plan" />
            <SidebarLink to="/heatmap" icon={Activity} label="Heatmap" />
            <SidebarLink to="/staff" icon={Users} label="Staff" />
            
            <SidebarLink to="/chat" icon={MessageSquare} label="Shift Log" />
            <SidebarLink to="/note-generator" icon={PenSquare} label="Note Generator" />
            <SidebarLink to="/notifications" icon={Bell} label="Notifications" badge={notifications?.length || 0} alertBadge={(notifications?.length || 0) > 0} />
            <SidebarLink to="/outbreaks" icon={AlertCircle} label="Outbreaks" />
            <SidebarLink to="/reports" icon={FileText} label="Reports" />
            <SidebarLink to="/audit-center" icon={ClipboardCheck} label="Audit Center" />
            <SidebarLink to="/report-builder" icon={FileBarChart} label="Report Builder" />
            <SidebarLink to="/quarantine" icon={Inbox} label="Quarantine Inbox" badge={quarantineCount} />
            
            <div className="pt-4 mt-4 border-t border-neutral-100">
              <SidebarLink to="/settings" icon={Settings} label="Settings" />
            </div>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto relative flex flex-col">
          <div className="flex-1">
            <AnimatePresence mode="wait">
              <Routes>
                <Route path="/" element={<PageTransition><Dashboard /></PageTransition>} />
                <Route path="/resident-board" element={<PageTransition><ResidentBoard /></PageTransition>} />
                <Route path="/floorplan" element={<PageTransition><FloorplanPage /></PageTransition>} />
                <Route path="/heatmap" element={<PageTransition><FloorplanPage /></PageTransition>} />
                <Route path="/staff" element={<PageTransition><StaffPage /></PageTransition>} />
                
                <Route path="/chat" element={<PageTransition><ShiftLogPage /></PageTransition>} />
                <Route path="/note-generator" element={<PageTransition><NoteGenerator /></PageTransition>} />
                <Route path="/notifications" element={<PageTransition><NotificationsPage /></PageTransition>} />
                <Route path="/outbreaks" element={<PageTransition><OutbreakManager /></PageTransition>} />
                <Route path="/reports" element={<PageTransition><ReportsConsole /></PageTransition>} />
                <Route path="/reports/forms" element={<PageTransition><ReportsConsole /></PageTransition>} />
                <Route path="/audit-center" element={<PageTransition><InfectionControlAuditCenter /></PageTransition>} />
                <Route path="/report-builder" element={<PageTransition><ReportBuilder /></PageTransition>} />
                <Route path="/print/audit-report" element={<AuditReportPrint />} />
                <Route path="/quarantine" element={<PageTransition><div className="p-6"><QuarantineInbox /></div></PageTransition>} />
                <Route path="/settings" element={<PageTransition><div className="p-6"><SettingsConsole /></div></PageTransition>} />
                <Route path="/back-office" element={<PageTransition><BackOfficePage /></PageTransition>} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </AnimatePresence>
          </div>
          <footer className="text-center py-4 text-xs text-neutral-500 border-t mt-auto shrink-0">
            Developed and built by Juan Enguerra. © 2026 All Rights Reserved.
          </footer>
        </main>
      </div>
      
      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-10 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </div>
  );
};

const PageTransition = ({ children }: { children: React.ReactNode }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    transition={{ duration: 0.2 }}
  >
    {children}
  </motion.div>
);

export default function App() {
  return (
    <ErrorBoundary>
      <AppProviders>
        <BrowserRouter>
          <RoleProvider>
            <UndoToastProvider>
              <AppShell />
            </UndoToastProvider>
          </RoleProvider>
        </BrowserRouter>
      </AppProviders>
    </ErrorBoundary>
  );
}
