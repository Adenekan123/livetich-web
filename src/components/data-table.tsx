'use client';

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';
import type {
  TableColumn,
  TableStyles,
} from 'react-data-table-component';

/**
 * App-wide data table, built on react-data-table-component. Rendered client-only
 * (`ssr: false`) so its styled-components styles never run during SSR — that
 * keeps us from having to wire a styled-components registry into the root
 * layout, and avoids hydration flashes. Sorting, pagination and a themed look
 * come for free; callers just pass `columns` + `data`.
 */

// The library's default export is the table component; typed generically here.
const RDT = dynamic(() => import('react-data-table-component'), {
  ssr: false,
  loading: () => (
    <div className="py-10 text-center text-sm text-neutral-400">
      Loading table…
    </div>
  ),
}) as ComponentType<Record<string, unknown>>;

/** Neutral/teal theme matching the app's design tokens. */
const styles: TableStyles = {
  table: { style: { background: 'transparent' } },
  head: {
    style: {
      fontSize: '11px',
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
      color: '#737373', // neutral-500
    },
  },
  headRow: {
    style: {
      background: 'transparent',
      borderBottomColor: '#e5e5e5', // neutral-200
      minHeight: '40px',
    },
  },
  rows: {
    style: {
      fontSize: '14px',
      color: '#171717', // neutral-900
      minHeight: '52px',
    },
    highlightOnHoverStyle: {
      backgroundColor: '#f7fdfb', // faint signal tint
      transitionDuration: '0.15s',
      outline: 'none',
    },
  },
  pagination: {
    style: { borderTopColor: '#e5e5e5', fontSize: '13px', color: '#525252' },
  },
  noData: { style: { background: 'transparent', color: '#a3a3a3' } },
};

export interface DataTableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  /** Show the built-in pager (default on when rows exceed the page size). */
  pagination?: boolean;
  /** Compact row height. */
  dense?: boolean;
  /** Message shown when `data` is empty. */
  noDataText?: string;
  /** Optional persisted default sort column id. */
  defaultSortFieldId?: string | number;
  /** Default sort direction (true = ascending). */
  defaultSortAsc?: boolean;
}

export function DataTable<T>({
  columns,
  data,
  pagination = true,
  dense = false,
  noDataText = 'Nothing to show yet.',
  defaultSortFieldId,
  defaultSortAsc = true,
}: DataTableProps<T>) {
  return (
    <RDT
      columns={columns as unknown as Record<string, unknown>[]}
      data={data as unknown as Record<string, unknown>[]}
      customStyles={styles}
      pagination={pagination}
      paginationPerPage={10}
      paginationRowsPerPageOptions={[10, 25, 50, 100]}
      dense={dense}
      highlightOnHover
      persistTableHead
      defaultSortFieldId={defaultSortFieldId}
      defaultSortAsc={defaultSortAsc}
      noDataComponent={
        <div className="py-10 text-center text-sm text-neutral-400">
          {noDataText}
        </div>
      }
    />
  );
}
