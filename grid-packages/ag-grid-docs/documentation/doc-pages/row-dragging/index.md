---
title: "Row Dragging"
---

Row dragging is used to rearrange rows by dragging the row with the mouse. To
enable row dragging, set the column property `rowDrag` on one (typically
the first) column.

## Enabling Row Dragging

<api-documentation source='column-properties/properties.json' section='row dragging' names='["rowDrag"]' config='{"overrideBottomMargin":"1rem"}' ></api-documentation>

To enable row dragging on all columns, set the column property `rowDrag = true` on one (typically the first) column.

<snippet>
const gridOptions = {
    columnDefs: [
        // make all rows draggable
        { field: 'athlete', rowDrag: true },
    ],
}
</snippet>

It is also possible to dynamically control which rows are draggable by providing a callback function as shown below:

<snippet>
const gridOptions = {
    columnDefs: [
        // only allow non-group rows to be dragged
        { field: 'athlete', rowDrag: params => !params.node.group },
    ],
}
</snippet>

There are two ways in which row dragging works in the grid, managed and unmanaged:

- **Managed Dragging**: This is the simplest, where the grid will rearrange rows as you drag them.
- **Unmanaged Dragging**: This is more complex and more powerful. The grid will not rearrange rows as you drag. Instead the application is responsible for responding to events fired by the grid and rows are rearranged by the application.

## Managed Dragging

In managed dragging, the grid is responsible for rearranging the rows as the rows are dragged. Managed dragging is enabled with the property `rowDragManaged=true`.

The example below shows simple managed dragging. The following can be noted:

- The first column has `rowDrag=true` which results in a draggable area being included in the cell.
- The property `rowDragManaged` is set, to tell the grid to move the row as the row is dragged.
- If a sort (click on the header) or filter (open up the column menu) is applied to the column, the draggable icon for row dragging is hidden. This is consistent with the constraints explained after the example.

<grid-example title='Row Drag Simple Managed' name='simple-managed' type='generated'></grid-example>

The logic for managed dragging is simple and has the following constraints:

- Works with [Client-Side](/client-side-model/) row model only; not with the [Infinite](/infinite-scrolling/), [Server-Side](/server-side-model/) or [Viewport](/viewport/) row models.
- Does not work if [Pagination](/row-pagination/) is enabled.
- Does not work when sorting is applied. This is because the sort order of the rows depends on the data and moving the data would break the sort order.
- Does not work when filtering is applied. This is because a filter removes rows making it impossible to know what 'real' order of rows when some are missing.
- Does not work when row grouping or pivot is active. This is because moving rows between groups would require a knowledge of the underlying data which only your application knows.

These constraints can be bypassed by using [unmanaged row dragging](#unmanaged-dragging).

### Suppress Move When Dragging

By default, the managed row dragging moves the rows while you are dragging them. This effect might not be desirable due to your application design. To prevent this default behaviour, set `suppressMoveWhenRowDragging` to `true` in the `gridOptions`.

<grid-example title='Row Drag with SuppressMoveWhenRowDragging' name='managed-suppress-move-when-dragging' type='generated'></grid-example>

### Multi-Row Dragging

It is possible to drag multiple rows at the same time, when `rowDragMultiRow` is set to `true` in the `gridOptions` and it is combined with `rowSelection='multiple'`.

For this example note the following:

- When you select multiple items and drag one of them, all items in the selection will be dragged.
- When you drag an item that is not selected while other items are selected, only the unselected item will be dragged.

<grid-example title='Row Drag with Multi Row Drag' name='managed-with-multi-row-drag' type='generated'></grid-example>

### Entire Row Dragging

When using managed row dragging it is also possible to reorder rows by clicking and dragging anywhere on the row without
the need for a drag handle by enabling the `rowDragEntireRow` grid option as shown below:

<snippet>
const gridOptions = {
    columnDefs: [
        { field: 'country' },
        { field: 'year' },
        { field: 'sport' },
        { field: 'total' }
    ],
    // entire row dragging is only supported with managed row dragging
    rowDragManaged: true,
    // allows rows to dragged without the need for drag handles
    rowDragEntireRow: true,
    // entire row dragging requires row selection ('single' or 'multiple')  
    rowSelection: 'single',
}
</snippet>

The example below demonstrates entire row dragging with [Multi-Row Dragging](/row-dragging/#multi-row-dragging). Note
the following:

- Reordering rows by clicking and dragging anywhere on a row is possible as `rowDragEntireRow` and `rowDragManaged` enabled.
- Multiple rows can be selected and dragged as `rowDragMultiRow` is also enabled with `rowSelection = 'multiple'`.

<grid-example title='Entire Row Dragging' name='entire-row-dragging' type='generated' options='{ "enterprise": true, "modules": ["clientside"] }'></grid-example>

[[warning]]
|[Range Selection](/range-selection/) is not supported when `rowDragEntireRow` is enabled.   

## Suppress Row Drag

You can hide the draggable area by calling the grid API `setSuppressRowDrag()`
or by setting the bound property `suppressRowDrag`.

The example below is almost identical to the [Managed Dragging](#managed-dragging) example with the following differences:

- Button **Suppress** will hide the drag icons.
- Button **Remove Suppress** will un-hide the drag icons.
- Applying a sort or a filter to the grid will also suppress the drag icons.

<grid-example title='Suppress Row Drag' name='suppress-row-drag' type='generated'></grid-example>

## Unmanaged Dragging

Unmanaged dragging is the default dragging for the grid. To use it, do not set the property `rowDragManaged`. Unmanaged dragging differs from managed dragging in the following ways:

- The grid does not manage moving of the rows. The only thing the grid responds with is firing drag events. It is up to the application to do the moving of the rows (if that is what the application wants to do).
- Dragging is allowed while sort is applied.
- Dragging is allowed while filter is applied.
- Dragging is allowed while row group or pivot is applied.

[[note]]
| It is not possible for the grid to provide a generic solution for row
| dragging that fits all usage scenarios. The way around this is the grid
| fires events and the application is responsible for implementing what
| meets the application's requirements.

### Row Drag Events

There are four grid events associated with row dragging which are:

- `rowDragEnter`: A drag has started, or dragging already started and the mouse has re-entered the grid having previously left the grid.
- `rowDragMove`: The mouse has moved while dragging.
- `rowDragLeave`: The mouse has left the grid while dragging.
- `rowDragEnd`: The drag has finished over the grid.

Typically a drag will fire the following events:

1. `rowDragEnter` fired once - The drag has started.
1. `rowDragMove` fired multiple times - The mouse is dragging over the rows.
1. `rowDragEnd` fired once - The drag has finished.

Additional `rowDragLeave` and `rowDragEnter` events are fired if the mouse leaves or re-enters the grid. If the drag is finished outside of the grid, then the `rowDragLeave` is the last event fired and no `rowDragEnd` is fired, as the drag did not end on the grid.

Each of the four row drag events has the following attributes:

- `type`: One of `{rowDragEnter, rowDragMove, rowDragEnd, rowDragLeave}`.
- `api`: The grid API.
- `columnApi`: The grid column API.
- `event`: The underlying mouse move event associated with the drag.
- `node`: The row node getting dragged.
- `overIndex`: The row index the mouse is dragging over or -1 if over no row.
- `overNode`: The row node the mouse is dragging over or undefined if over no row.
- `y`: The vertical pixel location the mouse is over, with `0` meaning the top of the first row. This can be compared to the `rowNode.rowHeight` and `rowNode.rowTop` to work out the mouse position relative to rows. The provided attributes `overIndex` and `overNode` means the `y` property is mostly redundant. The `y` property can be handy if you want more information such as 'how close is the mouse to the top or bottom of the row'.
- `vDirection`: Direction of the drag, either `up`, `down` or blank (if mouse is moving horizontally and not vertically).

### Example Events

The below example demonstrates unmanaged row dragging with no attempt by the application or the grid to re-order the rows - this is on purpose to demonstrate the grid will not attempt to re-order rows unless you set the `rowDragManaged` property. The example also demonstrates all the events that are fired.

From the example the following can be noted:

- The first column has `rowDrag=true` which results in a draggable
  area included in the cell.

- The grid has not set `rowDragManaged` which results in the grid
  not reordering rows as they are dragged.

- All of the drag events are listened for and when one is received, it is printed to the console. To best see this, open the example in a new tab and open the developer console.

- Because `rowDragManaged` is not set, the row dragging is left enabled even if sorting or filtering is applied. This is because your application should decide if dragging should be allowed or suppressed using the `suppressRowDrag` property.

<grid-example title='Row Drag Events' name='dragging-events' type='generated'></grid-example>

### Simple Unmanaged Example

The example below shows how to implement simple row dragging using unmanaged row dragging and events. The example behaves the same as the [Managed Dragging](#managed-dragging) example above, however the logic for moving the rows is in the application rather than the grid.

From the example the following can be noted:

- The property `suppressRowDrag=true` is set by the application
  depending on whether sorting or filtering is active. This is because the logic
  in the example doesn't cover these scenarios and wants to prevent row
  dragging when sorting or filtering is active.

- To update the data the example uses an [Immutable Data Store](/immutable-data/) and sets `immutableData=true`. The application is free to use any update mechanism it wants; see [Updating Data](/data-update/) for different options.

<grid-example title='Row Drag Simple Unmanaged' name='simple-unmanaged' type='generated'></grid-example>

The simple example doesn't add anything that managed dragging gives (the first
example on this page). Things get interesting when we introduce complex scenarios
such as row grouping or tree data, which are explained below.

[[note]]
|Dragging Multiple Rows with unmanaged row dragging, the application is in control of what gets dragged, so it is possible to use the events to drag more than one row at a time, e.g. to move all selected rows in one go if using row selection.

## Dragging & Row Grouping

[Row Grouping](/grouping/) in the grid allows grouping rows by a particular column. Dragging rows while grouping is possible when doing unmanaged row dragging. The application is responsible for updating the data based on the drag events fired by the grid.

The example below uses row dragging to place rows into groups. It does not try to order the rows within the group. For this reason, the logic works regardless of sorting or filtering.

The example below shows row dragging with [Row Grouping](/grouping/) where the following can be noted:

- The **Athlete** column has row drag enabled for non-group rows. This is achieved using the function variant of the `rowDrag` property.
- The grid has not set the `rowDragManaged` property which results in unmanaged row dragging.
- The example does not re-order the rows. Instead the example demonstrates putting the rows into groups. If you drag a row, you can place it in a different parent group.
- The example listens to the event `onRowDragMove` and changes the group a row belongs to while the drag is happening (which is different to the next Tree Data example which waits until the drag is complete). It is the choice of your application whether it wants to move rows in real time during the drag, or wait until the drag action is complete.
- The application can still move rows to groups even if ordering or sorting is applied. For this reason, the application does not suppress row dragging if sorting or filtering is applied.

<grid-example title='Dragging with Row Groups' name='dragging-with-row-groups' type='generated' options=' {"enterprise": true, "exampleHeight": 650, "modules": ["clientside", "rowgrouping", "setfilter", "menu", "columnpanel"] }'></grid-example>

## Row Dragging & Tree Data

[Tree Data](/tree-data/) in the grid allows providing data to the grid in parent / child relationships, similar to that required for a file browser. Dragging rows with tree data is possible when doing unmanaged row dragging. The application is responsible for updating the data based on the drag events fired by the grid.

### Example Tree Data

The example below shows [Tree Data](/tree-data/) and row dragging where the following can be noted:

- The [auto-group column](/grouping/#auto-column-group) has row drag `true` for all rows.

-  The example registers for `onRowDragEnd` events and rearranges
   the rows when the drag completes.

- The application does NOT rearrange the rows as the drag is happening. Instead it waits for the `onRowDragEnd` event before updating the data.

- The expanded/contracted state of a folder and all of its child folders is preserved when the folder is moved to a new parent.

<grid-example title='Dragging with Tree Data' name='dragging-with-tree-data' type='generated' options='{ "enterprise": true, "exampleHeight": 545, "extras": ["fontawesome"], "modules": ["clientside", "rowgrouping"] }'></grid-example>

### Example Highlighted Tree Data

The example above works, however it is not intuitive as the user is given no visual hint what folder will be the destination folder. The example below continues with the example above by providing hints to the user while the drag is in progress. From the example the following can be observed:

- The example registers for `onRowDragMove` events and works out what folder the mouse is over as the drag is happening.

- While the row is dragging, the application highlights the folder that is currently selected as the destination folder (called `potentialParent` in the example code).

- The application does NOT rearrange the rows as the drag is happening. As with the previous example, it waits for the `onRowDragEnd` event before updating the data.

- The example uses [Cell Class Rules](/cell-styles/#cell-class-rules) to highlight the destination folder. The example adds a CSS class `hover-over` to all the cells of the destination folder.

- The example uses [Refresh Cells](/view-refresh/#refresh-cells) to get the grid to execute the Cell Class Rules again over the destination folder when the destination folder changes.

<grid-example title='Highlighting Drag with Tree Data' name='highlighting-drag-tree-data' type='generated' options='{ "enterprise": true, "extras": ["fontawesome"], "modules": ["clientside", "rowgrouping"] }'></grid-example>

## Other Row Models

Unmanaged row dragging will work with any of the row models [Infinite](/infinite-scrolling/), [Server-Side](/server-side-model/) and [Viewport](/viewport/). With unmanaged dragging, the implementation of what happens when a particular drag happens is up to your application.

Because the grid implementation with regard to row dragging is identical to the above, examples of row dragging with the other row models are not given. How your application behaves with regards to the row drag events is the difficult bit, but that part is specific to your application and how your application stores its state. Giving an example here with a different data store would be redundant.

## Customisation

There are some options that can be used to customise the Row Drag experience, so it has a better integration with your application.

### Custom Row Drag Text

When a row drag starts, a "floating" DOM element is created to indicate which row is being dragged. By default, this DOM
element will contain the same value as the cell that started the row drag. It's possible to override that text by using
the `colDef.rowDragText` callback.

<api-documentation source='column-properties/properties.json' section='row dragging' names='["rowDragText"]' config='{"overrideBottomMargin":"1rem"}'></api-documentation>

<snippet>
const gridOptions = {
    columnDefs: [
        {
            field: 'athlete',
            rowDrag: true,
            rowDragText: (params, dragItemCount) => {
                return (
                    dragItemCount > 1
                        ? (dragItemCount + ' items')
                        : params.defaultTextValue + ' is'
                ) + ' being dragged...';
            }
        }
    ]
}
</snippet>

The example below shows dragging with custom text. The following can be noted:

- When you drag row of the year 2012, the `rowDragText` callback will add **(London Olympics)** to the floating drag element.

<grid-example title='Row Drag With Custom Text' name='custom-drag-text' type='generated'></grid-example>

### Row Dragger inside Custom Cell Renderers

Due to the complexity of some applications, it could be handy to render the Row Drag Component inside of a Custom Cell Renderer. This can be achieved, by using the `registerRowDragger` method in the [ICellRendererParams](/component-cell-renderer/#cell-renderer-component) as follows:

[[only-javascript]]
| ```js
| // your custom cell renderer init code
| const rowDragger = document.createElement('div')
| this.eGui.appendChild(rowDragger);
|
| // register it as a row dragger
| params.registerRowDragger(rowDragger);
| ```

[[only-angular]]
| ```js
| // your custom cell renderer code
| @ViewChild('myref') myRef;
|
| agInit(params: ICellRendererParams): void {
|     this.cellRendererParams = params;
| }
|
| ngAfterViewInit() {
|     this.cellRendererParams.registerRowDragger(this.myRef.nativeElement);
| }
| ```

[[only-react]]
| ```js
| // your custom cell renderer code
|
| // this will hold the reference to the element you want to
| // to act as row dragger.
| myRef = React.createRef();
|
| componentDidMount() {
|     this.props.registerRowDragger(this.myRef.current);
| }
| ```


[[only-vue]]
| ```js
| // your custom cell renderer code
| mounted() {
|     this.params.registerRowDragger(this.$refs.myRef);
| }
| ```

[[warning]]
| When using `registerRowDragger` you should **not** set the property `rowDrag=true` in the Column Definition.
| Doing that will cause the cell to have two row draggers.

The example below shows a custom cell renderer, with using the `registerRowDragger` callback to render the Row Dragger inside itself.

- When you hover the cells, an arrow will appear, and this arrow can be used to **drag** the rows.

<grid-example title='Row Drag With Custom Cell Renderer' name='dragger-inside-custom-cell-renderer' type='generated' options='{ "extras": ["fontawesome"] }'></grid-example>

### Full Width Row Dragging

It is possible to drag [Full Width Rows](../full-width-rows/) by registering a [Custom Row Dragger](#row-dragger-inside-custom-cell-renderers).

Note the following: 

- Only the Full Width Rows are draggable.

<grid-example title='Row Drag with Full Width Rows' name='dragger-inside-full-width-row' type='generated'></grid-example>

### Row Dragger with Custom Start Drag Pixels

By default, the drag event only starts after the **Row Drag Element** has been dragged by `4px`, but sometimes it might be useful to start the drag with a different drag threshold, for example, start dragging as soon as the `mousedown` event happens (dragged by `0px`). For that reason, the `registerRowDragger` takes a second parameter to specify the number of pixels that will start the drag event.

Note the following:

- The drag event starts as soon as `mousedown` is fired.

<grid-example title='Row Drag With Custom Start Drag Pixels' name='dragger-inside-custom-start-drag-pixels' type='generated' options='{ "extras": ["fontawesome"] }'></grid-example>