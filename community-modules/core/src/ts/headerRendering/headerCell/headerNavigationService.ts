import { BeanStub } from "../../context/beanStub";
import { Autowired, Bean, PostConstruct } from "../../context/context";
import { CtrlsService } from "../../ctrlsService";
import { Column } from "../../entities/column";
import { ColumnGroup } from "../../entities/columnGroup";
import { FocusService } from "../../focusService";
import { GridBodyCtrl } from "../../gridBodyComp/gridBodyCtrl";
import { AnimationFrameService } from "../../misc/animationFrameService";
import { last } from "../../utils/array";
import { HeaderRowType } from "../headerRow/headerRowComp";
import { HeaderPosition, HeaderPositionUtils } from "./headerPosition";

export enum HeaderNavigationDirection {
    UP,
    DOWN,
    LEFT,
    RIGHT
}

@Bean('headerNavigationService')
export class HeaderNavigationService extends BeanStub {

    @Autowired('focusService') private focusService: FocusService;
    @Autowired('headerPositionUtils') private headerPositionUtils: HeaderPositionUtils;
    @Autowired('animationFrameService') private animationFrameService: AnimationFrameService;
    @Autowired('ctrlsService') private ctrlsService: CtrlsService;

    private gridBodyCon: GridBodyCtrl;

    @PostConstruct
    private postConstruct(): void {
        this.ctrlsService.whenReady(p => {
            this.gridBodyCon = p.gridBodyCtrl;
        });
    }

    public getHeaderRowCount(): number {
        const centerHeaderContainer = this.ctrlsService.getHeaderRowContainerCtrl();
        return centerHeaderContainer ? centerHeaderContainer.getRowCount() : 0;
    }

    public getHeaderRowType(rowIndex: number): HeaderRowType | undefined {
        const centerHeaderContainer = this.ctrlsService.getHeaderRowContainerCtrl();
        if (centerHeaderContainer) {
            return centerHeaderContainer.getRowType(rowIndex);
        }
    }

    /*
     * This method navigates grid header vertically
     * @return {boolean} true to preventDefault on the event that caused this navigation.
     */
    public navigateVertically(direction: HeaderNavigationDirection, fromHeader: HeaderPosition | null, event: KeyboardEvent): boolean {
        if (!fromHeader) {
            fromHeader = this.focusService.getFocusedHeader();
        }

        if (!fromHeader) { return false; }

        const { headerRowIndex, column } = fromHeader;
        const rowLen = this.getHeaderRowCount();
        const isUp = direction === HeaderNavigationDirection.UP ;
        let nextRow = isUp ?  headerRowIndex - 1 : headerRowIndex + 1;
        let nextFocusColumn: ColumnGroup | Column | null = null;
        let skipColumn = false;

        if (nextRow < 0) {
            nextRow = 0;
            nextFocusColumn = column;
            skipColumn = true;
        }

        if (nextRow >= rowLen) {
            nextRow = -1; // -1 indicates the focus should move to grid rows.
        }

        const currentRowType = this.getHeaderRowType(headerRowIndex);

        if (!skipColumn) {
            if (currentRowType === HeaderRowType.COLUMN_GROUP) {
                const currentColumn = column as ColumnGroup;
                nextFocusColumn = isUp ? column.getParent() : currentColumn.getDisplayedChildren()![0] as ColumnGroup;
            } else if (currentRowType === HeaderRowType.FLOATING_FILTER) {
                nextFocusColumn = column;
            } else {
                const currentColumn = column as Column;
                nextFocusColumn = isUp ? currentColumn.getParent() : currentColumn;
            }

            if (!nextFocusColumn) { return false; }
        }

        return this.focusService.focusHeaderPosition(
            { headerRowIndex: nextRow, column: nextFocusColumn! },
            undefined,
            false,
            true,
            event
        );
    }

    /*
     * This method navigates grid header horizontally
     * @return {boolean} true to preventDefault on the event that caused this navigation.
     */
    public navigateHorizontally(direction: HeaderNavigationDirection, fromTab: boolean = false, event: KeyboardEvent): boolean {
        const focusedHeader = this.focusService.getFocusedHeader()!;
        const isLeft = direction === HeaderNavigationDirection.LEFT;
        const isRtl = this.gridOptionsWrapper.isEnableRtl();
        let nextHeader: HeaderPosition;
        let normalisedDirection: 'Before' |  'After';

        // either navigating to the left or isRtl (cannot be both)
        if (isLeft !== isRtl) {
            normalisedDirection = 'Before';
            nextHeader = this.headerPositionUtils.findHeader(focusedHeader, normalisedDirection)!;
        } else {
            normalisedDirection = 'After';
            nextHeader = this.headerPositionUtils.findHeader(focusedHeader, normalisedDirection)!;
        }

        if (nextHeader) {
            return this.focusService.focusHeaderPosition(nextHeader, normalisedDirection, fromTab, true, event);
        }

        if (!fromTab) { return true; }

        return this.focusNextHeaderRow(focusedHeader, normalisedDirection, event);
    }

    private focusNextHeaderRow(focusedHeader: HeaderPosition, direction: 'Before' | 'After', event: KeyboardEvent): boolean {
        const currentIndex = focusedHeader.headerRowIndex;
        let nextPosition: HeaderPosition | null = null;
        let nextRowIndex: number;

        if (direction === 'Before') {
            if (currentIndex > 0) {
                nextRowIndex = currentIndex - 1;
                nextPosition = this.headerPositionUtils.findColAtEdgeForHeaderRow(nextRowIndex, 'end')!;
            }
        } else {
            nextRowIndex = currentIndex + 1;
            nextPosition = this.headerPositionUtils.findColAtEdgeForHeaderRow(nextRowIndex, 'start')!;
        }

        return this.focusService.focusHeaderPosition(nextPosition, direction, true, true, event);
    }

    public scrollToColumn(column: Column | ColumnGroup, direction: 'Before' | 'After' | null = 'After'): void {
        if (column.getPinned()) { return; }

        let columnToScrollTo: Column;

        if (column instanceof ColumnGroup) {
            const columns = column.getDisplayedLeafColumns();
            columnToScrollTo = direction === 'Before' ? last(columns) : columns[0];
        } else {
            columnToScrollTo = column;
        }

        this.gridBodyCon.getScrollFeature().ensureColumnVisible(columnToScrollTo);

        // need to nudge the scrolls for the floating items. otherwise when we set focus on a non-visible
        // floating cell, the scrolls get out of sync
        this.gridBodyCon.getScrollFeature().horizontallyScrollHeaderCenterAndFloatingCenter();

        // need to flush frames, to make sure the correct cells are rendered
        this.animationFrameService.flushAllFrames();
    }
}
