import React, {
  createContext,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

export interface PrintOptions {
  /** Optional CSS to inject into the print zone (e.g. landscape overrides). */
  extraCss?: string;
}

export interface PrintContextValue {
  /**
   * Render `node` into an isolated print zone and trigger window.print().
   * The zone is torn down automatically after the print dialog closes.
   */
  requestPrint: (node: ReactNode, options?: PrintOptions) => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export const PrintContext = createContext<PrintContextValue | null>(null);

/** Stable container appended once to document.body for the print portal. */
function getOrCreatePrintRoot(): HTMLElement {
  let el = document.getElementById("print-root");
  if (!el) {
    el = document.createElement("div");
    el.id = "print-root";
    document.body.appendChild(el);
  }
  return el;
}

export function PrintProvider({ children }: { children: ReactNode }) {
  const [printNode, setPrintNode] = useState<ReactNode>(null);
  const [extraCss, setExtraCss] = useState<string>("");
  const printRootRef = useRef<HTMLElement | null>(null);

  // Create the portal container on mount.
  useEffect(() => {
    printRootRef.current = getOrCreatePrintRoot();
  }, []);

  // Tear down print content when the browser print dialog closes.
  useEffect(() => {
    const cleanup = () => {
      setPrintNode(null);
      setExtraCss("");
    };
    window.addEventListener("afterprint", cleanup);
    return () => window.removeEventListener("afterprint", cleanup);
  }, []);

  const requestPrint = useCallback(
    (node: ReactNode, options?: PrintOptions) => {
      setPrintNode(node);
      setExtraCss(options?.extraCss ?? "");
      // Defer so React has time to render the portal before the dialog opens.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.print();
        });
      });
    },
    []
  );

  const printRoot = printRootRef.current;

  return (
    <PrintContext.Provider value={{ requestPrint }}>
      {/* Global print styles: hide the app, show the print zone. */}
      <style>{`
        #print-root { display: none; }
        @media print {
          #root { display: none !important; }
          #print-root {
            display: block !important;
            position: fixed;
            inset: 0;
            width: 100%;
            height: auto;
            background: white;
            color: black;
          }
        }
      `}</style>

      {children}

      {/* Isolated print portal — only visible during window.print(). */}
      {printRoot &&
        printNode &&
        createPortal(
          <>
            {extraCss && <style>{extraCss}</style>}
            {printNode}
          </>,
          printRoot
        )}
    </PrintContext.Provider>
  );
}
