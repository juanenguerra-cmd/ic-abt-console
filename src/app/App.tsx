import React from "react";
import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation, useNavigate } from "react-router-dom";
import { AppProviders, useFacilityData, useDatabase } from "./providers";
import { RoleProvider, useRole } from "../context/RoleContext";
import { RoleGuard, NotAuthorisedPage } from "./guards/RoleGuard";
import { ErrorBoundary } from "./ErrorBoundary";
import { ResidentBoard } from "../features/ResidentBoard";
import { OutbreakManager } from "../features/Outbreaks";
import { SettingsConsole } from "../features/Settings";
import { QuarantineInbox } from "../features/Quarantine";
import { ShiftLogPage } from "../features/Notes/ShiftLogPage";
import { FloorMapPage } from "../features/FloorMapPage";
import { ReportBuilder } from "../features/Reports/ReportBuilder";
import { NoteGenerator } from "../features/Notes/NoteGenerator";
import { Dashboard } from "../features/Dashboard";
import { HomePage } from "../features/Home/HomePage";
import { NotificationsPage, useNotifications } from "../features/Notifications";
import StaffPage from '../features/Staff';
import ReportsConsole from '../features/Reports';
import DeviceUtilizationReport from '../features/Reports/DeviceUtilizationReport';
import InfectionControlAuditCenter from "../pages/InfectionControlAuditCenter";
import { GlobalSearch } from "../components/GlobalSearch";
import SyncStatusIndicator from "../components/SyncStatusIndicator";
import { UndoToastProvider } from "../components/UndoToast";
import { BackOfficePage } from "../pages/BackOfficePage";
import { AntibiogramPage } from "../pages/AntibiogramPage";
import UserGuidePage from "../pages/UserGuidePage";
import { LineListReportPage } from '../features/LineListReport';
import AnalyticsPage from '../features/Analytics';
import AdmissionScreeningPage from '../features/AdmissionScreening';

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
  ClipboardList,
  Bell,
  Database,
  Map,
  Activity,
  BookOpen,
  ShieldCheck,
  ChevronDown,
  Clock,
  AlertTriangle,
  BarChart3,
  Users2,
  Home,
  Cpu
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

const SidebarLink = ({ to, icon: Icon, label, badge, alertBadge, onClick }: { to: string, icon: React.ElementType, label: string, badge?: number, alertBadge?: boolean, onClick?: () => void }) => {
  return (
    <NavLink 
      to={to}
      onClick={onClick}
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

const SidebarAccordion = ({
  icon: Icon,
  title,
  badge,
  defaultOpen = false,
  children,
}: {
  icon: React.ElementType;
  title: string;
  badge?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) => {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);
  return (
    <div>
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center justify-between w-full px-3 py-2 text-sm font-medium rounded-md text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900 transition-colors"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3">
          <Icon className="w-5 h-5" aria-hidden="true" />
          {title}
        </div>
        <div className="flex items-center gap-2">
          {badge !== undefined && badge > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
              {badge}
            </span>
          )}
          <ChevronDown
            className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </div>
      </button>
      {isOpen && (
        <div className="mt-0.5 ml-4 space-y-0.5 border-l border-neutral-100 pl-3">
          {children}
        </div>
      )}
    </div>
  );
};

const SidebarSection = ({ title, children }: { title: string, children: React.ReactNode }) => (
  <div className="pt-4 pb-1 first:pt-0">
    <h3 className="px-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">
      {title}
    </h3>
    <div className="space-y-0.5">
      {children}
    </div>
  </div>
);

import { sessionService } from "../services/sessionService";
import { alertService } from "../services/alertService";
import { facilityService } from "../services/facilityService";

const AppShell = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { db } = useDatabase();
  const { activeFacilityId, setActiveFacilityId, store } = useFacilityData();
  const { notifications } = useNotifications();
  const { can, role, setRole } = useRole();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isFacilitySwitcherOpen, setIsFacilitySwitcherOpen] = React.useState(false);
  const facilitySwitcherRef = React.useRef<HTMLDivElement>(null);
  const [showBackupBanner, setShowBackupBanner] = React.useState(false);
  const [lastBackupLabel, setLastBackupLabel] = React.useState<string | null>(null);
  const [isLocked, setIsLocked] = React.useState(true);

  React.useEffect(() => {
    const updateBackupStatus = () => {
      const status = alertService.getBackupStatus();
      setShowBackupBanner(status.needsBackup);
      setLastBackupLabel(status.label);
    };
    
    updateBackupStatus();
    
    window.addEventListener('backup-completed', updateBackupStatus);
    const interval = setInterval(updateBackupStatus, 60000); // Update every minute
    
    return () => {
      window.removeEventListener('backup-completed', updateBackupStatus);
      clearInterval(interval);
    };
  }, []);

  // G6: Idle PIN lock — re-engage lock screen on route change when user has been idle
  React.useEffect(() => {
    if (isLocked) return;
    if (sessionService.isIdle()) {
      setIsLocked(true);
      return;
    }
    // Reset the activity timestamp on each route navigation
    sessionService.updateActivity();
  }, [location, isLocked]);

  // G6: Track user activity (clicks/keystrokes) to reset the idle timer
  React.useEffect(() => {
    return sessionService.setupActivityTracking();
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

  const facilities = facilityService.getFacilities(db);
  const activeFacility = facilityService.getActiveFacility(db, activeFacilityId);
  const quarantineCount = facilityService.getQuarantineCount(store);

  if (isLocked) {
    return (
      <LockScreen
        onUnlock={() => setIsLocked(false)}
        onAdminLogin={(password) => {
          if (password === "120316") {
            setRole('Admin');
            setIsLocked(false);
            return true;
          }
          return false;
        }}
      />
    );
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
            <span className="font-bold text-lg text-emerald-900 hidden sm:inline-block">ICN Console</span>
          </div>

          {/* Header Navigation - Removed to rely on sidebar */}
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex">
            <SyncStatusIndicator />
          </div>

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
              <span className="hidden sm:inline-block">{activeFacility?.name || "Select Facility"}</span>
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

          <div
            className="h-8 px-2 rounded-full bg-neutral-200 flex items-center justify-center text-neutral-700 font-medium text-xs gap-1.5"
            aria-label={`Current user: ${role}`}
            title={`Logged in as ${role}`}
          >
            {role === 'Admin' && <ShieldCheck className="w-3 h-3 text-indigo-600" aria-hidden="true" />}
            <span>{activeFacility?.auditorName
              ? activeFacility.auditorName.trim().split(/\s+/).filter(w => w.length > 0).slice(0, 2).map(w => w[0].toUpperCase()).join("")
              : "?"}</span>
            <span className="hidden sm:inline-block text-neutral-500">·</span>
            <span className="hidden sm:inline-block text-indigo-700 font-semibold">{role}</span>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Mobile menu overlay */}
        {isMobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-black/20 z-10 lg:hidden mt-16"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Sidebar Navigation */}
        <aside
          id="sidebar-nav"
          aria-label="Main navigation"
          className={`
            fixed inset-y-0 left-0 z-20 w-64 bg-white border-r border-neutral-200 transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static h-[calc(100dvh-4rem)] lg:h-full overflow-y-auto
            ${isMobileMenuOpen ? "translate-x-0 mt-16" : "-translate-x-full lg:mt-0"}
          `}
        >
          <nav 
            className="p-4 space-y-4" 
            aria-label="App sections"
            onClick={(e) => {
              if ((e.target as HTMLElement).closest('a')) {
                setIsMobileMenuOpen(false);
              }
            }}
          >
            <SidebarSection title="Overview">
              <SidebarLink to="/home" icon={Home} label="Home" />
              <SidebarLink to="/dashboard" icon={LayoutDashboard} label="Dashboard" />
              <SidebarLink to="/analytics" icon={BarChart3} label="Analytics" />
            </SidebarSection>
            
            <SidebarSection title="Residents">
              <SidebarLink to="/resident-board" icon={Users} label="Resident Board" />
              <SidebarLink to="/floor-map" icon={Map} label="Floor Map" />
            </SidebarSection>

            <SidebarSection title="Operations">
              <SidebarAccordion icon={AlertTriangle} title="Surveillance" badge={quarantineCount} defaultOpen={true}>
                <SidebarLink to="/outbreaks" icon={AlertCircle} label="Outbreaks" />
                <SidebarLink to="/linelist-report" icon={FileText} label="Line List Report" />
                {can('write:outbreaks') && <SidebarLink to="/quarantine" icon={Inbox} label="Quarantine Inbox" badge={quarantineCount} />}
              </SidebarAccordion>

              <SidebarAccordion icon={Clock} title="Daily Ops" badge={notifications?.length || 0} defaultOpen={true}>
                <SidebarLink to="/notifications" icon={Bell} label="Notifications" badge={notifications?.length || 0} alertBadge={(notifications?.length || 0) > 0} />
                {can('write:shiftlog') && <SidebarLink to="/chat" icon={MessageSquare} label="Shift Log" />}
                {can('write:shiftlog') && <SidebarLink to="/note-generator" icon={PenSquare} label="Note Generator" />}
              </SidebarAccordion>
            </SidebarSection>

            <SidebarSection title="Management">
              {(can('write:outbreaks') || can('write:audits') || can('write:admissionscreening')) && (
                <SidebarAccordion icon={FileBarChart} title="Reports & Audits">
                  {can('write:outbreaks') && (
                    <div className="pt-1 pb-0.5">
                      <span className="block px-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-0.5">Survey / Clinical</span>
                      <SidebarLink to="/reports" icon={ShieldCheck} label="Reports Console" />
                    </div>
                  )}
                  {can('write:outbreaks') && (
                    <div className="pt-1 pb-0.5">
                      <span className="block px-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-0.5">Stewardship</span>
                      <SidebarLink to="/reports/antibiogram" icon={Activity} label="Antibiogram" />
                      <SidebarLink to="/reports/devices" icon={Cpu} label="Device Reports" />
                    </div>
                  )}
                  {(can('write:admissionscreening') || can('write:audits')) && (
                    <div className="pt-1 pb-0.5">
                      <span className="block px-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-0.5">Compliance</span>
                      {can('write:admissionscreening') && <SidebarLink to="/admission-screening" icon={ClipboardList} label="Admission Screening" />}
                      {can('write:audits') && <SidebarLink to="/audit-center" icon={ClipboardCheck} label="Audit Center" />}
                      {can('write:audits') && <SidebarLink to="/report-builder" icon={FileBarChart} label="Report Builder" />}
                    </div>
                  )}
                </SidebarAccordion>
              )}

              <SidebarLink to="/staff" icon={Users2} label="Staff" />
            </SidebarSection>

            <SidebarSection title="System">
              <SidebarLink to="/user-guide" icon={BookOpen} label="User Guide" />
              {role === 'Admin' && <SidebarLink to="/back-office" icon={Database} label="Back Office" />}
              {role === 'Admin' && <SidebarLink to="/settings" icon={Settings} label="Settings" />}
            </SidebarSection>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto relative flex flex-col">
          <div className="flex-1">
            <AnimatePresence mode="wait">
              <Routes>
                <Route path="/home" element={<PageTransition><HomePage /></PageTransition>} />
                <Route path="/" element={<Navigate to="/home" replace />} />
                <Route path="/dashboard" element={<PageTransition><Dashboard /></PageTransition>} />
                <Route path="/resident-board" element={<PageTransition><ResidentBoard /></PageTransition>} />
                <Route path="/floor-map" element={<PageTransition><FloorMapPage /></PageTransition>} />
                <Route path="/floorplan" element={<Navigate to="/floor-map" replace />} />
                <Route path="/heatmap" element={<Navigate to="/floor-map" replace />} />
                <Route path="/staff" element={<PageTransition><StaffPage /></PageTransition>} />
                <Route path="/analytics" element={<PageTransition><AnalyticsPage /></PageTransition>} />
                
                <Route path="/chat" element={<PageTransition><RoleGuard allowedRoles={['Nurse','ICLead','Admin']}><ShiftLogPage /></RoleGuard></PageTransition>} />
                <Route path="/note-generator" element={<PageTransition><RoleGuard allowedRoles={['Nurse','ICLead','Admin']}><NoteGenerator /></RoleGuard></PageTransition>} />
                <Route path="/notifications" element={<PageTransition><NotificationsPage /></PageTransition>} />
                <Route path="/outbreaks" element={<PageTransition><RoleGuard allowedRoles={['Nurse','ICLead','Admin']}><OutbreakManager /></RoleGuard></PageTransition>} />
                <Route path="/reports" element={<PageTransition><RoleGuard allowedRoles={['Nurse','ICLead','Admin']}><ReportsConsole /></RoleGuard></PageTransition>} />
                <Route path="/reports/devices" element={<PageTransition><RoleGuard allowedRoles={['Nurse','ICLead','Admin']}><div className="p-6 max-w-6xl mx-auto"><DeviceUtilizationReport /></div></RoleGuard></PageTransition>} />
                <Route path="/reports/antibiogram" element={<PageTransition><RoleGuard allowedRoles={['Nurse','ICLead','Admin']}><AntibiogramPage /></RoleGuard></PageTransition>} />
                <Route path="/admission-screening" element={<PageTransition><RoleGuard allowedRoles={['Nurse','ICLead','Admin']}><AdmissionScreeningPage /></RoleGuard></PageTransition>} />
                <Route path="/linelist-report" element={<PageTransition><RoleGuard allowedRoles={['Nurse','ICLead','Admin']}><LineListReportPage /></RoleGuard></PageTransition>} />
                <Route path="/audit-center" element={<PageTransition><RoleGuard allowedRoles={['ICLead','Admin']}><InfectionControlAuditCenter /></RoleGuard></PageTransition>} />
                <Route path="/report-builder" element={<PageTransition><RoleGuard allowedRoles={['ICLead','Admin']}><ReportBuilder /></RoleGuard></PageTransition>} />
                <Route path="/quarantine" element={<PageTransition><RoleGuard allowedRoles={['ICLead','Admin']}><div className="p-6"><QuarantineInbox /></div></RoleGuard></PageTransition>} />
                <Route path="/settings" element={<PageTransition><RoleGuard allowedRoles={['Admin']}><div className="p-6"><SettingsConsole /></div></RoleGuard></PageTransition>} />
                <Route path="/back-office" element={<PageTransition><RoleGuard allowedRoles={['Admin']}><BackOfficePage /></RoleGuard></PageTransition>} />
                <Route path="/user-guide" element={<PageTransition><UserGuidePage /></PageTransition>} />
                <Route path="/not-authorised" element={<PageTransition><div className="p-6"><NotAuthorisedPage /></div></PageTransition>} />
                <Route path="*" element={<Navigate to="/home" replace />} />
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
        <RoleProvider>
          <BrowserRouter>
            <UndoToastProvider>
              <AppShell />
            </UndoToastProvider>
          </BrowserRouter>
        </RoleProvider>
      </AppProviders>
    </ErrorBoundary>
  );
}
