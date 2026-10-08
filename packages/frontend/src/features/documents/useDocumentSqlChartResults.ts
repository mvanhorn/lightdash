import {
    isVizTableConfig,
    QueryExecutionContext,
    type ApiError,
    type ApiExecuteAsyncSqlQueryResults,
    type DocumentQueryReference,
    type DocumentSqlChart,
    type IResultsRunner,
    type VizColumn,
} from '@lightdash/common';
import { useQuery } from '@tanstack/react-query';
import { lightdashApi } from '../../api';
import getChartDataModel from '../../components/DataViz/transformers/getChartDataModel';
import { useProjectColorPalette } from '../../hooks/appearance/useProjectColorPalette';
import { getPivotQueryResults } from '../queryRunner/executeQuery';
import { SqlChartResultsRunner } from '../sqlRunner/runners/SqlRunnerResultsRunnerFrontend';

export type DocumentSqlChartResults = {
    resultsRunner: IResultsRunner;
    spec: Record<string, unknown>;
};

const runSavedChart = async (
    projectUuid: string,
    { documentUuid, versionUuid, chartId }: DocumentQueryReference,
    signal: AbortSignal | undefined,
) =>
    lightdashApi<ApiExecuteAsyncSqlQueryResults>({
        url: `/projects/${projectUuid}/documents/${documentUuid}/charts/${encodeURIComponent(chartId)}/query`,
        method: 'POST',
        body: JSON.stringify({ versionUuid }),
        signal,
    });

/** An unsaved chart runs as SQL Runner would; only its author, who has SQL Runner access, sees it. */
const runDraftChart = async (
    projectUuid: string,
    chart: DocumentSqlChart,
    signal: AbortSignal | undefined,
) =>
    lightdashApi<ApiExecuteAsyncSqlQueryResults>({
        url: `/projects/${projectUuid}/query/sql`,
        method: 'POST',
        version: 'v2',
        body: JSON.stringify({
            sql: chart.sql,
            limit: chart.limit,
            context: QueryExecutionContext.SQL_RUNNER,
            ...(!isVizTableConfig(chart.config) && chart.config.fieldConfig
                ? {
                      pivotConfiguration: {
                          indexColumn: chart.config.fieldConfig.x,
                          valuesColumns: chart.config.fieldConfig.y,
                          groupByColumns: chart.config.fieldConfig.groupBy,
                          sortBy: chart.config.fieldConfig.sortBy,
                      },
                  }
                : {}),
            ...(chart.warehouseConnectionUuid === undefined
                ? {}
                : { warehouseConnectionUuid: chart.warehouseConnectionUuid }),
        }),
        signal,
    });

/**
 * Runs a Document's SQL chart and prepares it like a saved SQL chart. A saved
 * chart runs from its Document version; `reference` is null for a draft.
 */
export const useDocumentSqlChartResults = ({
    projectUuid,
    spaceUuid,
    reference,
    chart,
}: {
    projectUuid: string;
    spaceUuid: string | null;
    reference: DocumentQueryReference | null;
    chart: DocumentSqlChart;
}) => {
    const palette = useProjectColorPalette(projectUuid, {
        spaceUuid: spaceUuid ?? undefined,
    });
    return useQuery<DocumentSqlChartResults, ApiError>({
        queryKey: [
            'document-sql-chart-results',
            projectUuid,
            reference ?? chart,
            palette.data?.colors,
        ],
        queryFn: async ({ signal }) => {
            const { queryUuid } = reference
                ? await runSavedChart(projectUuid, reference, signal)
                : await runDraftChart(projectUuid, chart, signal);
            const { originalColumns, ...pivotResults } =
                await getPivotQueryResults(projectUuid, queryUuid);
            const columns: VizColumn[] = Object.keys(pivotResults.columns).map(
                (field) => ({ reference: field }),
            );
            const resultsRunner = new SqlChartResultsRunner({
                pivotChartData: { ...pivotResults, columns },
                originalColumns,
            });
            const vizDataModel = getChartDataModel(
                resultsRunner,
                isVizTableConfig(chart.config)
                    ? chart.config.columns
                    : chart.config.fieldConfig,
                chart.config.type,
            );
            await vizDataModel.getPivotedChartData({
                sql: chart.sql,
                limit: chart.limit,
                sortBy: [],
                filters: [],
            });
            // Document charts are static, like dashboard tiles
            const spec = {
                ...vizDataModel.getSpec(
                    chart.config.display,
                    palette.data?.colors,
                ),
                animation: false,
            };
            return { resultsRunner, spec };
        },
        enabled: !palette.isInitialLoading,
        retry: false,
        refetchOnWindowFocus: false,
    });
};
