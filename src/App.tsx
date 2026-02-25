import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { DBProvider } from "./context/DBContext";
import { Layout } from "./components/Layout";
import { ResidentBoard } from "./pages/ResidentBoard";
import { Heatmap } from "./pages/Heatmap";
import { CensusParser } from "./pages/CensusParser";
import { Outbreaks } from "./pages/Outbreaks";
import { Reports } from "./pages/Reports";
import { Settings } from "./pages/Settings";

export default function App() {
  return (
    <DBProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<ResidentBoard />} />
            <Route path="heatmap" element={<Heatmap />} />
            <Route path="census" element={<CensusParser />} />
            <Route path="outbreaks" element={<Outbreaks />} />
            <Route path="reports" element={<Reports />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </DBProvider>
  );
}
