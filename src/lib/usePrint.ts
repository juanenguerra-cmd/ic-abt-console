import { useReactToPrint } from 'react-to-print';
import type { RefObject } from 'react';

export const BASE_PAGE_STYLE = `
  @page {
    size: auto;
    margin: 20mm;
  }
`;

export function usePrint(
  contentRef: RefObject<HTMLElement | null>,
  documentTitle: string,
  pageStyle?: string
) {
  return useReactToPrint({
    contentRef,
    documentTitle,
    pageStyle,
  });
}
