import { IconChartBar, IconCode, IconTable } from '@tabler/icons-react';
import {
    SLASH_COMMAND_ITEMS,
    type SlashCommandItem,
} from '../../../ee/features/homepageBuilder/blocks/markdownEditor/slashCommandItems';

export const createDocumentSlashCommandItems = ({
    onInsertChart,
    onInsertSqlChart = null,
}: {
    /** Opens the chart editor to insert a chart at this document position; null hides the item. */
    onInsertChart: ((position: number) => void) | null;
    /** Opens the SQL chart editor at this document position; null hides the item. */
    onInsertSqlChart?: ((position: number) => void) | null;
}): SlashCommandItem[] => [
    ...SLASH_COMMAND_ITEMS,
    {
        id: 'table',
        label: 'Table',
        description: 'Rows and columns',
        icon: IconTable,
        run: (editor, range) =>
            editor
                .chain()
                .focus()
                .deleteRange(range)
                .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                .run(),
    },
    ...(onInsertChart
        ? [
              {
                  id: 'chart',
                  label: 'Chart',
                  description: 'Query the semantic layer',
                  icon: IconChartBar,
                  run: (editor, range) => {
                      editor.chain().focus().deleteRange(range).run();
                      onInsertChart(range.from);
                  },
              } satisfies SlashCommandItem,
          ]
        : []),
    ...(onInsertSqlChart
        ? [
              {
                  id: 'sql-chart',
                  label: 'SQL chart',
                  description: 'Write SQL against the warehouse',
                  icon: IconCode,
                  run: (editor, range) => {
                      editor.chain().focus().deleteRange(range).run();
                      onInsertSqlChart(range.from);
                  },
              } satisfies SlashCommandItem,
          ]
        : []),
];
