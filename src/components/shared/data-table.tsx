"use client";

import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type ColumnDef,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function DataTable<TData extends object>({
  data,
  columns,
  searchPlaceholder = "Search...",
  globalFilterValue,
  onGlobalFilterValueChange,
  onVisibleRowsChange,
  onPageRowsChange,
  onRowClick,
}: {
  data: TData[];
  columns: ColumnDef<TData>[];
  searchPlaceholder?: string;
  globalFilterValue?: string;
  onGlobalFilterValueChange?: (value: string) => void;
  onVisibleRowsChange?: (rows: TData[]) => void;
  onPageRowsChange?: (rows: TData[]) => void;
  onRowClick?: (row: TData) => void;
}) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [globalFilterState, setGlobalFilterState] = React.useState("");
  const [columnVisibility, setColumnVisibility] = React.useState<Record<string, boolean>>({});
  const lastVisibleRowsRef = React.useRef<TData[]>([]);
  const lastPageRowsRef = React.useRef<TData[]>([]);
  const globalFilter = globalFilterValue ?? globalFilterState;
  const setGlobalFilter = onGlobalFilterValueChange ?? setGlobalFilterState;

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      globalFilter,
      columnVisibility,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  React.useEffect(() => {
    if (!onVisibleRowsChange) return;
    const nextRows = table.getFilteredRowModel().rows.map((row) => row.original);
    const prevRows = lastVisibleRowsRef.current;
    const changed = prevRows.length !== nextRows.length || prevRows.some((row, index) => row !== nextRows[index]);
    if (!changed) return;
    lastVisibleRowsRef.current = nextRows;
    onVisibleRowsChange(nextRows);
  });

  React.useEffect(() => {
    if (!onPageRowsChange) return;
    const nextRows = table.getRowModel().rows.map((row) => row.original);
    const prevRows = lastPageRowsRef.current;
    const changed = prevRows.length !== nextRows.length || prevRows.some((row, index) => row !== nextRows[index]);
    if (!changed) return;
    lastPageRowsRef.current = nextRows;
    onPageRowsChange(nextRows);
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Input
          value={globalFilter}
          onChange={(event) => setGlobalFilter(event.target.value)}
          placeholder={searchPlaceholder}
          className="max-w-sm"
        />
        <div className="flex flex-wrap items-center gap-2">
          <div className="group relative">
            <Button type="button" variant="outline" size="sm">
              <SlidersHorizontal className="h-4 w-4" />
              Columns
            </Button>
            <div className="invisible absolute right-0 z-20 mt-2 w-52 rounded-xl border border-slate-200 bg-white p-2 opacity-0 shadow-xl transition group-hover:visible group-hover:opacity-100">
              {table
                .getAllLeafColumns()
                .filter((column) => column.getCanHide())
                .map((column) => (
                  <label key={column.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={column.getIsVisible()}
                      onChange={column.getToggleVisibilityHandler()}
                    />
                    {column.id}
                  </label>
                ))}
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder ? null : (
                        <button
                          type="button"
                          className="flex items-center gap-1 font-bold"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getIsSorted() === "asc" ? "A-Z" : header.column.getIsSorted() === "desc" ? "Z-A" : ""}
                        </button>
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                    className={onRowClick ? "cursor-pointer transition hover:bg-slate-50/80" : undefined}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell className="h-28 text-center text-slate-500" colSpan={columns.length}>
                    No results found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex flex-col gap-3 text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
        <span>
          Showing {table.getRowModel().rows.length} of {table.getFilteredRowModel().rows.length} rows
        </span>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
            Previous
          </Button>
          <span className="font-semibold text-slate-700">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </span>
          <Button type="button" variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
