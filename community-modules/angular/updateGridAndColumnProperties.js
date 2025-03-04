const replace = require('replace-in-file');
const fs = require('fs');
const { EOL } = require('os');
const ts = require('typescript');
const { ComponentUtil } = require("@ag-grid-community/core");
const { getFormatterForTS, findNode, getJsDoc } = require('./../../scripts/formatAST');

const formatNode = getFormatterForTS(ts);

function extractTypesFromNode(srcFile, node, { typeLookup, eventTypeLookup, publicEventLookup, docLookup }) {
    const kind = ts.SyntaxKind[node.kind];
    const name = node && node.name && node.name.escapedText;
    const returnType = node && node.type && node.type.getFullText();
    docLookup[name] = getJsDoc(node);
    if (kind == 'PropertySignature') {
        typeLookup[name] = returnType;
    } else if (kind == 'MethodSignature') {
        if (node.parameters && node.parameters.length > 0) {
            const methodParams = node.parameters.map(p => `${p.name.escapedText}: ${formatNode(p.type, srcFile)}`);
            typeLookup[name] = `(${methodParams.join(', ')}) => ${returnType}`;
        } else {
            typeLookup[name] = `() => ${returnType}`
        }

        if (publicEventLookup[name]) {
            // Events are assumed to have a single parameter
            if (node.parameters.length > 1) {
                throw new Error("Events with more than one parameter will cause issues to the frameworks!");
            }
            const typeName = formatNode(node.parameters[0].type, srcFile);
            eventTypeLookup[name] = typeName;
        }
    };
    ts.forEachChild(node, n => extractTypesFromNode(srcFile, n, { typeLookup, eventTypeLookup, publicEventLookup, docLookup }));
}


function generateAngularInputOutputs(compUtils, { typeLookup, eventTypeLookup, docLookup }) {
    let result = '';
    const skippableProperties = ['gridOptions'];

    compUtils.ALL_PROPERTIES.forEach((property) => {
        if (skippableProperties.indexOf(property) === -1) {
            const typeName = typeLookup[property];
            const inputType = getSafeType(typeName);
            result = addDocLine(docLookup, property, result);
            result += `    @Input() public ${property}: ${inputType} = undefined;${EOL}`;
        }
    });

    // for readability
    result += EOL;

    const missingEventTypes = [];
    compUtils.PUBLIC_EVENTS.forEach((event) => {
        const onEvent = compUtils.getCallbackForEvent(event);
        const eventType = eventTypeLookup[onEvent];
        if (eventType) {
            result += `    @Output() public ${event}: EventEmitter<${eventType}> = new EventEmitter<${eventType}>();${EOL}`;
        } else {
            missingEventTypes.push(event);
        }
    });

    if (missingEventTypes.length > 0) {
        throw new Error(`The following events are missing type information: [${missingEventTypes.join()}]\n If this is a public event add it to the GridOptions interface. \n If a private event add it to ComponentUtil.EXCLUDED_INTERNAL_EVENTS.\n`)
    }

    result = addTypeCoercionHints(result, compUtils.BOOLEAN_PROPERTIES);

    return result;
}

function addTypeCoercionHints(result, boolProps) {
    result += `${EOL}    // Enable type coercion for boolean Inputs to support use like 'enableCharts' instead of forcing '[enableCharts]="true"' ${EOL}`;
    result += `    // https://angular.io/guide/template-typecheck#input-setter-coercion ${EOL}`;
    boolProps.forEach((property) => {
        result += `    static ngAcceptInputType_${property}: boolean | null | '';${EOL}`;
    });
    return result;
}

function getSafeType(typeName) {
    let inputType = 'any';
    if (typeName) {
        const trimmed = typeName.trim();
        // Ensure that we correctly apply the undefined as a separate union type for complex types
        // e.g isExternalFilterPresent: (() => boolean) | undefined = undefined;
        // Without the brackets this changes the return type!
        if (trimmed.includes('=>')) {
            inputType = `(${typeName.trim()}) | undefined`;
        }
        else {
            inputType = `${typeName.trim()} | undefined`;
        }
    }
    return inputType;
}

function addDocLine(docLookup, property, result) {
    const doc = docLookup[property];
    if (doc) {
        // Get comments to line up properly
        result += `    ${doc.replace(/\s\*/g, `     *`)}${EOL}`;
    }
    return result;
}

function parseFile(sourceFile) {
    const src = fs.readFileSync(sourceFile, 'utf8');
    return ts.createSourceFile('tempFile.ts', src, ts.ScriptTarget.Latest, true);
}

function getGridPropertiesAndEventsJs() {
    const gridOpsFile = "../../community-modules/core/src/ts/entities/gridOptions.ts";
    const srcFile = parseFile(gridOpsFile);
    const gridOptionsNode = findNode('GridOptions', srcFile);

    // Apply @Output formatting to public events that are present in this lookup
    const publicEventLookup = {};
    ComponentUtil.PUBLIC_EVENTS.forEach(e => publicEventLookup[ComponentUtil.getCallbackForEvent(e)] = true);

    let context = {
        typeLookup: {},
        eventTypeLookup: {},
        docLookup: {},
        publicEventLookup
    }
    extractTypesFromNode(srcFile, gridOptionsNode, context);

    return generateAngularInputOutputs(ComponentUtil, context);
}

function getGridColumnPropertiesJs() {
    const { ColDefUtil } = require("@ag-grid-community/core");

    // colDef properties that dont make sense in an angular context (or are private)
    const skippableProperties = ['template',
        'templateUrl',
        'pivotKeys',
        'pivotValueColumn',
        'pivotTotalColumnIds',
        'templateUrl'
    ];

    const filename = "../../community-modules/core/src/ts/entities/colDef.ts";
    const srcFile = parseFile(filename);
    const abstractColDefNode = findNode('AbstractColDef', srcFile);
    const colGroupDefNode = findNode('ColGroupDef', srcFile);
    const colDefNode = findNode('ColDef', srcFile);


    let context = {
        typeLookup: {},
        eventTypeLookup: {},
        docLookup: {},
        publicEventLookup: {}
    }

    extractTypesFromNode(srcFile, abstractColDefNode, context);
    extractTypesFromNode(srcFile, colGroupDefNode, context);
    extractTypesFromNode(srcFile, colDefNode, context);

    let result = '';

    function unique(value, index, self) {
        return self.indexOf(value) === index;
    }

    ColDefUtil.ALL_PROPERTIES.filter(unique).forEach((property) => {
        if (skippableProperties.indexOf(property) === -1) {
            const typeName = context.typeLookup[property];

            const inputType = getSafeType(typeName)
            result = addDocLine(context.docLookup, property, result);
            result += `    @Input() public ${property}: ${inputType} = undefined;${EOL}`;
        }
    });

    result = addTypeCoercionHints(result, ColDefUtil.BOOLEAN_PROPERTIES);

    return result;
}

const updateGridProperties = (getGridPropertiesAndEvents) => {
    // extract the grid properties & events and add them to our angular grid component
    const gridPropertiesAndEvents = getGridPropertiesAndEvents();
    const optionsForGrid = {
        files: './projects/ag-grid-angular/src/lib/ag-grid-angular.component.ts',
        from: /(\/\/ @START@)[^]*(\/\/ @END@)/,
        to: `// @START@${EOL}${gridPropertiesAndEvents}    // @END@`,
    };

    replace(optionsForGrid)
        .then(filesChecked => {
            const changes = filesChecked.filter(change => change.hasChanged);
            console.log(`Grid Properties: ${changes.length === 0 ? 'No Modified files' : 'Modified files: ' + changes.map(change => change.file).join(', ')}`);
        });
};

const updateColProperties = (getGridColumnProperties) => {
    // extract the grid column properties our angular grid column component
    const gridColumnProperties = getGridColumnProperties();
    const optionsForGridColumn = {
        files: './projects/ag-grid-angular/src/lib/ag-grid-column.component.ts',
        from: /(\/\/ @START@)[^]*(\s.*\/\/ @END@)/,
        to: `// @START@${EOL}${gridColumnProperties}    // @END@`,
    };

    replace(optionsForGridColumn)
        .then(filesChecked => {
            const changes = filesChecked.filter(change => change.hasChanged);
            console.log(`Column Properties: ${changes.length === 0 ? 'No Modified files' : 'Modified files: ' + changes.map(change => change.file).join(', ')}`);
        });
};

updatePropertiesBuilt = () => {
    updateGridProperties(getGridPropertiesAndEventsJs);
    updateColProperties(getGridColumnPropertiesJs);
}

console.log(`--------------------------------------------------------------------------------`);
console.log(`Generate Angular Component Input / Outputs...`);
console.log('Using Typescript version: ', ts.version)

updatePropertiesBuilt()

console.log(`--------------------------------------------------------------------------------`);