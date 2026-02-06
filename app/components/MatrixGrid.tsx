import React, { useState, useEffect, useRef } from "react";

interface MatrixGridProps {
  widthBreakpoints: number[];
  heightBreakpoints: number[];
  cells: Map<string, number>;
  unit: string;
  onCellChange: (col: number, row: number, value: number | null) => void;
  onAddWidthBreakpoint: (value: number) => void;
  onAddHeightBreakpoint: (value: number) => void;
  onRemoveWidthBreakpoint: (index: number) => void;
  onRemoveHeightBreakpoint: (index: number) => void;
  emptyCells: Set<string>;
}

export const MatrixGrid = React.memo(function MatrixGrid({
  widthBreakpoints,
  heightBreakpoints,
  cells,
  unit,
  onCellChange,
  onAddWidthBreakpoint,
  onAddHeightBreakpoint,
  onRemoveWidthBreakpoint,
  onRemoveHeightBreakpoint,
  emptyCells,
}: MatrixGridProps) {
  // Roving tabindex state for keyboard navigation
  const [focusedRow, setFocusedRow] = useState(0);
  const [focusedCol, setFocusedCol] = useState(0);
  const cellRefs = useRef<Map<string, HTMLTableCellElement>>(new Map());

  // Clamp focus coordinates when grid changes
  useEffect(() => {
    const maxRow = heightBreakpoints.length - 1;
    const maxCol = widthBreakpoints.length - 1;

    if (focusedRow > maxRow) setFocusedRow(Math.max(0, maxRow));
    if (focusedCol > maxCol) setFocusedCol(Math.max(0, maxCol));
  }, [widthBreakpoints.length, heightBreakpoints.length, focusedRow, focusedCol]);

  // Focus the active cell when coordinates change
  useEffect(() => {
    const key = `${focusedCol},${focusedRow}`;
    const cell = cellRefs.current.get(key);
    if (cell) {
      cell.focus();
    }
  }, [focusedRow, focusedCol]);
  const handleAddWidthBreakpoint = () => {
    const value = prompt("Enter width breakpoint value:");
    if (value === null) return;

    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue <= 0) {
      alert("Please enter a positive number");
      return;
    }

    onAddWidthBreakpoint(numValue);
  };

  const handleAddHeightBreakpoint = () => {
    const value = prompt("Enter height breakpoint value:");
    if (value === null) return;

    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue <= 0) {
      alert("Please enter a positive number");
      return;
    }

    onAddHeightBreakpoint(numValue);
  };

  const handleCellChange = (col: number, row: number, value: string) => {
    if (value === "") {
      onCellChange(col, row, null);
      return;
    }

    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
      onCellChange(col, row, null);
      return;
    }

    onCellChange(col, row, numValue);
  };

  const getCellKey = (col: number, row: number) => `${col},${row}`;

  const handleCellKeyDown = (
    e: React.KeyboardEvent<HTMLTableCellElement>,
    col: number,
    row: number
  ) => {
    const maxRow = heightBreakpoints.length - 1;
    const maxCol = widthBreakpoints.length - 1;

    switch (e.key) {
      case "ArrowRight":
        e.preventDefault();
        if (col < maxCol) {
          setFocusedCol(col + 1);
          setFocusedRow(row);
        }
        break;
      case "ArrowLeft":
        e.preventDefault();
        if (col > 0) {
          setFocusedCol(col - 1);
          setFocusedRow(row);
        }
        break;
      case "ArrowDown":
        e.preventDefault();
        if (row < maxRow) {
          setFocusedRow(row + 1);
          setFocusedCol(col);
        }
        break;
      case "ArrowUp":
        e.preventDefault();
        if (row > 0) {
          setFocusedRow(row - 1);
          setFocusedCol(col);
        }
        break;
      case "Enter":
        e.preventDefault();
        const input = e.currentTarget.querySelector("input");
        if (input) input.focus();
        break;
      case "Escape":
        e.preventDefault();
        const activeInput = document.activeElement as HTMLInputElement;
        if (activeInput && activeInput.tagName === "INPUT") {
          activeInput.blur();
          e.currentTarget.focus();
        }
        break;
      case "Tab":
        e.preventDefault();
        if (e.shiftKey) {
          // Shift+Tab: move to previous cell
          if (col > 0) {
            setFocusedCol(col - 1);
            setFocusedRow(row);
          } else if (row > 0) {
            // Wrap to last cell of previous row
            setFocusedCol(maxCol);
            setFocusedRow(row - 1);
          } else {
            // First cell: allow default Tab to exit grid
            return;
          }
        } else {
          // Tab: move to next cell
          if (col < maxCol) {
            setFocusedCol(col + 1);
            setFocusedRow(row);
          } else if (row < maxRow) {
            // Wrap to first cell of next row
            setFocusedCol(0);
            setFocusedRow(row + 1);
          } else {
            // Last cell: allow default Tab to exit grid
            return;
          }
        }
        break;
      case "Home":
        e.preventDefault();
        setFocusedCol(0);
        setFocusedRow(row);
        break;
      case "End":
        e.preventDefault();
        setFocusedCol(maxCol);
        setFocusedRow(row);
        break;
    }
  };

  return (
    <div style={{ overflowX: "auto" }}>
      <table
        role="grid"
        aria-label="Price matrix editor"
        style={{
          borderCollapse: "collapse",
          width: "100%",
        }}
      >
        <thead>
          <tr role="row">
            <th
              style={{
                border: "1px solid #e1e3e5",
                padding: "4px 8px",
                background: "#f6f6f7",
                fontWeight: 600,
              }}
            >
              {/* Empty corner cell */}
            </th>
            {widthBreakpoints.map((bp, index) => (
              <th
                key={index}
                role="columnheader"
                style={{
                  border: "1px solid #e1e3e5",
                  padding: "4px 8px",
                  background: "#f6f6f7",
                  fontWeight: 600,
                  textAlign: "right",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "8px",
                  }}
                >
                  <span>
                    {bp} {unit}
                  </span>
                  {widthBreakpoints.length > 1 && (
                    <button
                      type="button"
                      onClick={() => onRemoveWidthBreakpoint(index)}
                      style={{
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        color: "#bf0711",
                        fontSize: "14px",
                        padding: "0 4px",
                      }}
                      title="Remove column"
                    >
                      ×
                    </button>
                  )}
                </div>
              </th>
            ))}
            {widthBreakpoints.length < 50 && (
              <th
                style={{
                  border: "1px solid #e1e3e5",
                  padding: "4px 8px",
                  background: "#f6f6f7",
                }}
              >
                <button
                  type="button"
                  onClick={handleAddWidthBreakpoint}
                  style={{
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    color: "#2c6ecb",
                    fontSize: "16px",
                    fontWeight: "bold",
                  }}
                  title="Add width breakpoint"
                >
                  +
                </button>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {heightBreakpoints.map((heightBp, rowIndex) => (
            <tr key={rowIndex} role="row">
              <th
                role="rowheader"
                style={{
                  border: "1px solid #e1e3e5",
                  padding: "4px 8px",
                  background: "#f6f6f7",
                  fontWeight: 600,
                  textAlign: "right",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "8px",
                  }}
                >
                  <span>
                    {heightBp} {unit}
                  </span>
                  {heightBreakpoints.length > 1 && (
                    <button
                      type="button"
                      onClick={() => onRemoveHeightBreakpoint(rowIndex)}
                      style={{
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        color: "#bf0711",
                        fontSize: "14px",
                        padding: "0 4px",
                      }}
                      title="Remove row"
                    >
                      ×
                    </button>
                  )}
                </div>
              </th>
              {widthBreakpoints.map((widthBp, colIndex) => {
                const cellKey = getCellKey(colIndex, rowIndex);
                const cellValue = cells.get(cellKey);
                const isEmpty = emptyCells.has(cellKey);
                const isFocused = focusedRow === rowIndex && focusedCol === colIndex;

                return (
                  <td
                    key={colIndex}
                    role="gridcell"
                    tabIndex={isFocused ? 0 : -1}
                    ref={(el) => {
                      if (el) {
                        cellRefs.current.set(cellKey, el);
                      } else {
                        cellRefs.current.delete(cellKey);
                      }
                    }}
                    onKeyDown={(e) => handleCellKeyDown(e, colIndex, rowIndex)}
                    style={{
                      border: "1px solid #e1e3e5",
                      padding: "4px 8px",
                      textAlign: "right",
                      background: isEmpty ? "#fff4f4" : "transparent",
                      outline: isFocused ? "2px solid #2c6ecb" : "none",
                      outlineOffset: "-2px",
                    }}
                  >
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={cellValue ?? ""}
                      onChange={(e) =>
                        handleCellChange(colIndex, rowIndex, e.target.value)
                      }
                      aria-label={`Price for ${widthBp} ${unit} width by ${heightBp} ${unit} height`}
                      tabIndex={-1}
                      style={{
                        width: "80px",
                        textAlign: "right",
                        border: "none",
                        background: "transparent",
                        fontSize: "14px",
                      }}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
          {heightBreakpoints.length < 50 && (
            <tr>
              <td
                colSpan={widthBreakpoints.length + 1}
                style={{
                  border: "1px solid #e1e3e5",
                  padding: "4px 8px",
                  textAlign: "center",
                  background: "#f6f6f7",
                }}
              >
                <button
                  type="button"
                  onClick={handleAddHeightBreakpoint}
                  style={{
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    color: "#2c6ecb",
                    fontSize: "16px",
                    fontWeight: "bold",
                  }}
                  title="Add height breakpoint"
                >
                  +
                </button>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
});
