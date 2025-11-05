import React from 'react';
import {
  TableRoot,
  TableHeader,
  TableBody,
  TableRow,
  TableColumnHeader,
  TableCell,
  TableCaption,
  Box,
  Text,
} from '@chakra-ui/react';

export type ColumnAlignment = 'left' | 'center' | 'right';

export interface DataTableColumn<T> {
  header: React.ReactNode;
  accessor: (row: T, index: number) => React.ReactNode;
  align?: ColumnAlignment;
  width?: string | number;
}

export interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  caption?: string;
  keyExtractor?: (row: T, index: number) => React.Key;
  emptyState?: React.ReactNode;
  isStriped?: boolean;
}

export function DataTable<T>({
  data,
  columns,
  caption,
  keyExtractor,
  emptyState,
  isStriped = true,
}: DataTableProps<T>) {
  if (!data.length) {
    return (
      <Box
        border="1px solid"
        borderColor="border.subtle"
        borderRadius="lg"
        bg="bg.surface"
        px={6}
        py={10}
        textAlign="center"
      >
        {emptyState || (
          <Text color="text.secondary" fontSize="sm">
            No records yet. Add your first entry to populate this table.
          </Text>
        )}
      </Box>
    );
  }

  return (
    <Box border="1px solid" borderColor="border.subtle" borderRadius="lg" overflow="hidden">
      <TableRoot width="100%" captionSide="top">
        {caption && <TableCaption fontWeight="600">{caption}</TableCaption>}
        <TableHeader>
          <TableRow bg="brand.surface">
            {columns.map((column, index) => (
              <TableColumnHeader
                key={index}
                textAlign={column.align ?? 'left'}
                fontSize="sm"
                color="text.secondary"
                fontWeight="600"
                scope="col"
                width={column.width}
              >
                {column.header}
              </TableColumnHeader>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, rowIndex) => (
            <TableRow
              key={keyExtractor ? keyExtractor(row, rowIndex) : rowIndex}
              bg={isStriped && rowIndex % 2 === 1 ? 'brand.surface' : undefined}
            >
              {columns.map((column, colIndex) => (
                <TableCell
                  key={colIndex}
                  textAlign={column.align ?? 'left'}
                  fontSize="sm"
                  color="text.primary"
                >
                  {column.accessor(row, rowIndex)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </TableRoot>
    </Box>
  );
}

export default DataTable;
