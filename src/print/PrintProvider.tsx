import React, {
  createContext,
  ReactNode,
  useCallback,
  useRef,
  useState,
} from "react";
import { useReactToPrint } from "react-to-print";

export interface PrintOptions {
  /** Optional CSS to inject into the print zone (e.g. landscape overrides). */
  extraCss?: string;
  /** Called after the browser print dialog closes. Use this to run cleanup (e.g. close modals). */
  onAfterPrint?: () => void;
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

export function PrintProvider({ children }: { children: ReactNode }) {
  const [printNode, setPrintNode] = useState<ReactNode>(null);
  const [extraCss, setExtraCss] = useState<string>("");
  const contentRef = useRef<HTMLDivElement>(null);
  const onAfterPrintRef = useRef<(() => void) | undefined>(undefined);

  const handlePrint = useReactToPrint({
    contentRef,
    pageStyle: extraCss,
    onAfterPrint: () => {
      setPrintNode(null);
      setExtraCss("");
      const cb = onAfterPrintRef.current;
      onAfterPrintRef.current = undefined;
      cb?.();
    },
  });

  const requestPrint = useCallback(
    (node: ReactNode, options?: PrintOptions) => {
      setPrintNode(node);
      setExtraCss(options?.extraCss ?? "");
      onAfterPrintRef.current = options?.onAfterPrint;
      
      // Defer so React has time to render the node into contentRef before printing
      setTimeout(() => {
        handlePrint();
      }, 50);
    },
    [handlePrint]
  );

  return (
    <PrintContext.Provider value={{ requestPrint }}>
      {children}

      {/* Hidden print portal — only visible to react-to-print */}
      <div style={{ display: "none" }}>
        <div ref={contentRef}>
          {printNode}
        </div>
      </div>
    </PrintContext.Provider>
  );
}
