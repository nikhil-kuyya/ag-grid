import { RowNode } from './entities/rowNode';
import { Column } from './entities/column';
import { ColDef } from './entities/colDef';
import { GridApi } from './gridApi';
import { ColumnApi } from './columns/columnApi';
import { OriginalColumnGroup } from './entities/originalColumnGroup';
import { FilterRequestSource } from './filter/filterManager';
import { ChartOptions, ChartType } from './interfaces/iChartOptions';
import { IFilterComp } from './interfaces/iFilter';
import { CellRange, CellRangeParams } from './interfaces/IRangeService';
import { ServerSideTransactionResult } from "./interfaces/serverSideTransaction";
import { RowNodeTransaction } from "./interfaces/rowNodeTransaction";
export { Events } from './eventKeys';

export interface ModelUpdatedEvent extends AgGridEvent {
    /** If true, the grid will try and animate the rows to the new positions */
    animate: boolean | undefined;
    /** If true, the grid has new data loaded, eg user called setRowData(), otherwise
     * it's the same data but sorted or filtered, in which case this is true, and rows
     * can animate around (eg rowNode id 24 is the same row node as last time). */
    keepRenderedRows: boolean | undefined;
    /** If true, then this update was a result of setRowData() getting called. This
     * gets the grid to scroll to the top again. */
    newData: boolean | undefined;
    /** True when pagination and a new page is navigated to. */
    newPage: boolean;
}

export interface PaginationChangedEvent extends AgGridEvent {
    /** True if rows were animated to new position */
    animate?: boolean;
    /** True if rows were kept (otherwise complete redraw) */
    keepRenderedRows?: boolean;
    /** True if data was new (i.e user set new data) */
    newData?: boolean;
    /** True if user went to a new page */
    newPage: boolean;
}

export interface AgEvent {
    /** Event identifier */
    type: string;
}

export interface AgGridEvent extends AgEvent {
    api: GridApi;
    columnApi: ColumnApi;
}

export interface ToolPanelVisibleChangedEvent extends AgGridEvent {
    source: string | undefined;
}

export interface ColumnPivotModeChangedEvent extends AgGridEvent { }

export interface VirtualColumnsChangedEvent extends AgGridEvent { }

export interface ColumnEverythingChangedEvent extends AgGridEvent {
    source: string;
}

export interface NewColumnsLoadedEvent extends AgGridEvent { }

export interface GridColumnsChangedEvent extends AgGridEvent { }

export interface DisplayedColumnsChangedEvent extends AgGridEvent { }

export interface RowDataChangedEvent extends AgGridEvent { }

export interface RowDataUpdatedEvent extends AgGridEvent { }

export interface PinnedRowDataChangedEvent extends AgGridEvent { }

export interface SelectionChangedEvent extends AgGridEvent { }

export interface FilterChangedEvent extends AgGridEvent {
    /** True if the filter was changed as a result of data changing */
    afterDataChange?: boolean;
    /** True if filter was changed via floating filter */
    afterFloatingFilter?: boolean;
}

export interface FilterModifiedEvent extends AgGridEvent {
    filterInstance: IFilterComp;    
    column: Column;
}

export interface FilterOpenedEvent extends AgGridEvent {
    /** Column / OriginalColumnGroup that contains the filter */
    column: Column | OriginalColumnGroup;
    /** Source of the open request */
    source: FilterRequestSource;
    /** Parent element of the filter */
    eGui: HTMLElement;
}

export interface SortChangedEvent extends AgGridEvent { }

export interface GridReadyEvent extends AgGridEvent { }

export interface DisplayedColumnsWidthChangedEvent extends AgGridEvent { } // not documented
export interface ColumnHoverChangedEvent extends AgGridEvent { } // not documented
export interface BodyHeightChangedEvent extends AgGridEvent { } // not documented

// this event is 'odd one out' as it should have properties for all the properties
// in gridOptions that can be bound by the framework. for example, the gridOptions
// has 'rowData', so this property should have 'rowData' also, so that when the row
// data changes via the framework bound property, this event has that attribute set.
export interface ComponentStateChangedEvent extends AgGridEvent { }

export interface ColumnPanelItemDragStartEvent extends AgEvent {
    column: Column | OriginalColumnGroup
}

export interface ColumnPanelItemDragEndEvent extends AgEvent { }

export interface DragEvent extends AgGridEvent {
    /** One of {'cell','row','headerCell','toolPanel'} */
    type: string;
    /** The DOM element that started the event. */
    target: HTMLElement;
}

export interface DragStartedEvent extends DragEvent { }

export interface DragStoppedEvent extends DragEvent { }

// For internal use only.
// This event allows us to detect when other inputs in the same named group are changed, so for example we can ensure
// that only one radio button in the same group is selected at any given time.
export interface CheckboxChangedEvent extends AgEvent {
    id: string;
    name: string;
    selected?: boolean;
    previousValue: boolean | undefined;
}

export interface GridSizeChangedEvent extends AgGridEvent {
    /** The grid's DIV's clientWidth */    
    clientWidth: number;
    /** The grid's DIV's clientHeight */
    clientHeight: number;
}

export interface RowDragEvent extends AgGridEvent {
    /** The row node getting dragged. Also the node that started the drag when multi-row dragging. */
    node: RowNode;
    /** The list of nodes being dragged. */
    nodes: RowNode[];
    /** The underlying mouse move event associated with the drag. */
    event: MouseEvent;
    /** Direction of the drag, either 'up', 'down' or null (if mouse is moving horizontally and not vertically). */
    vDirection: string;
    /** The row index the mouse is dragging over or -1 if over no row. */
    overIndex: number;
    /** The row node the mouse is dragging over or undefined if over no row. */
    overNode?: RowNode;
    /** The vertical pixel location the mouse is over, with `0` meaning the top of the first row.
     * This can be compared to the `rowNode.rowHeight` and `rowNode.rowTop` to work out the mouse position relative to rows.
     * The provided attributes `overIndex` and `overNode` means the `y` property is mostly redundant.
     * The `y` property can be handy if you want more information such as 'how close is the mouse to the top or bottom of the row?'
     */
    y: number;
}

export interface RowDragEnterEvent extends RowDragEvent { }

export interface RowDragEndEvent extends RowDragEvent { }

export interface RowDragMoveEvent extends RowDragEvent { }

export interface RowDragLeaveEvent extends RowDragEvent { }

export interface PasteStartEvent extends AgGridEvent {
    source: string;
}

export interface PasteEndEvent extends AgGridEvent {
    source: string;
}

export interface FillStartEvent extends AgGridEvent {
}

export interface FillEndEvent extends AgGridEvent {
    initialRange: CellRange;
    finalRange: CellRange;
}

export interface ViewportChangedEvent extends AgGridEvent {
    /** Index of the first rendered row */
    firstRow: number;
    /** Index of the last rendered row */
    lastRow: number;
}

export interface FirstDataRenderedEvent extends AgGridEvent {
    /** Index of the first rendered row */
    firstRow: number;
    /** Index of the last rendered row */
    lastRow: number;
}

export interface RangeSelectionChangedEvent extends AgGridEvent {
    id?: string;
    /** True for the first change event, otherwise false */
    started: boolean;
    /** True for the last change event, otherwise false */
    finished: boolean;
}

export interface ChartCreated extends AgGridEvent {
    chartId: string;
}

export interface ChartRangeSelectionChanged extends AgGridEvent {
    id: string;
    chartId: string;
    cellRange: CellRangeParams;
}

export interface ChartOptionsChanged extends AgGridEvent {
    chartId: string;
    chartType: ChartType;
    chartThemeName: string;
    chartOptions: ChartOptions<any>;
}

export interface ChartDestroyed extends AgGridEvent {
    chartId: string;
}

export interface ColumnGroupOpenedEvent extends AgGridEvent {
    columnGroup: OriginalColumnGroup;
}

export interface ItemsAddedEvent extends AgGridEvent {
    items: RowNode[];
}

export type ScrollDirection = 'horizontal' | 'vertical';

export interface BodyScrollEvent extends AgGridEvent {
    direction: ScrollDirection;
    left: number;
    top: number;
}

// not documented
export interface FlashCellsEvent extends AgGridEvent {
    cells: any;
}

export interface PaginationPixelOffsetChangedEvent extends AgGridEvent {
}

// this does not extent CellEvent as the focus service doesn't keep a reference to
// the rowNode.
export interface CellFocusedEvent extends AgGridEvent {
    /** Row index of the focused cell */
    rowIndex: number | null;
    /** Column of the focused cell */
    column: Column | null;
    /** either 'top', 'bottom' or null / undefined (if not pinned) */
    rowPinned?: string | null;
    /** Whether the cell a full width cell or a regular cell */
    isFullWidthCell: boolean;
    /** Whether browser focus is also set (false when editing) */
    forceBrowserFocus?: boolean;
    // floating is for backwards compatibility, this is the same as rowPinned.
    // this is because the focus service doesn't keep references to rowNodes
    // as focused cell is identified by rowIndex - thus when the user re-orders
    // or filters, the focused cell stays with the index, but the node can change.
    floating: string | null;
}

export interface ExpandCollapseAllEvent extends AgGridEvent {
    source: string;
}

/**---------------*/
/** COLUMN EVENTS */
/**---------------*/

export type ColumnEventType =
    "sizeColumnsToFit" |
    "autosizeColumns" |
    "alignedGridChanged" |
    "filterChanged" |
    "filterDestroyed" |
    "gridOptionsChanged" |
    "gridInitializing" |
    "toolPanelDragAndDrop" |
    "toolPanelUi" |
    "uiColumnMoved" |
    "uiColumnResized" |
    "uiColumnDragged" |
    "uiColumnExpanded" |
    "uiColumnSorted" |
    "contextMenu" |
    "columnMenu" |
    "rowModelUpdated" |
    "api" |
    "flex" |
    "pivotChart";

export interface ColumnEvent extends AgGridEvent {
    /** The impacted column, only set if action was on one column */
    column: Column | null;
    /** List of all impacted columns */
    columns: Column[] | null;
    /** String describing where the event is coming from */
    source: ColumnEventType;
}

export interface ColumnResizedEvent extends ColumnEvent {
    /** Set to true for last event in a sequence of move events */
    finished: boolean;
    /** Any columns resized due to flex */
    flexColumns: Column[] | null;
}

export interface ColumnPivotChangedEvent extends ColumnEvent { }

export interface ColumnRowGroupChangedEvent extends ColumnEvent { }

export interface ColumnValueChangedEvent extends ColumnEvent { }

export interface ColumnMovedEvent extends ColumnEvent {
    /** The position the column was moved to */
    toIndex?: number;
}

export interface ColumnVisibleEvent extends ColumnEvent {
    /** True if column was set to visible, false if set to hide */
    visible?: boolean;
}

export interface ColumnPinnedEvent extends ColumnEvent {
    /** Either 'left', 'right', or null (it not pinned) */
    pinned: string | null;
}

/**------------*/

/** ROW EVENTS */
/**------------*/
export interface RowEvent extends AgGridEvent {
    node: RowNode;
    /** The user provided data for the row */
    data: any;
    /** The visible row index for the row */
    rowIndex: number | null;
    /** Either 'top', 'bottom' or null / undefined (if not set) */
    rowPinned: string | null;
    /** The context as provided on `gridOptions.context` */
    context: any;
    /** If event was due to browser event (eg click), this is the browser event */
    event?: Event | null;
}

export interface RowGroupOpenedEvent extends RowEvent {
    /** True if the group is expanded. */
    expanded: boolean;
}

export interface RowValueChangedEvent extends RowEvent { }

export interface RowSelectedEvent extends RowEvent { }

export interface VirtualRowRemovedEvent extends RowEvent { }

export interface RowClickedEvent extends RowEvent { }

export interface RowDoubleClickedEvent extends RowEvent { }

export interface RowEditingStartedEvent extends RowEvent { }

export interface RowEditingStoppedEvent extends RowEvent { }

export interface FullWidthCellKeyDownEvent extends RowEvent { }

export interface FullWidthCellKeyPressEvent extends RowEvent { }

/**------------*/

/** CELL EVENTS */
/**------------*/
export interface CellEvent extends RowEvent {
    column: Column;
    colDef: ColDef;
    /** The value for the cell */
    value: any;
}

export interface CellKeyDownEvent extends CellEvent { }

export interface CellKeyPressEvent extends CellEvent { }

/** Cell is clicked */
export interface CellClickedEvent extends CellEvent { }

export interface CellMouseDownEvent extends CellEvent { }

export interface CellDoubleClickedEvent extends CellEvent { }

export interface CellMouseOverEvent extends CellEvent { }

export interface CellMouseOutEvent extends CellEvent { }

export interface CellContextMenuEvent extends CellEvent { }

export interface CellEditingStartedEvent extends CellEvent { }

export interface CellEditingStoppedEvent extends CellEvent {
    /** The old value before editing */
    oldValue: any;
    /** The new value after editing */
    newValue: any;
}

export interface CellValueChangedEvent extends CellEvent {    
    oldValue: any;
    newValue: any;
    source: string | undefined;
}

export interface AsyncTransactionsFlushed extends AgGridEvent {
    results: (RowNodeTransaction | ServerSideTransactionResult) [];
}

// not documented, was put in for CS - more thought needed of how server side grouping / pivoting
// is done and how these should be used before we fully document and share with the world.
export interface ColumnRequestEvent extends AgGridEvent {
    columns: Column[];
}

export interface ColumnRowGroupChangeRequestEvent extends ColumnRequestEvent { }

export interface ColumnPivotChangeRequestEvent extends ColumnRequestEvent { }

export interface ColumnValueChangeRequestEvent extends ColumnRequestEvent { }

export interface ColumnAggFuncChangeRequestEvent extends ColumnRequestEvent {
    aggFunc: any;
}

export interface ScrollVisibilityChangedEvent extends AgGridEvent { } // not documented

export interface StoreUpdatedEvent extends AgEvent {} // not documented

export interface LeftPinnedWidthChangedEvent extends AgEvent {} // not documented
export interface RightPinnedWidthChangedEvent extends AgEvent {} // not documented

export interface RowContainerHeightChanged extends AgEvent {} // not documented

export interface DisplayedRowsChangedEvent extends AgEvent {} // not documented
