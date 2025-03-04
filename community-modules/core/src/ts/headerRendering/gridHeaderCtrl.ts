import { ColumnModel } from "../columns/columnModel";
import { KeyCode } from "../constants/keyCode";
import { BeanStub } from "../context/beanStub";
import { Autowired } from "../context/context";
import { CtrlsService } from "../ctrlsService";
import { Events } from "../eventKeys";
import { FocusService } from "../focusService";
import { GridOptionsWrapper } from "../gridOptionsWrapper";
import { exists } from "../utils/generic";
import { ManagedFocusFeature } from "../widgets/managedFocusFeature";
import { HeaderNavigationDirection, HeaderNavigationService } from "./headerCell/headerNavigationService";

export interface IGridHeaderComp {
    addOrRemoveCssClass(cssClassName: string, on: boolean): void;
    setHeightAndMinHeight(height: string): void;
}

export class GridHeaderCtrl extends BeanStub {

    @Autowired('headerNavigationService') private headerNavigationService: HeaderNavigationService;
    @Autowired('focusService') private focusService: FocusService;
    @Autowired('columnModel') private columnModel: ColumnModel;
    @Autowired('ctrlsService') private ctrlsService: CtrlsService;

    private comp: IGridHeaderComp;
    private eGui: HTMLElement;

    public setComp(comp: IGridHeaderComp, eGui: HTMLElement, eFocusableElement: HTMLElement): void {
        this.comp = comp;
        this.eGui = eGui;

        this.createManagedBean(new ManagedFocusFeature(
            eFocusableElement,
            {
                onTabKeyDown: this.onTabKeyDown.bind(this),
                handleKeyDown: this.handleKeyDown.bind(this),
                onFocusOut: this.onFocusOut.bind(this)
            }
        ));

        // for setting ag-pivot-on / ag-pivot-off CSS classes
        this.addManagedListener(this.eventService, Events.EVENT_COLUMN_PIVOT_MODE_CHANGED, this.onPivotModeChanged.bind(this));

        this.onPivotModeChanged();
        this.setupHeaderHeight();

        this.ctrlsService.registerGridHeaderCtrl(this);
    }

    private setupHeaderHeight(): void {
        const listener = this.setHeaderHeight.bind(this);
        listener();

        this.addManagedListener(this.gridOptionsWrapper, GridOptionsWrapper.PROP_HEADER_HEIGHT, listener);
        this.addManagedListener(this.gridOptionsWrapper, GridOptionsWrapper.PROP_PIVOT_HEADER_HEIGHT, listener);
        this.addManagedListener(this.gridOptionsWrapper, GridOptionsWrapper.PROP_GROUP_HEADER_HEIGHT, listener);
        this.addManagedListener(this.gridOptionsWrapper, GridOptionsWrapper.PROP_PIVOT_GROUP_HEADER_HEIGHT, listener);
        this.addManagedListener(this.gridOptionsWrapper, GridOptionsWrapper.PROP_FLOATING_FILTERS_HEIGHT, listener);

        this.addManagedListener(this.eventService, Events.EVENT_DISPLAYED_COLUMNS_CHANGED, listener);
    }


    private setHeaderHeight(): void {
        const {columnModel, gridOptionsWrapper} = this;

        let numberOfFloating = 0;
        let headerRowCount = columnModel.getHeaderRowCount();
        let totalHeaderHeight: number;
        let groupHeight: number | null | undefined;
        let headerHeight: number | null | undefined;

        if (columnModel.isPivotMode()) {
            groupHeight = gridOptionsWrapper.getPivotGroupHeaderHeight();
            headerHeight = gridOptionsWrapper.getPivotHeaderHeight();
        } else {
            const hasFloatingFilters = columnModel.hasFloatingFilters();

            if (hasFloatingFilters) {
                headerRowCount++;
                numberOfFloating = 1;
            }

            groupHeight = gridOptionsWrapper.getGroupHeaderHeight();
            headerHeight = gridOptionsWrapper.getHeaderHeight();
        }

        const numberOfNonGroups = 1 + numberOfFloating;
        const numberOfGroups = headerRowCount - numberOfNonGroups;

        totalHeaderHeight = numberOfFloating * gridOptionsWrapper.getFloatingFiltersHeight()!;
        totalHeaderHeight += numberOfGroups * groupHeight!;
        totalHeaderHeight += headerHeight!;

        // one extra pixel is needed here to account for the
        // height of the border
        const px = `${totalHeaderHeight + 1}px`;
        this.comp.setHeightAndMinHeight(px);
    }

    private onPivotModeChanged(): void {
        const pivotMode = this.columnModel.isPivotMode();

        this.comp.addOrRemoveCssClass('ag-pivot-on', pivotMode);
        this.comp.addOrRemoveCssClass('ag-pivot-off', !pivotMode);
    }

    protected onTabKeyDown(e: KeyboardEvent): void {
        const isRtl = this.gridOptionsWrapper.isEnableRtl();
        const direction = e.shiftKey !== isRtl
            ? HeaderNavigationDirection.LEFT
            : HeaderNavigationDirection.RIGHT;

        if (this.headerNavigationService.navigateHorizontally(direction, true, e) ||
            this.focusService.focusNextGridCoreContainer(e.shiftKey)
        ) {
            e.preventDefault();
        }
     }

    protected handleKeyDown(e: KeyboardEvent): void {
        let direction: HeaderNavigationDirection | null = null;

        switch (e.keyCode) {
            case KeyCode.LEFT:
                direction = HeaderNavigationDirection.LEFT;
            case KeyCode.RIGHT:
                if (!exists(direction)) {
                    direction = HeaderNavigationDirection.RIGHT;
                }
                this.headerNavigationService.navigateHorizontally(direction, false, e);
                break;
            case KeyCode.UP:
                direction = HeaderNavigationDirection.UP;
            case KeyCode.DOWN:
                if (!exists(direction)) {
                    direction = HeaderNavigationDirection.DOWN;
                }
                if (this.headerNavigationService.navigateVertically(direction, null, e)) {
                    e.preventDefault();
                }
                break;
            default:
                return;
        }
    }

    protected onFocusOut(e: FocusEvent): void {
        const { relatedTarget } = e;

        if (!relatedTarget && this.eGui.contains(document.activeElement)) { return; }

        if (!this.eGui.contains(relatedTarget as HTMLElement)) {
            this.focusService.clearFocusedHeader();
        }
    }
}
