import React, { useRef, useEffect } from "react";

interface EditableCellProps {
  autoValue: string;
  override?: string;
  autoFilled?: boolean;
  rowIndex: number;
  colKey: string;
  onSave: (rowIndex: number, colKey: string, value: string) => void;
  colSpan?: number;
  className?: string;
}

export function EditableCell({
  autoValue,
  override,
  autoFilled,
  rowIndex,
  colKey,
  onSave,
  colSpan,
  className,
}: EditableCellProps) {
  // Display priority: override > autoValue
  const displayValue = override !== undefined ? override : autoValue;

  // Track whether user has manually edited this cell
  const isOverridden = override !== undefined && override !== autoValue;

  const tdRef = useRef<HTMLTableCellElement>(null);

  // Sync displayValue to textContent without triggering re-render loops.
  // We only update when the cell is not focused so we don't clobber active edits.
  useEffect(() => {
    const el = tdRef.current;
    if (!el) return;
    if (document.activeElement !== el) {
      el.textContent = displayValue;
    }
  }, [displayValue]);

  const handleBlur = (e: React.FocusEvent<HTMLTableCellElement>) => {
    const newValue = e.currentTarget.textContent ?? "";
    onSave(rowIndex, colKey, newValue);
  };

  const classes = [
    "editable-cell",
    autoFilled && !isOverridden ? "autofill" : "",
    isOverridden ? "overridden" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <td
      ref={tdRef}
      colSpan={colSpan}
      contentEditable
      suppressContentEditableWarning
      onBlur={handleBlur}
      className={classes}
    />
  );
}
