import React from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Activity, Users, Map, FileText, Settings, ShieldAlert } from "lucide-react";

const navItems = [
  { name: "Resident Board", path: "/", icon: Users },
  { name: "Heatmap", path: "/heatmap", icon: Map },
  { name: "Census Parser", path: "/census", icon: FileText },
  { name: "Outbreaks", path: "/outbreaks", icon: ShieldAlert },
  { name: "Reports & Exports", path: "/reports", icon: Activity },
  { name: "Settings", path: "/settings", icon: Settings },
];

export function Layout() {
  const location = useLocation();

  return (
    <div className="flex h-screen bg-neutral-50 text-neutral-900 font-sans">
      <aside className="w-64 bg-white border-r border-neutral-200 flex flex-col">
        <div className="p-6">
          <h1 className="text-lg font-semibold tracking-tight text-emerald-700">
            Infection Control & Antibiotic Stewardship Console
          </h1>
        </div>
        <nav className="flex-1 px-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  isActive
                    ? "bg-emerald-50 text-emerald-700"
                    : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                }`}
              >
                <Icon className="mr-3 h-5 w-5 flex-shrink-0" />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
