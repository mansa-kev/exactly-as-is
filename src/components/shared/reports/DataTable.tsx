import React from 'react';

export interface DataTableColumn<T> {
  key: string;
  header: React.ReactNode;
  render?: (row: T, i: number) => React.ReactNode;
  align?: 'left' | 'right' | 'center';
  className?: string;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey?: (row: T, i: number) => string | number;
  emptyMessage?: string;
  className?: string;
  maxHeight?: string;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  rows,
  rowKey,
  emptyMessage = 'No data available.',
  className = '',
  maxHeight,
}: DataTableProps<T>) {
  return (
    <div className={`bg-card border border-border rounded-2xl overflow-hidden ${className}`}>
      <div className="overflow-x-auto" style={maxHeight ? { maxHeight } : undefined}>
        <table className="w-full text-xs">
          <thead className={maxHeight ? 'sticky top-0 bg-card z-10' : ''}>
            <tr className="bg-muted/40 border-b border-border">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={`px-4 py-3 uppercase text-[10px] font-bold text-muted-foreground ${
                    c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left'
                  }`}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-muted-foreground">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr key={rowKey ? rowKey(row, i) : i} className="hover:bg-muted/30">
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={`px-4 py-3 ${
                        c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left'
                      } ${c.className || ''}`}
                    >
                      {c.render ? c.render(row, i) : (row as any)[c.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default DataTable;
