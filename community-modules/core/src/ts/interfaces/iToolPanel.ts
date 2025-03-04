import { IComponent } from "./iComponent";
import { GridApi } from "../gridApi";
import { ColumnApi } from "../columns/columnApi";
import { ColDef, ColGroupDef } from "../entities/colDef";
import { ColumnEventType } from "../events";

export interface IToolPanelParams {
    api: GridApi;
    columnApi: ColumnApi;
}

export interface IToolPanel {
    refresh(): void;
}

export interface IToolPanelComp extends IToolPanel, IComponent<IToolPanelParams> { }

export interface ToolPanelColumnCompParams extends IToolPanelParams {
    suppressColumnMove: boolean;
    suppressRowGroups: boolean;
    suppressValues: boolean;
    suppressPivots: boolean;
    suppressPivotMode: boolean;
    suppressColumnFilter: boolean;
    suppressColumnSelectAll: boolean;
    suppressColumnExpandAll: boolean;
    contractColumnSelection: boolean;
    suppressSyncLayoutWithGrid: boolean;
}

export interface IPrimaryColsPanel {
    getGui(): HTMLElement;
    init(allowDragging: boolean, params: ToolPanelColumnCompParams, eventType: ColumnEventType): void;
    onExpandAll(): void;
    onCollapseAll(): void;
    expandGroups(groupIds?: string[]): void;
    collapseGroups(groupIds?: string[]): void;
    setColumnLayout(colDefs: (ColDef | ColGroupDef)[]): void;
    syncLayoutWithGrid(): void;
}
