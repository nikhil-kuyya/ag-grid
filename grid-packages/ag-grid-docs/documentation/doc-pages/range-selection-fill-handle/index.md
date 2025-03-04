---
title: "Fill Handle"
enterprise: true
---

When working with a Range Selection, a Fill Handle allows you to run operations on cells as you adjust the size of the range.

## Enabling the Fill Handle

To enable the Fill Handle, simply set `enableFillHandle` to `true` in the `gridOptions` as shown below: 

<snippet>
const gridOptions = {
    columnDefs: [
        { field: 'country' },
        { field: 'year' },
        { field: 'sport' },
        { field: 'total' }
    ],
    enableRangeSelection: true,
    enableFillHandle: true
}
</snippet>

[[note]]
| It's important to note that if you enable both `enableFillHandle` and `enableRangeHandle`, the Fill Handle will take precedence.

## Default Fill Handle
The default Fill Handle behaviour will be as close as possible to other spreadsheet applications. Note the following: 

### Single Cell

- When a single cell is selected and the range is increased, the value of that cell will be copied to the cells added to the range.
- When a single cell containing a **number** value is selected and the range is increased while pressing the <kbd>Alt</kbd>/<kbd>Option</kbd> key, that value will be incremented (or decremented if dragging to the left or up) by the value of one until all new cells have been filled.

### Multi Cell

- When a range of numbers is selected and that range is extended, the Grid will detect the linear progression of the selected items and fill the extra cells with calculated values.
- When a range of strings or a mix of strings and numbers are selected and that range is extended, the range items will be copied in order until all new cells have been properly filled.
- When a range of numbers is selected and the range is increased while pressing the <kbd>Alt</kbd>/<kbd>Option</kbd> key, the behaviour will be the same as when a range of strings or mixed values is selected.

### Range Reduction

- When reducing the size of the range, cells that are no longer part of the range will be cleared (set to `null`).

<grid-example title='Fill Handle' name='fill-handle' type='generated' options='{ "enterprise": true, "exampleHeight": 560, "modules": ["clientside", "range"] }'></grid-example>

## Preventing Range Reduction

If the behaviour for decreasing selection needs to be prevented, the flag `suppressClearOnFillReduction` should be set to `true`.

<grid-example title='Fill Handle - Range Reduction' name='fill-handle-reduction' type='generated' options='{ "enterprise": true, "exampleHeight": 560, "modules": ["clientside", "range"] }'></grid-example>

## Fill Handle Axis

By the default, the Fill Handle can be dragged horizontally or vertically. If dragging only vertically, or only horizontally is a requirement, the `fillHandleDirection` should be added to the `gridOptions`, as follows: 

<snippet>
const gridOptions = {
    columnDefs: [
        { field: 'country' },
        { field: 'year' },
        { field: 'sport' },
        { field: 'total' }
    ],
    enableRangeSelection: true,
    enableFillHandle: true,
    fillHandleDirection: 'x' // Fill Handle can only be dragged horizontally
}
</snippet>

 To force the preferred axis for the Fill Handle, the `fillHandleDirection` property can be set to `x`, `y` or `xy` in the `gridOptions` or via API using `setFillHandleDirection`. This default value is `xy`.

<grid-example title='Fill Handle - Direction' name='fill-handle-direction' type='generated' options='{ "enterprise": true, "exampleHeight": 560, "modules": ["clientside", "range"] }'></grid-example>

## Custom User Function

Often there is a need to use a custom method to fill values instead of simply copying values or increasing number values using linear progression. In these scenarios, the `fillOperation` callback should be used.

<api-documentation source='grid-callbacks/callbacks.json' section='callbacks' names='["fillOperation"]'  ></api-documentation>

<snippet>
const gridOptions = {
    columnDefs: [
        { field: 'country' },
        { field: 'year' },
        { field: 'sport' },
        { field: 'total' }
    ],
    enableRangeSelection: true,
    enableFillHandle: true,
    fillOperation: (fillOperationParams) => {
        return 'Foo';
    }
}
</snippet>

### FillOperationParams
<interface-documentation interfaceName='FillOperationParams'></interface-documentation>

[[note]]
| If a `fillOperation` callback is provided, the fill handle will always run it. If the current values are not relevant to the `fillOperation` function that was provided, `false` should be returned to allow the grid to process the values as it normally would.

The example below will use the custom `fillOperation` for the **Day of the week** column, but it will use the default operation for any other column.

<grid-example title='Custom Fill Operation' name='custom-fill-operation' type='generated' options='{ "enterprise": true, "exampleHeight": 560, "modules": ["clientside", "range"] }'></grid-example>

### Skipping Columns in the Fill Operation

The example below will use the custom `fillOperation` to prevent values in the **Country** column from being altered by the Fill Handle.

[[note]]
| When the `fillOperation` function returns `params.currentCellValue` that value is not added to the `params.values` list. This allows users to skip any cells in the Fill Handle operation.

<grid-example title='Skipping Columns' name='skipping-columns' type='generated' options='{ "enterprise": true, "exampleHeight": 560, "modules": ["clientside", "range"] }'></grid-example>

[[warning]]
| Non editable cells will **not** be changed by the Fill Handle, so there is no need to add custom logic to skip columns that aren't editable.

## Suppressing the Fill Handle

When blocking the Fill Handle for certain columns is part of the requirement, the flag `suppressFillHandle` should be set to `true` in the [ColDef](/column-properties/).

In the example below note that the Fill Handle is disabled in the **Country** and **Date** columns.

<grid-example title='Suppress Fill Handle' name='suppress-fill-handle' type='generated' options='{ "enterprise": true, "exampleHeight": 560, "modules": ["clientside", "range"] }'></grid-example>