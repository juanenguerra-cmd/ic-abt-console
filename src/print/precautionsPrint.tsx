import { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const PRECAUTIONS_PRINT_KEY = 'PRECAUTIONS_PRINT_PAYLOAD_V1';

export interface PrecautionsPrintPayload {
  title?: string;
  html: string;
  pageStyle?: string;
}

export function savePrecautionsPrintPayload(payload: PrecautionsPrintPayload): void {
  sessionStorage.setItem(PRECAUTIONS_PRINT_KEY, JSON.stringify(payload));
}

export function loadPrecautionsPrintPayload(): PrecautionsPrintPayload | null {
  try {
    const raw = sessionStorage.getItem(PRECAUTIONS_PRINT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PrecautionsPrintPayload;
  } catch {
    return null;
  }
}

export function clearPrecautionsPrintPayload(): void {
  sessionStorage.removeItem(PRECAUTIONS_PRINT_KEY);
}

export function openPrecautionsPrintWindow(payload: PrecautionsPrintPayload): void {
  savePrecautionsPrintPayload(payload);
  const w = window.open('/print/precautions', '_blank', 'noopener,noreferrer');
  if (!w) {
    window.alert('Popup blocked. Please allow popups for this site to print.');
  }
}

export function printPrecautionsNode(node: ReactNode, options?: { title?: string; extraCss?: string }): void {
  openPrecautionsPrintWindow({
    title: options?.title,
    pageStyle: options?.extraCss,
    html: renderToStaticMarkup(<>{node}</>),
  });
}
