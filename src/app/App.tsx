import React from "react";
import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation } from "react-router-dom";
import { AppProviders, useFacilityData, useDatabase } from "./providers";
import { ResidentBoard } from "../features/ResidentBoard";
import { OutbreakManager } from "../features/Outbreaks";
import { PacketBuilder } from "../features/SurveyPackets/PacketBuilder";
import { SettingsConsole } from "../features/Settings";
import { QuarantineInbox } from "../features/Quarantine";
import { FloorMap } from "../features/Heatmap/FloorMap";
import { ResidentChat } from "../features/Notes";
import { ReportBuilder } from "../features/Reports/ReportBuilder";
import { NoteGenerator } from "../features/Notes/NoteGenerator";
import { Dashboard } from "../features/Dashboard";
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
  PenSquare
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// --- Layout Shell ---

const SidebarLink = ({ to, icon: Icon, label, badge }: { to: string, icon: any, label: string, badge?: number }) => {
  return (
    <NavLink 
      to={to}
      className={({ isActive }) => `
        flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors
        ${isActive 
          ? "bg-neutral-100 text-neutral-900" 
          : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
        }
      `}
    >
      <div className="flex items-center gap-3">
        <Icon className="w-5 h-5" />
        {label}
      </div>
      {badge !== undefined && badge > 0 && (
        <span className="bg-neutral-200 text-neutral-600 px-2 py-0.5 rounded-full text-xs font-bold">
          {badge}
        </span>
      )}
    </NavLink>
  );
};

const AppShell = () => {
  const { db } = useDatabase();
  const { activeFacilityId, setActiveFacilityId, store } = useFacilityData();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const facilities = Object.values(db.data.facilities.byId) as any[];
  const activeFacility = db.data.facilities.byId[activeFacilityId];
  const quarantineCount = Object.keys(store.quarantine).length;

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      {/* Top Navigation */}
      <header className="bg-white border-b border-neutral-200 h-16 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button 
            className="lg:hidden p-2 -ml-2 text-neutral-500 hover:bg-neutral-100 rounded-md"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
          
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg text-neutral-900 hidden sm:inline-block">ICN Console</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative group">
            <button className="flex items-center gap-2 text-sm font-medium text-neutral-700 hover:text-neutral-900 px-3 py-1.5 rounded-md hover:bg-neutral-50 border border-transparent hover:border-neutral-200 transition-all">
              <span>{activeFacility?.name || "Select Facility"}</span>
              <Building2 className="w-4 h-4 text-neutral-400" />
            </button>
            
            {/* Facility Switcher Dropdown */}
            <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-md shadow-lg border border-neutral-200 py-1 hidden group-hover:block">
              {facilities.map(f => (
                <button
                  key={f.id}
                  onClick={() => setActiveFacilityId(f.id)}
                  className={`w-full text-left px-4 py-2 text-sm ${
                    activeFacilityId === f.id ? "bg-indigo-50 text-indigo-700 font-medium" : "text-neutral-700 hover:bg-neutral-50"
                  }`}
                >
                  {f.name}
                </button>
              ))}
            </div>
          </div>
          
          <div className="h-8 w-8 rounded-full bg-neutral-200 flex items-center justify-center text-neutral-500 font-medium text-sm">
            JD
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Navigation */}
        <aside className={`
          fixed inset-y-0 left-0 z-20 w-64 bg-white border-r border-neutral-200 transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:h-[calc(100vh-4rem)]
          ${isMobileMenuOpen ? "translate-x-0 mt-16" : "-translate-x-full lg:mt-0"}
        `}>
          <nav className="p-4 space-y-1">
            <SidebarLink to="/" icon={LayoutDashboard} label="Dashboard" />
            <SidebarLink to="/residents" icon={Users} label="Resident Board" />
            <SidebarLink to="/chat" icon={MessageSquare} label="Shift Log" />
            <SidebarLink to="/note-generator" icon={PenSquare} label="Note Generator" />
            <SidebarLink to="/outbreaks" icon={AlertCircle} label="Outbreaks" />
            <SidebarLink to="/reports" icon={FileText} label="Survey Packets" />
            <SidebarLink to="/report-builder" icon={FileBarChart} label="Report Builder" />
            <SidebarLink to="/quarantine" icon={Inbox} label="Quarantine Inbox" badge={quarantineCount} />
            
            <div className="pt-4 mt-4 border-t border-neutral-100">
              <SidebarLink to="/settings" icon={Settings} label="Settings" />
            </div>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto relative">
          <AnimatePresence mode="wait">
            <Routes>
              <Route path="/" element={<PageTransition><Dashboard /></PageTransition>} />
              <Route path="/residents" element={<PageTransition><ResidentBoard /></PageTransition>} />
              <Route path="/chat" element={<PageTransition><div className="p-6"><ResidentChat /></div></PageTransition>} />
              <Route path="/note-generator" element={<PageTransition><NoteGenerator /></PageTransition>} />
              <Route path="/outbreaks" element={<PageTransition><OutbreakManager /></PageTransition>} />
              <Route path="/reports" element={<PageTransition><PacketBuilder /></PageTransition>} />
              <Route path="/report-builder" element={<PageTransition><ReportBuilder /></PageTransition>} />
              <Route path="/quarantine" element={<PageTransition><div className="p-6"><QuarantineInbox /></div></PageTransition>} />
              <Route path="/settings" element={<PageTransition><div className="p-6"><SettingsConsole /></div></PageTransition>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AnimatePresence>
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
    <AppProviders>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </AppProviders>
  );
}
