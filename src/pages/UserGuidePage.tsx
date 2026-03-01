import React from "react";

const sections = [
  {
    title: "Dashboard",
    purpose: "Daily command center for infection-control priorities.",
    bullets: [
      "Review active precautions and outbreak indicators.",
      "Check antibiotic stewardship trends at a glance.",
      "Jump quickly to resident and outbreak follow-up.",
    ],
  },
  {
    title: "Resident Board",
    purpose: "Primary resident surveillance and event tracking workspace.",
    bullets: [
      "Track infection status and precautions.",
      "Document IP events, vaccines, and antibiotic courses.",
      "Open resident profile and printable forms.",
    ],
  },
  {
    title: "Staff",
    purpose: "Manage staff records used in IC operations.",
    bullets: ["Maintain staff records.", "Support operational coordination during outbreaks."],
  },
  {
    title: "Outbreaks",
    purpose: "Create and monitor outbreak episodes.",
    bullets: ["Track active outbreaks and statuses.", "Keep outbreak timeline context and updates."],
  },
  {
    title: "Quarantine Inbox",
    purpose: "Intake queue for quarantine-related actions.",
    bullets: ["Review incoming quarantine items.", "Edit records and move cases into line-list workflows."],
  },
  {
    title: "Notes",
    purpose: "Clinical and operational documentation tools.",
    bullets: ["Generate AI-assisted notes.", "Maintain resident chat context and shift logs."],
  },
  {
    title: "Reports",
    purpose: "Build, run, and manage reporting outputs.",
    bullets: ["Create custom report criteria.", "Browse saved reports and export deliverables."],
  },
  {
    title: "Audit Center",
    purpose: "Structured audit documentation and print-ready output.",
    bullets: ["Complete infection-control audits.", "Produce printable compliance reports."],
  },
  {
    title: "Back Office",
    purpose: "Historical data administration and correction workflows.",
    bullets: ["Upload historical CSVs.", "Review and edit historical records."],
  },
  {
    title: "Settings",
    purpose: "Facility configuration and data management.",
    bullets: ["Configure units/rooms and monthly metrics.", "Run migrations and backup/restore."],
  },
  {
    title: "Lock Screen",
    purpose: "Protect app access on shared workstations.",
    bullets: ["Lock when stepping away.", "Require PIN before resuming work."],
  },
];

export default function UserGuidePage() {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-neutral-900">User Guide</h1>
        <p className="text-neutral-600">
          Screen-by-screen walkthrough of where to work in the IC Nurse Console.
        </p>
      </header>

      <section className="bg-indigo-50 border border-indigo-100 rounded-lg p-4">
        <h2 className="font-semibold text-indigo-900">Where to find this guide in the UI</h2>
        <p className="text-indigo-900/90 mt-1">
          Open the left sidebar and click <strong>User Guide</strong>.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {sections.map((section) => (
          <article key={section.title} className="bg-white border border-neutral-200 rounded-lg p-4">
            <h3 className="font-semibold text-neutral-900">{section.title}</h3>
            <p className="text-sm text-neutral-600 mt-1">{section.purpose}</p>
            <ul className="list-disc pl-5 mt-3 text-sm text-neutral-700 space-y-1">
              {section.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>
    </div>
  );
}
