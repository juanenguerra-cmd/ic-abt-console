import React, { createContext, ReactNode, useCallback, useRef, useState } from "react";
import { startPrint } from "./startPrint";
import { PrintFeature } from "./printFlags";

export interface PrintOptions {
  extraCss?: string;
  onAfterPrint?: () => void;
  title?: string;
  feature?: PrintFeature;
}

export interface PrintContextValue {
  requestPrint: (node: ReactNode, options?: PrintOptions) => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export const PrintContext = createContext<PrintContextValue | null>(null);

export function PrintProvider({ children }: { children: ReactNode }) {
  const [printNode, setPrintNode] = useState<ReactNode>(null);
  const [options, setOptions] = useState<PrintOptions | undefined>(undefined);
  const contentRef = useRef<HTMLDivElement>(null);

  const requestPrint = useCallback((node: ReactNode, nextOptions?: PrintOptions) => {
    setPrintNode(node);
    setOptions(nextOptions);

    window.setTimeout(() => {
      const html = contentRef.current?.innerHTML || '';
      void startPrint('dom', nextOptions?.title ?? 'Print', () => ({
        title: nextOptions?.title ?? 'Print',
        html,
        pageStyle: nextOptions?.extraCss,
      }), { feature: nextOptions?.feature }).finally(() => {
        setPrintNode(null);
        setOptions(undefined);
        nextOptions?.onAfterPrint?.();
      });
    }, 0);
  }, []);

  return (
    <PrintContext.Provider value={{ requestPrint }}>
      {children}
      <div style={{ display: 'none' }}>
        <div ref={contentRef}>{printNode}</div>
      </div>
      {options?.extraCss ? <style>{options.extraCss}</style> : null}
    </PrintContext.Provider>
  );
}
