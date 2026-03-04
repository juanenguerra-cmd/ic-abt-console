import { useContext } from "react";
import { PrintContext, PrintContextValue } from "./PrintProvider";

export function usePrint(): PrintContextValue {
  const ctx = useContext(PrintContext);
  if (!ctx) {
    throw new Error("usePrint must be used within a PrintProvider");
  }
  return ctx;
}
