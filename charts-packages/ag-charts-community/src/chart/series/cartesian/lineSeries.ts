import { Path } from "../../../scene/shape/path";
import ContinuousScale from "../../../scale/continuousScale";
import { Selection } from "../../../scene/selection";
import { Group } from "../../../scene/group";
import {
    SeriesNodeDatum,
    CartesianTooltipRendererParams as LineTooltipRendererParams,
    SeriesTooltip
} from "../series";
import { numericExtent } from "../../../util/array";
import { PointerEvents } from "../../../scene/node";
import { Text } from "../../../scene/shape/text";
import { LegendDatum } from "../../legend";
import { CartesianSeries, CartesianSeriesMarker, CartesianSeriesMarkerFormat } from "./cartesianSeries";
import { ChartAxisDirection } from "../../chartAxis";
import { getMarker } from "../../marker/util";
import { reactive, PropertyChangeEvent, TypedEvent } from "../../../util/observable";
import { TooltipRendererResult, toTooltipHtml } from "../../chart";
import Scale from "../../../scale/scale";
import { interpolate } from "../../../util/string";
import { FontStyle, FontWeight } from "../../../scene/shape/text";
import { Label } from "../../label";
import { sanitizeHtml } from "../../../util/sanitize";

interface LineNodeDatum extends SeriesNodeDatum {
    readonly point: {
        readonly x: number;
        readonly y: number;
    }
    readonly label?: {
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

export interface LineSeriesNodeClickEvent extends TypedEvent {
    readonly type: 'nodeClick';
    readonly event: MouseEvent;
    readonly series: LineSeries;
    readonly datum: any;
    readonly xKey: string;
    readonly yKey: string;
}

export { LineTooltipRendererParams };

class LineSeriesLabel extends Label {
    @reactive('change') formatter?: (params: { value: any }) => string;
}

export class LineSeriesTooltip extends SeriesTooltip {
    @reactive('change') renderer?: (params: LineTooltipRendererParams) => string | TooltipRendererResult;
    @reactive('change') format?: string;
}

export class LineSeries extends CartesianSeries {

    static className = 'LineSeries';
    static type = 'line';

    private xDomain: any[] = [];
    private yDomain: any[] = [];
    private xData: any[] = [];
    private yData: any[] = [];

    private lineNode = new Path();

    // We use groups for this selection even though each group only contains a marker ATM
    // because in the future we might want to add label support as well.
    private nodeSelection: Selection<Group, Group, LineNodeDatum, any> = Selection.select(this.pickGroup).selectAll<Group>();
    private nodeData: LineNodeDatum[] = [];

    readonly marker = new CartesianSeriesMarker();

    readonly label = new LineSeriesLabel();

    @reactive('layoutChange') title?: string;

    @reactive('update') stroke?: string = '#874349';
    @reactive('update') lineDash?: number[] = undefined;
    @reactive('update') lineDashOffset: number = 0;
    @reactive('update') strokeWidth: number = 2;
    @reactive('update') strokeOpacity: number = 1;

    tooltip: LineSeriesTooltip = new LineSeriesTooltip();

    constructor() {
        super();

        const lineNode = this.lineNode;
        lineNode.fill = undefined;
        lineNode.lineJoin = 'round';
        lineNode.pointerEvents = PointerEvents.None;
        // Make line render before markers in the pick group.
        this.group.insertBefore(lineNode, this.pickGroup);

        this.addEventListener('update', this.scheduleUpdate);

        const { marker, label } = this;

        marker.fill = '#c16068';
        marker.stroke = '#874349';
        marker.addPropertyListener('shape', this.onMarkerShapeChange, this);
        marker.addPropertyListener('enabled', this.onMarkerEnabledChange, this);
        marker.addEventListener('change', this.scheduleUpdate, this);

        label.enabled = false;
        label.addEventListener('change', this.scheduleUpdate, this);
    }

    onMarkerShapeChange() {
        this.nodeSelection = this.nodeSelection.setData([]);
        this.nodeSelection.exit.remove();
        this.scheduleUpdate();

        this.fireEvent({ type: 'legendChange' });
    }

    protected onMarkerEnabledChange(event: PropertyChangeEvent<CartesianSeriesMarker, boolean>) {
        if (!event.value) {
            this.nodeSelection = this.nodeSelection.setData([]);
            this.nodeSelection.exit.remove();
        }
    }

    setColors(fills: string[], strokes: string[]) {
        this.stroke = fills[0];
        this.marker.stroke = strokes[0];
        this.marker.fill = fills[0];
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

    @reactive('update') xName: string = '';

    protected _yKey: string = '';
    set yKey(value: string) {
        if (this._yKey !== value) {
            this._yKey = value;
            this.yData = [];
            this.scheduleData();
        }
    }

    get yKey(): string {
        return this._yKey;
    }

    @reactive('update') yName: string = '';

    processData(): boolean {
        const { xAxis, yAxis, xKey, yKey, xData, yData } = this;
        const data = xKey && yKey && this.data ? this.data : [];

        if (!xAxis || !yAxis) {
            return false;
        }

        const isContinuousX = xAxis.scale instanceof ContinuousScale;
        const isContinuousY = yAxis.scale instanceof ContinuousScale;

        xData.length = 0;
        yData.length = 0;

        for (let i = 0, n = data.length; i < n; i++) {
            const datum = data[i];
            const x = datum[xKey];
            const y = datum[yKey];

            xData.push(x);
            yData.push(y);
        }

        this.xDomain = isContinuousX ? this.fixNumericExtent(numericExtent(xData), 'x') : xData;
        this.yDomain = isContinuousY ? this.fixNumericExtent(numericExtent(yData), 'y') : yData;

        return true;
    }

    getDomain(direction: ChartAxisDirection): any[] {
        if (direction === ChartAxisDirection.X) {
            return this.xDomain;
        }
        return this.yDomain;
    }

    onHighlightChange() {
        this.updateNodes();
    }

    highlight(itemId?: any): boolean {
        if (!super.highlight(itemId)) {
            return false;
        }

        const { strokeWidth } = this.highlightStyle.series;
        this.lineNode.strokeWidth = strokeWidth !== undefined ? strokeWidth : this.strokeWidth;

        return true;
    }

    dehighlight(): boolean {
        if (!super.dehighlight()) {
            return false;
        }
        this.lineNode.strokeWidth = this.strokeWidth;
        return true;
    }

    resetHighlight() {
        this.lineNode.strokeWidth = this.strokeWidth;
    }

    update(): void {
        this.group.visible = this.visible;

        const { chart, xAxis, yAxis } = this;

        if (!chart || chart.layoutPending || chart.dataPending || !xAxis || !yAxis) {
            return;
        }

        this.updateLinePath(); // this will create node data too
        this.updateNodeSelection();
        this.updateNodes();
    }

    private getXYDatums(i: number, xData: number[], yData: number[],
                      xScale: Scale<any, any>, yScale: Scale<any, any>): [number, number] | undefined {
        const isContinuousX = xScale instanceof ContinuousScale;
        const isContinuousY = yScale instanceof ContinuousScale;
        const xDatum = xData[i];
        const yDatum = yData[i];
        const noDatum =
            yDatum == null || (isContinuousY && (isNaN(yDatum) || !isFinite(yDatum))) ||
            xDatum == null || (isContinuousX && (isNaN(xDatum) || !isFinite(xDatum)));
        return noDatum ? undefined : [xDatum, yDatum];
    }

    private updateLinePath() {
        const { data, xAxis, yAxis } = this;

        if (!data || !xAxis || !yAxis) {
            return;
        }

        const { xData, yData, lineNode, label } = this;
        const xScale = xAxis.scale;
        const yScale = yAxis.scale;
        const xOffset = (xScale.bandwidth || 0) / 2;
        const yOffset = (yScale.bandwidth || 0) / 2;
        const linePath = lineNode.path;
        const nodeData: LineNodeDatum[] = [];

        linePath.clear();
        let moveTo = true;
        let prevXInRange: undefined | -1 | 0 | 1 = undefined;
        let nextXYDatums: [number, number] | undefined = undefined;
        for (let i = 0; i < xData.length; i++) {
            const xyDatums = nextXYDatums || this.getXYDatums(i, xData, yData, xScale, yScale);

            if (!xyDatums) {
                prevXInRange = undefined;
                moveTo = true;
            } else {
                const [xDatum, yDatum] = xyDatums;
                const x = xScale.convert(xDatum) + xOffset;
                const tolerance = (xScale.bandwidth || (this.marker.size * 0.5 + (this.marker.strokeWidth || 0))) + 1;

                nextXYDatums = this.getXYDatums(i + 1, xData, yData, xScale, yScale);
                const xInRange = xAxis.inRangeEx(x, 0, tolerance);
                const nextXInRange = nextXYDatums && xAxis.inRangeEx(xScale.convert(nextXYDatums[0]) + xOffset, 0, tolerance);
                if (xInRange === -1 && nextXInRange === -1) {
                    moveTo = true;
                    continue;
                }
                if (xInRange === 1 && prevXInRange === 1) {
                    moveTo = true;
                    continue;
                }
                prevXInRange = xInRange;

                const y = yScale.convert(yDatum) + yOffset;

                if (moveTo) {
                    linePath.moveTo(x, y);
                    moveTo = false;
                } else {
                    linePath.lineTo(x, y);
                }

                let labelText: string;

                if (label.formatter) {
                    labelText = label.formatter({ value: yDatum });
                } else {
                    labelText = typeof yDatum === 'number' && isFinite(yDatum) ? yDatum.toFixed(2) : yDatum ? String(yDatum) : '';
                }

                nodeData.push({
                    series: this,
                    seriesDatum: data[i],
                    point: { x, y },
                    label: labelText ? {
                        text: labelText,
                        fontStyle: label.fontStyle,
                        fontWeight: label.fontWeight,
                        fontSize: label.fontSize,
                        fontFamily: label.fontFamily,
                        textAlign: 'center',
                        textBaseline: 'bottom',
                        fill: label.color
                    } : undefined
                });
            }
        }

        lineNode.stroke = this.stroke;
        lineNode.strokeWidth = this.strokeWidth;
        lineNode.lineDash = this.lineDash;
        lineNode.lineDashOffset = this.lineDashOffset;
        lineNode.strokeOpacity = this.strokeOpacity;

        // Used by marker nodes and for hit-testing even when not using markers
        // when `chart.tooltipTracking` is true.
        this.nodeData = nodeData;
    }

    private updateNodeSelection() {
        const { marker } = this;
        const nodeData = marker.shape ? this.nodeData : [];
        const MarkerShape = getMarker(marker.shape);

        const updateSelection = this.nodeSelection.setData(nodeData);
        updateSelection.exit.remove();

        const enterSelection = updateSelection.enter.append(Group);
        enterSelection.append(MarkerShape);
        enterSelection.append(Text);

        this.nodeSelection = updateSelection.merge(enterSelection);
    }

    private updateNodes() {
        this.updateMarkerNodes();
        this.updateTextNodes();
    }

    private updateMarkerNodes() {
        if (!this.chart) {
            return;
        }

        const {
            marker, xKey, yKey,
            stroke: lineStroke,
            chart: { highlightedDatum },
            highlightStyle: {
                fill: deprecatedFill,
                stroke: deprecatedStroke,
                strokeWidth: deprecatedStrokeWidth,
                item: {
                    fill: highlightedFill = deprecatedFill,
                    stroke: highlightedStroke = deprecatedStroke,
                    strokeWidth: highlightedDatumStrokeWidth = deprecatedStrokeWidth,
                }
            }
        } = this;
        const { size, formatter } = marker;
        const markerStrokeWidth = marker.strokeWidth !== undefined ? marker.strokeWidth : this.strokeWidth;
        const MarkerShape = getMarker(marker.shape);

        this.nodeSelection.selectByClass(MarkerShape)
            .each((node, datum) => {
                const isDatumHighlighted = datum === highlightedDatum;
                const fill = isDatumHighlighted && highlightedFill !== undefined ? highlightedFill : marker.fill;
                const stroke = isDatumHighlighted && highlightedStroke !== undefined ? highlightedStroke : marker.stroke || lineStroke;
                const strokeWidth = isDatumHighlighted && highlightedDatumStrokeWidth !== undefined
                    ? highlightedDatumStrokeWidth
                    : markerStrokeWidth;

                let format: CartesianSeriesMarkerFormat | undefined = undefined;
                if (formatter) {
                    format = formatter({
                        datum: datum.seriesDatum,
                        xKey,
                        yKey,
                        fill,
                        stroke,
                        strokeWidth,
                        size,
                        highlighted: isDatumHighlighted
                    });
                }

                node.fill = format && format.fill || fill;
                node.stroke = format && format.stroke || stroke;
                node.strokeWidth = format && format.strokeWidth !== undefined
                    ? format.strokeWidth
                    : strokeWidth;
                node.size = format && format.size !== undefined
                    ? format.size
                    : size;

                node.translationX = datum.point.x;
                node.translationY = datum.point.y;
                node.visible = marker.enabled && node.size > 0;
            });
    }

    private updateTextNodes() {
        const labelEnabled = this.label.enabled;

        this.nodeSelection.selectByClass(Text)
            .each((text, datum) => {
                const { point, label } = datum;

                if (label && labelEnabled) {
                    text.fontStyle = label.fontStyle;
                    text.fontWeight = label.fontWeight;
                    text.fontSize = label.fontSize;
                    text.fontFamily = label.fontFamily;
                    text.textAlign = label.textAlign;
                    text.textBaseline = label.textBaseline;
                    text.text = label.text;
                    text.x = point.x;
                    text.y = point.y - 10;
                    text.fill = label.fill;
                    text.visible = true;
                } else {
                    text.visible = false;
                }
            });
    }

    getNodeData(): readonly LineNodeDatum[] {
        return this.nodeData;
    }

    fireNodeClickEvent(event: MouseEvent, datum: LineNodeDatum): void {
        this.fireEvent<LineSeriesNodeClickEvent>({
            type: 'nodeClick',
            event,
            series: this,
            datum: datum.seriesDatum,
            xKey: this.xKey,
            yKey: this.yKey
        });
    }

    getTooltipHtml(nodeDatum: LineNodeDatum): string {
        const { xKey, yKey, xAxis, yAxis } = this;

        if (!xKey || !yKey || !xAxis || !yAxis) {
            return '';
        }

        const { xName, yName, stroke: color, tooltip } = this;
        const {
            renderer: tooltipRenderer,
            format: tooltipFormat
        } = tooltip;
        const datum = nodeDatum.seriesDatum;
        const xValue = datum[xKey];
        const yValue = datum[yKey];
        const xString = xAxis.formatDatum(xValue);
        const yString = yAxis.formatDatum(yValue);
        const title = sanitizeHtml(this.title || yName);
        const content = sanitizeHtml(xString + ': ' + yString);
        const defaults: TooltipRendererResult = {
            title,
            backgroundColor: color,
            content
        };

        if (tooltipFormat || tooltipRenderer) {
            const params = {
                datum,
                xKey,
                xValue,
                xName,
                yKey,
                yValue,
                yName,
                title,
                color
            };
            if (tooltipFormat) {
                return toTooltipHtml({
                    content: interpolate(tooltipFormat, params)
                }, defaults);
            }
            if (tooltipRenderer) {
                return toTooltipHtml(tooltipRenderer(params), defaults);
            }
        }

        return toTooltipHtml(defaults);
    }

    listSeriesItems(legendData: LegendDatum[]): void {
        const {
            id, data, xKey, yKey, yName, visible,
            title, marker, stroke, strokeOpacity
        } = this;

        if (data && data.length && xKey && yKey) {
            legendData.push({
                id: id,
                itemId: undefined,
                enabled: visible,
                label: {
                    text: title || yName || yKey
                },
                marker: {
                    shape: marker.shape,
                    fill: marker.fill || 'rgba(0, 0, 0, 0)',
                    stroke: marker.stroke || stroke || 'rgba(0, 0, 0, 0)',
                    fillOpacity: 1,
                    strokeOpacity
                }
            });
        }
    }
}
