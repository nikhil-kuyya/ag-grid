import { ColumnModel } from "../../columns/columnModel";
import { Constants } from "../../constants/constants";
import { BeanStub } from "../../context/beanStub";
import { Autowired } from "../../context/context";
import { CtrlsService } from "../../ctrlsService";
import { Column } from "../../entities/column";
import { ColumnGroupChild } from "../../entities/columnGroupChild";
import { Events } from "../../eventKeys";
import { CenterWidthFeature } from "../../gridBodyComp/centerWidthFeature";
import { PinnedWidthService } from "../../gridBodyComp/pinnedWidthService";
import { ScrollVisibleService } from "../../gridBodyComp/scrollVisibleService";
import { NumberSequence } from "../../utils";
import { BodyDropTarget } from "../bodyDropTarget";
import { HeaderRowType } from "../headerRow/headerRowComp";
import { HeaderRowCtrl } from "../headerRow/headerRowCtrl";

export interface IHeaderRowContainerComp {
    setCenterWidth(width: string): void;
    setContainerTransform(transform: string): void;
    setContainerWidth(width: string): void;
    addOrRemoveCssClass(cssClassName: string, on: boolean): void;
    setCtrls(ctrls: HeaderRowCtrl[]): void;
}

export class HeaderRowContainerCtrl extends BeanStub {

    @Autowired('ctrlsService') private ctrlsService: CtrlsService;
    @Autowired('scrollVisibleService') private scrollVisibleService: ScrollVisibleService;
    @Autowired('pinnedWidthService') private pinnedWidthService: PinnedWidthService;
    @Autowired('columnModel') private columnModel: ColumnModel;

    private pinned: string | null;
    private comp: IHeaderRowContainerComp;

    private filtersRowCtrl: HeaderRowCtrl | undefined;
    private columnsRowCtrl: HeaderRowCtrl;
    private groupsRowCtrls: HeaderRowCtrl[] = [];

    constructor(pinned: string | null) {
        super();
        this.pinned = pinned;
    }
    
    public setComp(comp: IHeaderRowContainerComp, eGui: HTMLElement): void {
        this.comp = comp;

        this.setupCenterWidth();
        this.setupPinnedWidth();

        this.setupDragAndDrop(eGui);

        this.addManagedListener(this.eventService, Events.EVENT_GRID_COLUMNS_CHANGED, this.onGridColumnsChanged.bind(this));

        this.ctrlsService.registerHeaderContainer(this, this.pinned);

        if (this.columnModel.isReady()) {
            this.refresh();
        }
    }

    private setupDragAndDrop(dropContainer: HTMLElement): void {
        const bodyDropTarget = new BodyDropTarget(this.pinned, dropContainer);
        this.createManagedBean(bodyDropTarget);
    }

    public refresh(keepColumns = false): void {
        const sequence = new NumberSequence();

        const refreshColumnGroups = () => {
            const groupRowCount = this.columnModel.getHeaderRowCount() - 1;

            this.groupsRowCtrls = this.destroyBeans(this.groupsRowCtrls);

            for (let i = 0; i < groupRowCount; i++) {
                const ctrl = this.createBean(new HeaderRowCtrl(sequence.next(), this.pinned, HeaderRowType.COLUMN_GROUP));
                this.groupsRowCtrls.push(ctrl);
            }
        };

        const refreshColumns = () => {
            const rowIndex = sequence.next();
            const needNewInstance = this.columnsRowCtrl==null || !keepColumns || this.columnsRowCtrl.getRowIndex() !== rowIndex;

            if (needNewInstance) {
                this.destroyBean(this.columnsRowCtrl);
                this.columnsRowCtrl = this.createBean(new HeaderRowCtrl(rowIndex, this.pinned, HeaderRowType.COLUMN));
            }
        };

        const refreshFilters = () => {

            const includeFloatingFilter = !this.columnModel.isPivotMode() && this.columnModel.hasFloatingFilters();

            const destroyPreviousComp = () => {
                this.filtersRowCtrl = this.destroyBean(this.filtersRowCtrl);
            };

            if (!includeFloatingFilter) {
                destroyPreviousComp();
                return;
            }

            const rowIndex = sequence.next();

            if (this.filtersRowCtrl) {
                const rowIndexMismatch = this.filtersRowCtrl.getRowIndex() !== rowIndex;
                if (!keepColumns || rowIndexMismatch) {
                    destroyPreviousComp();
                }
            }

            if (!this.filtersRowCtrl) {
                this.filtersRowCtrl = this.createBean(new HeaderRowCtrl(rowIndex, this.pinned, HeaderRowType.FLOATING_FILTER));
            }
        };

        refreshColumnGroups();
        refreshColumns();
        refreshFilters();

        const allCtrls = this.getAllCtrls();
        this.comp.setCtrls(allCtrls);
    }

    private getAllCtrls(): HeaderRowCtrl[] {
        const res = [...this.groupsRowCtrls, this.columnsRowCtrl];
        if (this.filtersRowCtrl) {
            res.push(this.filtersRowCtrl!);
        }
        return res;
    }

    // grid cols have changed - this also means the number of rows in the header can have
    // changed. so we remove all the old rows and insert new ones for a complete refresh
    private onGridColumnsChanged() {
        this.refresh(true);
    }

    private setupCenterWidth(): void {
        if (this.pinned!=null) { return; }

        this.createManagedBean(new CenterWidthFeature(width => this.comp.setCenterWidth(`${width}px`)));
    }

    public setHorizontalScroll(offset: number): void {
        this.comp.setContainerTransform(`translateX(${offset}px)`);
    }

    private setupPinnedWidth(): void {
        if (this.pinned==null) { return; }

        const pinningLeft = this.pinned === Constants.PINNED_LEFT;
        const pinningRight = this.pinned === Constants.PINNED_RIGHT;

        const listener = ()=> {
            const width = pinningLeft ? this.pinnedWidthService.getPinnedLeftWidth() : this.pinnedWidthService.getPinnedRightWidth();
            if (width==null) { return; } // can happen at initialisation, width not yet set

            const hidden = width == 0;
            const isRtl = this.gridOptionsWrapper.isEnableRtl();
            const scrollbarWidth = this.gridOptionsWrapper.getScrollbarWidth();

            // if there is a scroll showing (and taking up space, so Windows, and not iOS)
            // in the body, then we add extra space to keep header aligned with the body,
            // as body width fits the cols and the scrollbar
            const addPaddingForScrollbar = this.scrollVisibleService.isVerticalScrollShowing() && ((isRtl && pinningLeft) || (!isRtl && pinningRight));
            const widthWithPadding = addPaddingForScrollbar ? width + scrollbarWidth : width;

            this.comp.setContainerWidth(widthWithPadding + 'px');
            this.comp.addOrRemoveCssClass('ag-hidden', hidden);
        };

        this.addManagedListener(this.eventService, Events.EVENT_LEFT_PINNED_WIDTH_CHANGED, listener);
        this.addManagedListener(this.eventService, Events.EVENT_RIGHT_PINNED_WIDTH_CHANGED, listener);
        this.addManagedListener(this.eventService, Events.EVENT_SCROLL_VISIBILITY_CHANGED, listener);
        this.addManagedListener(this.eventService, Events.EVENT_SCROLLBAR_WIDTH_CHANGED, listener);
    }

    public getHtmlElementForColumnHeader(column: Column): HTMLElement | undefined {
        if (this.columnsRowCtrl) {
            return this.columnsRowCtrl.getHtmlElementForColumnHeader(column);
        }
    }

    public getRowType(rowIndex: number): HeaderRowType | undefined {
        const allCtrls = this.getAllCtrls();
        const ctrl = allCtrls[rowIndex];
        return ctrl ? ctrl.getType() : undefined;
    }

    public focusHeader(rowIndex: number, column: ColumnGroupChild): boolean {
        const allCtrls = this.getAllCtrls();
        const ctrl = allCtrls[rowIndex];
        if (!ctrl) { return false; }

        return ctrl.focusHeader(column);
    }

    public getRowCount(): number {
        return this.getAllCtrls().length;
    }
}