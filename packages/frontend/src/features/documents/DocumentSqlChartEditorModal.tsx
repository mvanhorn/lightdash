import {
    ChartKind,
    getFieldQuoteChar,
    type DocumentSqlChart,
} from '@lightdash/common';
import { Button, Group, Stack, Text, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useEffect, useState } from 'react';
import { Provider } from 'react-redux';
import { useMount, useUnmount } from 'react-use';
import MantineModal from '../../components/common/MantineModal';
import Page from '../../components/common/Page/Page';
import {
    resetChartState,
    setChartConfig,
} from '../../components/DataViz/store/actions/commonChartActions';
import { selectCompleteConfigByKind } from '../../components/DataViz/store/selectors';
import { useProject } from '../../hooks/useProject';
import { SqlRunnerSidebar } from '../sqlRunner';
import { ContentPanel } from '../sqlRunner/components/ContentPanel';
import { DEFAULT_SQL_LIMIT } from '../sqlRunner/constants';
import { SqlRunnerConnectionScope } from '../sqlRunner/multiConnection/components/SqlRunnerConnectionScope';
import { store } from '../sqlRunner/store';
import { useAppDispatch, useAppSelector } from '../sqlRunner/store/hooks';
import {
    EditorTabs,
    resetState,
    selectConnectionRequest,
    setFetchResultsOnLoad,
    setProjectUuid,
    setQuoteChar,
    setSelectedChartType,
    setSql,
    setSqlLimit,
    setWarehouseConnectionType,
} from '../sqlRunner/store/sqlRunnerSlice';

const SQL_CHART_FORM_ID = 'document-sql-chart-form';

type Props = {
    projectUuid: string;
    /** The chart being edited; null to add a new one. */
    chart: DocumentSqlChart | null;
    onClose: () => void;
    onApply: (chart: DocumentSqlChart) => void;
};

/**
 * SQL Runner in a modal: it shares the SQL Runner store, seeded from the
 * chart on open and reset on close, and applies back to the Document only.
 */
const DocumentSqlChartEditorModal = (props: Props) => (
    <Provider store={store}>
        <SqlRunnerConnectionScope
            isEditingSavedChart={false}
            connectionHint={
                props.chart
                    ? (props.chart.warehouseConnectionUuid ?? null)
                    : undefined
            }
        >
            <SqlChartEditor {...props} />
        </SqlRunnerConnectionScope>
    </Provider>
);

const SqlChartEditor = ({ projectUuid, chart, onClose, onApply }: Props) => {
    const dispatch = useAppDispatch();
    const { data: project } = useProject(projectUuid);
    const form = useForm({
        initialValues: {
            name: chart?.name ?? '',
            description: chart?.description ?? '',
        },
    });
    const [isSeeded, setIsSeeded] = useState(false);
    const sql = useAppSelector((state) => state.sqlRunner.sql);
    const limit = useAppSelector((state) => state.sqlRunner.limit);
    const hasUnrunChanges = useAppSelector(
        (state) => state.sqlRunner.hasUnrunChanges,
    );
    const activeEditorTab = useAppSelector(
        (state) => state.sqlRunner.activeEditorTab,
    );
    const selectedChartType = useAppSelector(
        (state) => state.sqlRunner.selectedChartType,
    );
    const config = useAppSelector((state) =>
        selectCompleteConfigByKind(
            state,
            activeEditorTab === EditorTabs.SQL
                ? ChartKind.TABLE
                : selectedChartType,
        ),
    );
    const connectionRequest = useAppSelector(selectConnectionRequest);

    useMount(() => {
        dispatch(resetState());
        dispatch(resetChartState());
        dispatch(setProjectUuid(projectUuid));
        if (chart) {
            dispatch(setSql(chart.sql));
            dispatch(setSqlLimit(chart.limit));
            dispatch(setSelectedChartType(chart.chartKind));
            dispatch(setChartConfig(chart.config));
            dispatch(
                setFetchResultsOnLoad({
                    shouldFetch: true,
                    shouldOpenChartOnLoad: chart.chartKind !== ChartKind.TABLE,
                }),
            );
        }
        setIsSeeded(true);
    });
    useUnmount(() => {
        dispatch(resetState());
        dispatch(resetChartState());
    });
    const warehouseType = project?.warehouseConnection?.type;
    useEffect(() => {
        if (warehouseType) {
            dispatch(setWarehouseConnectionType(warehouseType));
            dispatch(setQuoteChar(getFieldQuoteChar(warehouseType)));
        }
    }, [dispatch, warehouseType]);

    const canApply =
        isSeeded &&
        sql.trim() !== '' &&
        !hasUnrunChanges &&
        config !== undefined &&
        connectionRequest.ready &&
        form.values.name.trim() !== '';
    const dirty = form.isDirty() || (isSeeded && sql !== (chart?.sql ?? ''));

    const applyChart = form.onSubmit(({ name, description }) => {
        if (!canApply || !config || !connectionRequest.ready) {
            return;
        }
        const { warehouseConnectionUuid } = connectionRequest.field;
        onApply({
            name: name.trim(),
            ...(description.trim() ? { description: description.trim() } : {}),
            sql,
            limit: limit ?? DEFAULT_SQL_LIMIT,
            chartKind: config.type,
            config,
            ...(warehouseConnectionUuid ? { warehouseConnectionUuid } : {}),
        });
    });

    return (
        <MantineModal
            opened
            fullScreen
            title={chart ? 'Edit SQL chart' : 'Add SQL chart'}
            onClose={onClose}
            confirmBeforeClose={dirty}
            cancelLabel={false}
            modalBodyProps={{ px: 0, py: 0 }}
            headerActions={
                <Group gap="sm">
                    {hasUnrunChanges && (
                        <Text size="sm" c="dimmed">
                            Run the query to apply your changes
                        </Text>
                    )}
                    <Button
                        type="submit"
                        form={SQL_CHART_FORM_ID}
                        disabled={!canApply}
                    >
                        Apply to Document
                    </Button>
                </Group>
            }
        >
            <Page
                withContainerHeight
                withFullHeight
                noContentPadding
                flexContent
                sidebar={<SqlRunnerSidebar />}
                sidebarTitle="Tables"
            >
                <Stack gap={0} flex={1} miw={0}>
                    <form id={SQL_CHART_FORM_ID} onSubmit={applyChart}>
                        <Group align="end" p="md">
                            <TextInput
                                label="Chart name"
                                {...form.getInputProps('name')}
                            />
                            <TextInput
                                label="Description"
                                {...form.getInputProps('description')}
                            />
                        </Group>
                    </form>
                    <ContentPanel />
                </Stack>
            </Page>
        </MantineModal>
    );
};

export default DocumentSqlChartEditorModal;
