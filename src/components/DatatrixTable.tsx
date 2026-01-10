import { useMemo } from "react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, GridOptions } from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import "../styles/datatrix.css";

export type DatatrixTableProps<T> = {
  rows: T[];
  columns: ColDef<T>[];
  height?: number | string;
  loading?: boolean;
  emptyLabel?: string;
  getRowId?: (data: T) => string;
  onRowClick?: (row: T) => void;
};

export const DatatrixTable = <T,>({
  rows,
  columns,
  height,
  loading = false,
  emptyLabel = "No data available",
  getRowId,
  onRowClick,
}: DatatrixTableProps<T>) => {
  const defaultColDef = useMemo<ColDef<T>>(
    () => ({
      sortable: true,
      resizable: true,
      flex: 1,
      minWidth: 120,
    }),
    []
  );

  const gridOptions = useMemo<GridOptions<T>>(
    () => ({
      theme: "legacy",
      animateRows: true,
      rowHeight: 44,
      headerHeight: 42,
      suppressCellFocus: false,
      overlayNoRowsTemplate: `<span class="muted">${emptyLabel}</span>`,
      rowClass: onRowClick ? "datatrix-row-clickable" : undefined,
    }),
    [emptyLabel, onRowClick]
  );

  const tableClassName = `ag-theme-alpine datatrix-table${
    loading ? " loading" : ""
  }`;

  return (
    <div className="datatrix-root" style={height ? { height } : undefined}>
      <div className={tableClassName}>
        <AgGridReact
          rowData={rows}
          columnDefs={columns}
          defaultColDef={defaultColDef}
          gridOptions={gridOptions}
          domLayout={height ? "normal" : "autoHeight"}
          suppressRowClickSelection
          suppressCellFocus={false}
          overlayLoadingTemplate={
            loading ? "<span class='muted'>Loading...</span>" : undefined
          }
          getRowId={getRowId ? (params) => getRowId(params.data) : undefined}
          onRowClicked={
            onRowClick
              ? (event) => {
                  if (event.data) {
                    onRowClick(event.data);
                  }
                }
              : undefined
          }
        />
      </div>
    </div>
  );
};
