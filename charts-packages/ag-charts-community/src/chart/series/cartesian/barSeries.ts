import { Group } from "../../../scene/group";
import { Selection } from "../../../scene/selection";
import { Rect } from "../../../scene/shape/rect";
import { Text, FontStyle, FontWeight } from "../../../scene/shape/text";
import { BandScale } from "../../../scale/bandScale";
import { DropShadow } from "../../../scene/dropShadow";
import {
    SeriesNodeDatum,
    CartesianTooltipRendererParams, SeriesTooltip
} from "../series";
import { Label } from "../../label";
import { PointerEvents } from "../../../scene/node";
import { LegendDatum } from "../../legend";
import { CartesianSeries } from "./cartesianSeries";
import { ChartAxis, ChartAxisDirection, flipChartAxisDirection } from "../../chartAxis";
import { TooltipRendererResult, toTooltipHtml } from "../../chart";
import { findMinMax } from "../../../util/array";
import { equal } from "../../../util/equal";
import { reactive, TypedEvent } from "../../../util/observable";
import Scale from "../../../scale/scale";
import { sanitizeHtml } from "../../../util/sanitize";
import { Shape } from "../../../scene/shape/shape";

export interface BarSeriesNodeClickEvent extends TypedEvent {
    readonly type: 'nodeClick';
    readonly event: MouseEvent;
    readonly series: BarSeries;
    readonly datum: any;
    readonly xKey: string;
    readonly yKey: string;
}

export interface BarTooltipRendererParams extends CartesianTooltipRendererParams {
    readonly processedYValue: any;
}

interface BarNodeDatum extends SeriesNodeDatum {
    readonly index: number;
    readonly yKey: string;
    readonly yValue: number;
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly fill?: string;
    readonly stroke?: string;
    readonly strokeWidth: number;
    readonly label?: {
        readonly x: number;
        readonly y: number;
        readonly text: string;
        readonly fontStyle?: FontStyle;
        readonly fontWeight?: FontWeight;
        readonly fontSize: number;
        readonly fontFamily: string;
        readonly textAlign: CanvasTextAlign;
        readonly textBaseline: CanvasTextBaseline;
        readonly fill: string;
    };
}

enum BarSeriesNodeTag {
    Bar,
    Label
}

export enum BarLabelPlacement {
    Inside = 'inside',
    Outside = 'outside'
}

class BarSeriesLabel extends Label {
    @reactive('change') formatter?: (params: { value: number }) => string;
    @reactive('change') placement = BarLabelPlacement.Inside;
}

export interface BarSeriesFormatterParams {
    readonly datum: any;
    readonly fill?: string;
    readonly stroke?: string;
    readonly strokeWidth: number;
    readonly highlighted: boolean;
    readonly xKey: string;
    readonly yKey: string;
}

export interface BarSeriesFormat {
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
}

export class BarSeriesTooltip extends SeriesTooltip {
    @reactive('change') renderer?: (params: BarTooltipRendererParams) => string | TooltipRendererResult;
}

function flat(arr: any[], target: any[] = []): any[] {
    arr.forEach(v => {
        if (Array.isArray(v)) {
            flat(v, target);
        } else {
            target.push(v);
        }
    });
    return target;
}

export class BarSeries extends CartesianSeries {

    static className = 'BarSeries';
    static type = 'bar';

    // Need to put bar and label nodes into separate groups, because even though label nodes are
    // created after the bar nodes, this only guarantees that labels will always be on top of bars
    // on the first run. If on the next run more bars are added, they might clip the labels
    // rendered during the previous run.
    private rectGroup = this.pickGroup.appendChild(new Group);
    private labelGroup = this.group.appendChild(new Group);

    private rectSelection: Selection<Rect, Group, BarNodeDatum, any> = Selection.select(this.rectGroup).selectAll<Rect>();
    private labelSelection: Selection<Text, Group, BarNodeDatum, any> = Selection.select(this.labelGroup).selectAll<Text>();

    private xData: string[] = [];
    private yData: number[][][] = [];
    private yDomain: number[] = [];

    readonly label = new BarSeriesLabel();

    /**
     * The assumption is that the values will be reset (to `true`)
     * in the {@link yKeys} setter.
     */
    private readonly seriesItemEnabled = new Map<string, boolean>();

    tooltip: BarSeriesTooltip = new BarSeriesTooltip();

    @reactive('dataChange') flipXY = false;

    @reactive('dataChange') fills: string[] = [
        '#c16068',
        '#a2bf8a',
        '#ebcc87',
        '#80a0c3',
        '#b58dae',
        '#85c0d1'
    ];

    @reactive('dataChange') strokes: string[] = [
        '#874349',
        '#718661',
        '#a48f5f',
        '#5a7088',
        '#7f637a',
        '#5d8692'
    ];

    @reactive('layoutChange') fillOpacity = 1;
    @reactive('layoutChange') strokeOpacity = 1;

    @reactive('update') lineDash?: number[] = undefined;
    @reactive('update') lineDashOffset: number = 0;

    @reactive('update') formatter?: (params: BarSeriesFormatterParams) => BarSeriesFormat;

    constructor() {
        super();

        this.addEventListener('update', this.scheduleUpdate);

        this.label.enabled = false;
        this.label.addEventListener('change', this.scheduleUpdate, this);
    }

    /**
     * Used to get the position of bars within each group.
     */
    private groupScale = new BandScale<string>();

    directionKeys = {
        [ChartAxisDirection.X]: ['xKey'],
        [ChartAxisDirection.Y]: ['yKeys']
    };

    getKeys(direction: ChartAxisDirection): string[] {
        const { directionKeys } = this;
        const keys = directionKeys && directionKeys[this.flipXY ? flipChartAxisDirection(direction) : direction];
        let values: string[] = [];

        if (keys) {
            keys.forEach(key => {
                const value = (this as any)[key];

                if (value) {
                    if (Array.isArray(value)) {
                        values = values.concat(flat(value));
                    } else {
                        values.push(value);
                    }
                }
            });
        }

        return values;
    }

    protected _xKey: string = '';
    set xKey(value: string) {
        if (this._xKey !== value) {
            this._xKey = value;
            this.xData = [];
            this.scheduleData();
        }
    }
    get xKey(): string {
        return this._xKey;
    }

    protected _xName: string = '';
    set xName(value: string) {
        if (this._xName !== value) {
            this._xName = value;
            this.scheduleUpdate();
        }
    }
    get xName(): string {
        return this._xName;
    }

    private cumYKeyCount: number[] = [];
    private flatYKeys: string[] | undefined = undefined; // only set when a user used a flat array for yKeys

    @reactive('layoutChange') hideInLegend: string[] = [];

    /**
     * yKeys: [['coffee']] - regular bars, each category has a single bar that shows a value for coffee
     * yKeys: [['coffee'], ['tea'], ['milk']] - each category has three bars that show values for coffee, tea and milk
     * yKeys: [['coffee', 'tea', 'milk']] - each category has a single bar with three stacks that show values for coffee, tea and milk
     * yKeys: [['coffee', 'tea', 'milk'], ['paper', 'ink']] - each category has 2 stacked bars,
     *     first showing values for coffee, tea and milk and second values for paper and ink
     */
    protected _yKeys: string[][] = [];
    set yKeys(yKeys: string[][]) {
        let flatYKeys: string[] | undefined = undefined;
        // Convert from flat y-keys to grouped y-keys.
        if (yKeys.length && !Array.isArray(yKeys[0])) {
            flatYKeys = yKeys as any as string[];
            if (this.grouped) {
                yKeys = flatYKeys.map(k => [k]);
            } else {
                yKeys = [flatYKeys];
            }
        }

        if (!equal(this._yKeys, yKeys)) {
            if (flatYKeys) {
                this.flatYKeys = flatYKeys;
            } else {
                this.flatYKeys = undefined;
            }

            this._yKeys = yKeys;

            let prevYKeyCount = 0;
            this.cumYKeyCount = [];
            const visibleStacks: string[] = [];
            yKeys.forEach((stack, index) => {
                if (stack.length > 0) {
                    visibleStacks.push(String(index));
                }
                this.cumYKeyCount.push(prevYKeyCount);
                prevYKeyCount += stack.length;
            });
            this.yData = [];

            const { seriesItemEnabled } = this;
            seriesItemEnabled.clear();
            yKeys.forEach(stack => {
                stack.forEach(yKey => seriesItemEnabled.set(yKey, true));
            });

            const { groupScale } = this;
            groupScale.domain = visibleStacks;
            groupScale.padding = 0.1;
            groupScale.round = true;

            this.scheduleData();
        }
    }
    get yKeys(): string[][] {
        return this._yKeys;
    }

    protected _grouped: boolean = false;
    set grouped(value: boolean) {
        if (this._grouped !== value) {
            this._grouped = value;
            if (this.flatYKeys) {
                this.yKeys = this.flatYKeys as any;
            }
        }
    }
    get grouped(): boolean {
        return this._grouped;
    }

    /**
     * A map of `yKeys` to their names (used in legends and tooltips).
     * For example, if a key is `product_name` it's name can be a more presentable `Product Name`.
     */
    protected _yNames: { [key in string]: string } = {};
    set yNames(values: { [key in string]: string }) {
        if (Array.isArray(values) && this.flatYKeys) {
            const map: { [key in string]: string } = {};
            this.flatYKeys.forEach((k, i) => {
                map[k] = values[i];
            });
            values = map;
        }
        this._yNames = values;
        this.scheduleData();
    }
    get yNames(): { [key in string]: string } {
        return this._yNames;
    }

    setColors(fills: string[], strokes: string[]) {
        this.fills = fills;
        this.strokes = strokes;
    }

    /**
     * The value to normalize the bars to.
     * Should be a finite positive value or `undefined`.
     * Defaults to `undefined` - bars are not normalized.
     */
    private _normalizedTo?: number;
    set normalizedTo(value: number | undefined) {
        const absValue = value ? Math.abs(value) : undefined;

        if (this._normalizedTo !== absValue) {
            this._normalizedTo = absValue;
            this.scheduleData();
        }
    }
    get normalizedTo(): number | undefined {
        return this._normalizedTo;
    }

    private _strokeWidth: number = 1;
    set strokeWidth(value: number) {
        if (this._strokeWidth !== value) {
            this._strokeWidth = value;
            this.scheduleUpdate();
        }
    }
    get strokeWidth(): number {
        return this._strokeWidth;
    }

    private _shadow?: DropShadow;
    set shadow(value: DropShadow | undefined) {
        if (this._shadow !== value) {
            this._shadow = value;
            this.scheduleUpdate();
        }
    }
    get shadow(): DropShadow | undefined {
        return this._shadow;
    }

    onHighlightChange() {
        this.updateRectNodes();
    }

    processData(): boolean {
        const { xKey, yKeys, seriesItemEnabled } = this;
        const data = xKey && yKeys.length && this.data ? this.data : [];

        let keysFound = true; // only warn once
        this.xData = data.map(datum => {
            if (keysFound && !(xKey in datum)) {
                keysFound = false;
                console.warn(`The key '${xKey}' was not found in the data: `, datum);
            }
            return datum[xKey];
        });

        this.yData = data.map(datum => yKeys.map(stack => {
            return stack.map(yKey => {
                if (keysFound && !(yKey in datum)) {
                    keysFound = false;
                    console.warn(`The key '${yKey}' was not found in the data: `, datum);
                }
                const value = datum[yKey];

                return isFinite(value) && seriesItemEnabled.get(yKey) ? value : 0;
            });
        }));

        // Used for normalization of stacked bars. Contains min/max values for each stack in each group,
        // where min is zero and max is a positive total of all values in the stack
        // or min is a negative total of all values in the stack and max is zero.
        const yMinMax = this.yData.map(group => group.map(stack => findMinMax(stack)));
        const { yData, normalizedTo } = this;

        const yLargestMinMax = this.findLargestMinMax(yMinMax);

        let yMin: number;
        let yMax: number;
        if (normalizedTo && isFinite(normalizedTo)) {
            yMin = yLargestMinMax.min < 0 ? -normalizedTo : 0;
            yMax = normalizedTo;
            yData.forEach((group, i) => {
                group.forEach((stack, j) => {
                    stack.forEach((y, k) => {
                        if (y < 0) {
                            stack[k] = -y / yMinMax[i][j].min * normalizedTo;
                        } else {
                            stack[k] = y / yMinMax[i][j].max * normalizedTo;
                        }
                    });
                });
            });
        } else {
            yMin = yLargestMinMax.min;
            yMax = yLargestMinMax.max;
        }

        this.yDomain = this.fixNumericExtent([yMin, yMax], 'y');

        this.fireEvent({ type: 'dataProcessed' });

        return true;
    }

    findLargestMinMax(groups: { min: number, max: number }[][]): { min: number, max: number } {
        let tallestStackMin = 0;
        let tallestStackMax = 0;

        for (const group of groups) {
            for (const stack of group) {
                if (stack.min < tallestStackMin) {
                    tallestStackMin = stack.min;
                }
                if (stack.max > tallestStackMax) {
                    tallestStackMax = stack.max;
                }
            }
        }

        return { min: tallestStackMin, max: tallestStackMax };
    }

    getDomain(direction: ChartAxisDirection): any[] {
        if (this.flipXY) {
            direction = flipChartAxisDirection(direction);
        }
        if (direction === ChartAxisDirection.X) {
            return this.xData;
        } else {
            return this.yDomain;
        }
    }

    fireNodeClickEvent(event: MouseEvent, datum: BarNodeDatum): void {
        this.fireEvent<BarSeriesNodeClickEvent>({
            type: 'nodeClick',
            event,
            series: this,
            datum: datum.seriesDatum,
            xKey: this.xKey,
            yKey: datum.yKey
        });
    }

    private getCategoryAxis(): ChartAxis<Scale<any, number>> | undefined {
        return this.flipXY ? this.yAxis : this.xAxis;
    }

    private getValueAxis(): ChartAxis<Scale<any, number>> | undefined {
        return this.flipXY ? this.xAxis : this.yAxis;
    }

    highlight(itemId?: string): boolean {
        if (!super.highlight(itemId)) {
            return false;
        }

        this.highlightedItemId = itemId;
        this.updateRectNodes();

        return true;
    }

    dehighlight(): boolean {
        if (!super.dehighlight()) {
            return false;
        }
        this.updateRectNodes();
        return true;
    }

    undim(itemId?: any) {
        this.updateDim(itemId);
    }

    dim() {
        this.updateDim();
    }

    private updateDim(itemId?: any) {
        const { dimOpacity } = this.highlightStyle.series;

        const fn = (node: Shape, datum: { itemId?: any }) => node.opacity = !itemId || itemId === datum.itemId ? 1 : dimOpacity;
        this.rectSelection.each(fn);
        this.labelSelection.each(fn);
    }

    createNodeData(): BarNodeDatum[] {
        const xAxis = this.getCategoryAxis();
        const yAxis = this.getValueAxis();

        if (!this.data || !xAxis || !yAxis) {
            return [];
        }

        const { flipXY } = this;
        const xScale = xAxis.scale;
        const yScale = yAxis.scale;

        const {
            groupScale,
            yKeys,
            cumYKeyCount,
            fills,
            strokes,
            strokeWidth,
            seriesItemEnabled,
            data,
            xData,
            yData,
            label
        } = this;

        const labelFontStyle = label.fontStyle;
        const labelFontWeight = label.fontWeight;
        const labelFontSize = label.fontSize;
        const labelFontFamily = label.fontFamily;
        const labelColor = label.color;
        const labelFormatter = label.formatter;
        const labelPlacement = label.placement;

        groupScale.range = [0, xScale.bandwidth!];

        const grouped = true;
        const barWidth = grouped ? groupScale.bandwidth : xScale.bandwidth!;
        const nodeData: BarNodeDatum[] = [];

        xData.forEach((group, groupIndex) => {
            const seriesDatum = data[groupIndex];
            const x = xScale.convert(group);

            const groupYs = yData[groupIndex]; // y-data for groups of stacks
            for (let stackIndex = 0; stackIndex < groupYs.length; stackIndex++) {
                const stackYs = groupYs[stackIndex]; // y-data for a stack withing a group

                let prevMinY = 0;
                let prevMaxY = 0;

                for (let levelIndex = 0; levelIndex < stackYs.length; levelIndex++) {
                    const currY = stackYs[levelIndex];
                    const yKey = yKeys[stackIndex][levelIndex];
                    const barX = grouped ? x + groupScale.convert(String(stackIndex)) : x;

                    // Bars outside of visible range are not rendered, so we create node data
                    // only for the visible subset of user data.
                    if (!xAxis.inRange(barX, barWidth)) {
                        continue;
                    }

                    const prevY = currY < 0 ? prevMinY : prevMaxY;
                    const y = yScale.convert(prevY + currY);
                    const bottomY = yScale.convert(prevY);
                    const yValue = seriesDatum[yKey]; // unprocessed y-value
                    const yValueIsNumber = typeof yValue === 'number';

                    let labelText: string;

                    if (labelFormatter) {
                        labelText = labelFormatter({ value: yValueIsNumber ? yValue : undefined });
                    } else {
                        labelText = yValueIsNumber && isFinite(yValue) ? yValue.toFixed(2) : '';
                    }

                    let labelX: number;
                    let labelY: number;

                    if (flipXY) {
                        labelY = barX + barWidth / 2;
                        if (labelPlacement === BarLabelPlacement.Inside) {
                            labelX = y + (yValue >= 0 ? -1 : 1) * Math.abs(bottomY - y) / 2;
                        } else {
                            labelX = y + (yValue >= 0 ? 1 : -1) * 4;
                        }
                    } else {
                        labelX = barX + barWidth / 2;
                        if (labelPlacement === BarLabelPlacement.Inside) {
                            labelY = y + (yValue >= 0 ? 1 : -1) * Math.abs(bottomY - y) / 2;
                        } else {
                            labelY = y + (yValue >= 0 ? -3 : 4);
                        }
                    }

                    let labelTextAlign: CanvasTextAlign;
                    let labelTextBaseline: CanvasTextBaseline;

                    if (labelPlacement === BarLabelPlacement.Inside) {
                        labelTextAlign = 'center';
                        labelTextBaseline = 'middle';
                    } else {
                        labelTextAlign = flipXY ? (yValue >= 0 ? 'start' : 'end') : 'center';
                        labelTextBaseline = flipXY ? 'middle' : (yValue >= 0 ? 'bottom' : 'top');
                    }

                    const colorIndex = cumYKeyCount[stackIndex] + levelIndex;
                    nodeData.push({
                        index: groupIndex,
                        series: this,
                        itemId: yKey,
                        seriesDatum,
                        yValue,
                        yKey,
                        x: flipXY ? Math.min(y, bottomY) : barX,
                        y: flipXY ? barX : Math.min(y, bottomY),
                        width: flipXY ? Math.abs(bottomY - y) : barWidth,
                        height: flipXY ? barWidth : Math.abs(bottomY - y),
                        fill: fills[colorIndex % fills.length],
                        stroke: strokes[colorIndex % strokes.length],
                        strokeWidth,
                        label: seriesItemEnabled.get(yKey) && labelText ? {
                            text: labelText,
                            fontStyle: labelFontStyle,
                            fontWeight: labelFontWeight,
                            fontSize: labelFontSize,
                            fontFamily: labelFontFamily,
                            textAlign: labelTextAlign,
                            textBaseline: labelTextBaseline,
                            fill: labelColor,
                            x: labelX,
                            y: labelY
                        } : undefined
                    });

                    if (currY < 0) {
                        prevMinY += currY;
                    } else {
                        prevMaxY += currY;
                    }
                }
            }
        });

        return nodeData;
    }

    update(): void {
        const { visible, chart, xAxis, yAxis, xData, yData } = this;

        this.group.visible = visible;

        if (!chart || chart.layoutPending || chart.dataPending ||
            !xAxis || !yAxis || !visible || !xData.length || !yData.length) {
            return;
        }

        const nodeData = this.createNodeData();

        this.updateRectSelection(nodeData);
        this.updateRectNodes();

        this.updateLabelSelection(nodeData);
        this.updateLabelNodes();
    }

    private updateRectSelection(selectionData: BarNodeDatum[]): void {
        const updateRects = this.rectSelection.setData(selectionData);
        updateRects.exit.remove();
        const enterRects = updateRects.enter.append(Rect).each(rect => {
            rect.tag = BarSeriesNodeTag.Bar;
            rect.crisp = true;
        });
        this.rectSelection = updateRects.merge(enterRects);
    }

    private updateRectNodes(): void {
        if (!this.chart) {
            return;
        }

        const {
            fillOpacity, strokeOpacity, shadow, formatter, xKey, flipXY,
            chart: { highlightedDatum },
            highlightedItemId,
            highlightStyle: {
                fill: deprecatedFill,
                stroke: deprecatedStroke,
                strokeWidth: deprecatedStrokeWidth,
                item: {
                    fill: highlightedFill = deprecatedFill,
                    stroke: highlightedStroke = deprecatedStroke,
                    strokeWidth: highlightedDatumStrokeWidth = deprecatedStrokeWidth,
                },
                series: {
                    enabled: subSeriesHighlightingEnabled,
                    strokeWidth: highlightedSubSeriesStrokeWidth
                }
            }
        } = this;

        this.rectSelection.each((rect, datum) => {
            const isDatumHighlighted = datum === highlightedDatum;
            const isSubSeriesHighlighted = highlightedItemId === datum.itemId;
            const fill = isDatumHighlighted && highlightedFill !== undefined ? highlightedFill : datum.fill;
            const stroke = isDatumHighlighted && highlightedStroke !== undefined ? highlightedStroke : datum.stroke;
            const strokeWidth = isDatumHighlighted && highlightedDatumStrokeWidth !== undefined
                ? highlightedDatumStrokeWidth
                : subSeriesHighlightingEnabled && isSubSeriesHighlighted && highlightedSubSeriesStrokeWidth !== undefined
                    ? highlightedSubSeriesStrokeWidth
                    : datum.strokeWidth;

            let format: BarSeriesFormat | undefined = undefined;
            if (formatter) {
                format = formatter({
                    datum: datum.seriesDatum,
                    fill,
                    stroke,
                    strokeWidth,
                    highlighted: isDatumHighlighted,
                    xKey,
                    yKey: datum.yKey
                });
            }
            rect.x = datum.x;
            rect.y = datum.y;
            rect.width = datum.width;
            rect.height = datum.height;
            rect.fill = format && format.fill || fill;
            rect.stroke = format && format.stroke || stroke;
            rect.strokeWidth = format && format.strokeWidth !== undefined ? format.strokeWidth : strokeWidth;
            rect.fillOpacity = fillOpacity;
            rect.strokeOpacity = strokeOpacity;
            rect.lineDash = this.lineDash;
            rect.lineDashOffset = this.lineDashOffset;
            rect.fillShadow = shadow;
            // Prevent stroke from rendering for zero height columns and zero width bars.
            rect.visible = flipXY ? datum.width > 0 : datum.height > 0;
        });
    }

    private updateLabelSelection(selectionData: BarNodeDatum[]): void {
        const updateLabels = this.labelSelection.setData(selectionData);

        updateLabels.exit.remove();

        const enterLabels = updateLabels.enter.append(Text).each(text => {
            text.tag = BarSeriesNodeTag.Label;
            text.pointerEvents = PointerEvents.None;
        });

        this.labelSelection = updateLabels.merge(enterLabels);
    }

    private updateLabelNodes(): void {
        const labelEnabled = this.label.enabled;

        this.labelSelection.each((text, datum) => {
            const label = datum.label;

            if (label && labelEnabled) {
                text.fontStyle = label.fontStyle;
                text.fontWeight = label.fontWeight;
                text.fontSize = label.fontSize;
                text.fontFamily = label.fontFamily;
                text.textAlign = label.textAlign;
                text.textBaseline = label.textBaseline;
                text.text = label.text;
                text.x = label.x;
                text.y = label.y;
                text.fill = label.fill;
                text.visible = true;
            } else {
                text.visible = false;
            }
        });
    }

    getTooltipHtml(nodeDatum: BarNodeDatum): string {
        const { xKey, yKeys, yData } = this;
        const xAxis = this.getCategoryAxis();
        const yAxis = this.getValueAxis();
        const { yKey } = nodeDatum;

        if (!yData.length || !xKey || !yKey || !xAxis || !yAxis) {
            return '';
        }

        const yGroup = yData[nodeDatum.index];
        let fillIndex = 0;
        let i = 0;
        let j = 0;
        for (; j < yKeys.length; j++) {
            const stack = yKeys[j];
            i = stack.indexOf(yKey);
            if (i >= 0) {
                fillIndex += i;
                break;
            }
            fillIndex += stack.length;
        }

        const { xName, yNames, fills, tooltip } = this;
        const { renderer: tooltipRenderer } = tooltip;
        const datum = nodeDatum.seriesDatum;
        const yName = yNames[yKey];
        const color = fills[fillIndex % fills.length];
        const xValue = datum[xKey];
        const yValue = datum[yKey];
        const processedYValue = yGroup[j][i];
        const xString = sanitizeHtml(xAxis.formatDatum(xValue));
        const yString = sanitizeHtml(yAxis.formatDatum(yValue));
        const title = sanitizeHtml(yName);
        const content = xString + ': ' + yString;
        const defaults: TooltipRendererResult = {
            title,
            backgroundColor: color,
            content
        };

        if (tooltipRenderer) {
            return toTooltipHtml(tooltipRenderer({
                datum,
                xKey,
                xValue,
                xName,
                yKey,
                yValue,
                processedYValue,
                yName,
                color
            }), defaults);
        }

        return toTooltipHtml(defaults);
    }

    listSeriesItems(legendData: LegendDatum[]): void {
        const {
            id, data, xKey, yKeys, yNames, cumYKeyCount, seriesItemEnabled, hideInLegend,
            fills, strokes, fillOpacity, strokeOpacity
        } = this;

        if (data && data.length && xKey && yKeys.length) {
            this.yKeys.forEach((stack, stackIndex) => {
                stack.forEach((yKey, levelIndex) => {
                    if (hideInLegend.indexOf(yKey) < 0) {
                        const colorIndex = cumYKeyCount[stackIndex] + levelIndex;
                        legendData.push({
                            id,
                            itemId: yKey,
                            enabled: seriesItemEnabled.get(yKey) || false,
                            label: {
                                text: yNames[yKey] || yKey
                            },
                            marker: {
                                fill: fills[colorIndex % fills.length],
                                stroke: strokes[colorIndex % strokes.length],
                                fillOpacity: fillOpacity,
                                strokeOpacity: strokeOpacity
                            }
                        });
                    }
                });
            });
        }
    }

    toggleSeriesItem(itemId: string, enabled: boolean): void {
        const { seriesItemEnabled } = this;
        seriesItemEnabled.set(itemId, enabled);

        const yKeys = this.yKeys.map(stack => stack.slice()); // deep clone


        seriesItemEnabled.forEach((enabled, yKey) => {
            if (!enabled) {
                yKeys.forEach(stack => {
                    const index = stack.indexOf(yKey);
                    if (index >= 0) {
                        stack.splice(index, 1);
                    }
                });
            }
        });

        const visibleStacks: string[] = [];
        yKeys.forEach((stack, index) => {
            if (stack.length > 0) {
                visibleStacks.push(String(index));
            }
        });
        this.groupScale.domain = visibleStacks;

        this.scheduleData();
    }
}
