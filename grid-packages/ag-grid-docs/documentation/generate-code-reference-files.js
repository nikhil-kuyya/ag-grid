const fs = require('fs');
const ts = require('typescript');
const glob = require('glob');
const gulp = require('gulp');
const prettier = require('gulp-prettier');
const { ComponentUtil } = require("@ag-grid-community/core");
const { getFormatterForTS, findNode, getJsDoc } = require('../../../scripts/formatAST');

const formatNode = getFormatterForTS(ts);

const EVENT_LOOKUP = new Set(ComponentUtil.getEventCallbacks());

function findAllInNodesTree(node) {
    const kind = ts.SyntaxKind[node.kind];
    let interfaces = [];
    if (kind == 'InterfaceDeclaration' || kind == 'EnumDeclaration' || kind == 'TypeAliasDeclaration') {
        interfaces.push(node);
    }
    ts.forEachChild(node, n => {
        const nodeInterfaces = findAllInNodesTree(n);
        if (nodeInterfaces.length > 0) {
            interfaces = [...interfaces, ...nodeInterfaces];
        }
    });

    return interfaces;
}

function getArgTypes(parameters, file) {
    const args = {};
    (parameters || []).forEach(p => {
        const initValue = formatNode(p.initializer, file);
        args[p.name.escapedText] = `${formatNode(p.type, file)}${initValue ? ` = ${initValue}` : ''}`;
    });
    return args;
}

function toCamelCase(value) {
    return value[0].toLowerCase() + value.substr(1);
}

function extractTypesFromNode(node, srcFile, includeQuestionMark) {
    let nodeMembers = {};
    const kind = ts.SyntaxKind[node.kind];
    const appendQuestionMark = (name, n) => {
        let propName = name;
        if (includeQuestionMark && n && n.questionToken) {
            propName = `${propName}?`;
        }
        return propName;
    }

    let name = appendQuestionMark(node && node.name && node.name.escapedText, node);
    let returnType = node && node.type && node.type.getFullText().trim();

    if (kind == 'PropertySignature') {

        if (node.type && node.type.parameters) {
            // sendToClipboard?: (params: SendToClipboardParams) => void;
            const methodArgs = getArgTypes(node.type.parameters, srcFile);
            returnType = formatNode(node.type.type, srcFile);
            nodeMembers[name] = {
                description: getJsDoc(node),
                type: { arguments: methodArgs, returnType }
            };
        } else {
            // i.e colWidth?: number;             
            nodeMembers[name] = { description: getJsDoc(node), type: { returnType } };
        }
    } else if (kind == 'MethodSignature') {
        // i.e isExternalFilterPresent?(): boolean;
        // i.e doesExternalFilterPass?(node: RowNode): boolean;        
        const methodArgs = getArgTypes(node.parameters, srcFile);

        nodeMembers[name] = {
            description: getJsDoc(node),
            type: { arguments: methodArgs, returnType }
        };

        if (EVENT_LOOKUP.has(name)) {
            // Duplicate events without their prefix
            let shortName = name.substr(2);
            shortName = toCamelCase(shortName);

            nodeMembers[shortName] = { ...nodeMembers[name], meta: { isEvent: true, name } };
            nodeMembers[name] = { ...nodeMembers[name], meta: { isEvent: true, name } };
        }

    }
    return nodeMembers;
}

function parseFile(sourceFile) {
    const src = fs.readFileSync(sourceFile, 'utf8');
    return ts.createSourceFile('tempFile.ts', src, ts.ScriptTarget.Latest, true);
}

function getInterfaces() {
    const interfaceFiles = glob.sync('../../../community-modules/core/src/ts/**/*.ts');

    let interfaces = {};
    let extensions = {};
    interfaceFiles.forEach(file => {
        const parsedFile = parseFile(file);
        interfaces = { ...interfaces, ...extractInterfaces(parsedFile, extensions) };
    });

    // Now that we have recorded all the interfaces we can apply the extension properties.
    // For example CellPosition extends RowPosition and we want the json to add the RowPosition properties to the CellPosition
    applyInheritance(extensions, interfaces, false);
    return interfaces;
}

function applyInheritance(extensions, interfaces, isDocStyle) {
    Object.entries(extensions).forEach(([i, exts]) => {

        const getAncestors = (child) => {
            let ancestors = [];
            const extended = typeof (child) === 'string' ? child : child.extends;
            const parents = extensions[extended];
            if (parents) {
                ancestors = [...ancestors, ...parents];
                parents.forEach(p => {
                    ancestors = [...ancestors, ...getAncestors(p)]
                })
            }
            return ancestors;
        }

        const mergeAncestorProps = (parent, child, getProps) => {

            const props = { ...getProps(child) };
            let mergedProps = props;
            // If the parent has a generic params lets apply the child's specific types
            if (parent.params && parent.params.length > 0) {

                if (child.meta.typeParams) {
                    child.meta.typeParams.forEach((t, i) => {
                        Object.entries(props).forEach(([k, v]) => {
                            delete mergedProps[k];
                            // Replace the generic params. Regex to make sure you are not just replacing 
                            // random letters in variable names.
                            var rep = `(?<!\\w)${t}(?!\\w)`;
                            var re = new RegExp(rep, "g");
                            var newKey = k.replace(re, parent.params[i]);

                            if (isDocStyle) {
                                if (v.type) {
                                    let newArgs = undefined;
                                    if (v.type.arguments) {
                                        newArgs = {};
                                        Object.entries(v.type.arguments).forEach(([ak, av]) => {
                                            newArgs[ak] = av.replace(re, parent.params[i])
                                        })
                                    }
                                    const newReturnType = v.type.returnType.replace(re, parent.params[i])
                                    newValue = { ...v, type: { ...v.type, returnType: newReturnType, arguments: newArgs } }
                                }
                            } else {
                                var newValue = v.replace(re, parent.params[i]);
                            }

                            mergedProps[newKey] = newValue;
                        });
                    });
                }
                else {
                    throw new Error(`Parent interface ${parent.extends} takes generic params: [${parent.params.join()}] but child does not have typeParams.`);
                }
            }
            return mergedProps;
        };
        const allAncestors = getAncestors(i);
        let extendedInterface = interfaces[i];

        // TODO: Inherited Generic types do not get passed through
        // Would need to make this tree work so that the params applied lower down  get sent up the tree and correctly applied
        // Example interface is ICellEditorComp

        allAncestors.forEach(a => {
            const extended = a.extends;
            let aI = interfaces[extended];
            if (!aI) {
                //Check for type params                
                throw new Error('Missing interface', a);
            }

            if (isDocStyle) {
                if (aI) {
                    extendedInterface = { ...extendedInterface, ...mergeAncestorProps(a, aI, a => a) };
                }
            } else {
                if (aI && aI.type) {
                    extendedInterface.type = { ...extendedInterface.type, ...mergeAncestorProps(a, aI, a => a.type) };
                }
                if (aI && aI.docs) {
                    extendedInterface.docs = { ...extendedInterface.docs, ...mergeAncestorProps(a, aI, a => a.docs) };
                }
            }
        });
        interfaces[i] = extendedInterface;
    });
}

function extractInterfaces(srcFile, extension) {
    const interfaces = findAllInNodesTree(srcFile);
    const iLookup = {};
    interfaces.forEach(node => {
        const name = node && node.name && node.name.escapedText;
        const kind = ts.SyntaxKind[node.kind];

        if (node.heritageClauses && node.heritageClauses) {
            node.heritageClauses.forEach(h => {
                if (h.types && h.types.length > 0) {
                    extension[name] = h.types.map(h => ({ extends: formatNode(h.expression, srcFile), params: h.typeArguments ? h.typeArguments.map(t => formatNode(t, srcFile)) : undefined }));
                }
            });
        }

        if (kind == 'EnumDeclaration') {
            iLookup[name] = { meta: { isEnum: true }, type: node.members.map(n => formatNode(n, srcFile)) }
        } else if (kind == 'TypeAliasDeclaration' && node.type && node.type.types && !node.typeParameters) {
            iLookup[name] = { meta: { isTypeAlias: true }, type: formatNode(node.type, srcFile) }
        } else {

            let isCallSignature = false;
            let members = {};
            let docs = {};
            let callSignatureMembers = {};

            if (node.members && node.members.length > 0) {
                node.members.map(p => {
                    isCallSignature = isCallSignature || ts.SyntaxKind[p.kind] == 'CallSignature';
                    if (isCallSignature) {

                        const arguments = getArgTypes(p.parameters, srcFile);

                        callSignatureMembers = {
                            arguments,
                            returnType: formatNode(p.type, srcFile),
                        }
                    } else {
                        const propName = formatNode(p, srcFile, true);
                        const propType = formatNode(p.type, srcFile);
                        members[propName] = propType;
                        const doc = getJsDoc(p);
                        if (doc) {
                            docs[propName] = getJsDoc(p);
                        }
                    }

                });

                if (isCallSignature && node.members.length > 1) {
                    throw new Error('Have a callSignature interface with more than one member! We were not expecting this to be possible!');
                }
            }
            if (isCallSignature) {
                iLookup[name] = {
                    meta: { isCallSignature },
                    type: callSignatureMembers
                }
            } else {
                let meta = {};
                iLookup[name] = { meta, type: members, docs: Object.entries(docs).length > 0 ? docs : undefined }
            }

            if (node.typeParameters) {
                const orig = iLookup[name];
                iLookup[name] = { ...orig, meta: { ...orig.meta, typeParams: node.typeParameters.map(tp => formatNode(tp, srcFile)) } }
            }

            const doc = getJsDoc(node);
            if (doc) {
                const orig = iLookup[name];
                iLookup[name] = { ...orig, meta: { ...orig.meta, doc } }
            }
        }
    });
    return iLookup;
}



function getClassProperties(filePath, className) {
    const srcFile = parseFile(filePath);
    const classNode = findNode(className, srcFile, 'ClassDeclaration');

    let members = {};
    ts.forEachChild(classNode, n => {
        members = { ...members, ...extractMethodsAndPropsFromNode(n, srcFile) }
    });

    return members;
}

/** Build the interface file in the format that can be used by <interface-documentation> */
function buildInterfaceProps() {
    const interfaceFiles = glob.sync('../../../community-modules/core/src/ts/**/**.ts');

    let interfaces = {};
    let extensions = {};
    interfaceFiles.forEach(file => {
        const parsedFile = parseFile(file);

        // Using this method to build the extensions lookup required to get inheritance correct
        extractInterfaces(parsedFile, extensions);

        const interfacesInFile = findAllInNodesTree(parsedFile);
        interfacesInFile.forEach(iNode => {
            let props = {};
            iNode.forEachChild(ch => {
                const prop = extractTypesFromNode(ch, parsedFile, true);
                props = { ...props, ...prop }
            })

            if (iNode.typeParameters) {
                props = { ...props, meta: { ...props.meta, typeParams: iNode.typeParameters.map(tp => formatNode(tp, parsedFile)) } }
            }

            const iName = formatNode(iNode.name, parsedFile, true);
            interfaces[iName] = props;
        })
    });

    applyInheritance(extensions, interfaces, true);

    return interfaces;
}

function hasPublicModifier(node) {
    if (node.modifiers) {
        return node.modifiers.some(m => ts.SyntaxKind[m.kind] == 'PublicKeyword')
    }
    return false;
}

function extractMethodsAndPropsFromNode(node, srcFile) {
    let nodeMembers = {};
    const kind = ts.SyntaxKind[node.kind];
    let name = node && node.name && node.name.escapedText;
    let returnType = node && node.type && node.type.getFullText().trim();


    if (!hasPublicModifier(node)) {
        return nodeMembers;
    }

    if (kind == 'MethodDeclaration') {
        const methodArgs = getArgTypes(node.parameters, srcFile);

        nodeMembers[name] = {
            description: getJsDoc(node),
            type: { arguments: methodArgs, returnType }
        };
    } else if (kind == 'PropertyDeclaration') {

        nodeMembers[name] = {
            description: getJsDoc(node),
            type: { returnType: returnType }
        }
    }
    return nodeMembers;
}

function writeFormattedFile(dir, filename, data) {
    const fullPath = dir + filename;
    fs.writeFileSync(fullPath, JSON.stringify(data));
    gulp.src(fullPath)
        .pipe(prettier({}))
        .pipe(gulp.dest(dir))
}

function getGridOptions() {
    const gridOpsFile = "../../../community-modules/core/src/ts/entities/gridOptions.ts";
    const srcFile = parseFile(gridOpsFile);
    const gridOptionsNode = findNode('GridOptions', srcFile);

    let gridOpsMembers = {};
    ts.forEachChild(gridOptionsNode, n => {
        gridOpsMembers = { ...gridOpsMembers, ...extractTypesFromNode(n, srcFile, false) }
    });

    return gridOpsMembers;
}

function getColumnOptions() {
    const file = "../../../community-modules/core/src/ts/entities/colDef.ts";
    const srcFile = parseFile(file);
    const abstractColDefNode = findNode('AbstractColDef', srcFile);
    const colGroupDefNode = findNode('ColGroupDef', srcFile);
    const colDefNode = findNode('ColDef', srcFile);
    const filterFile = "../../../community-modules/core/src/ts/interfaces/iFilter.ts";
    const srcFilterFile = parseFile(filterFile);
    const filterNode = findNode('IFilterDef', srcFilterFile);

    let members = {};
    const addToMembers = (node, src) => {
        ts.forEachChild(node, n => {
            members = { ...members, ...extractTypesFromNode(n, src, false) }
        });
    }
    addToMembers(abstractColDefNode, srcFile);
    addToMembers(colGroupDefNode, srcFile);
    addToMembers(colDefNode, srcFile);
    addToMembers(filterNode, srcFilterFile);

    return members;
}

function getGridApi() {
    const gridApiFile = "../../../community-modules/core/src/ts/gridApi.ts";
    return getClassProperties(gridApiFile, 'GridApi');
}
function getColumnApi() {
    const colApiFile = "../../../community-modules/core/src/ts/columns/columnApi.ts";
    return getClassProperties(colApiFile, 'ColumnApi');
}
function getRowNode() {
    const file = "../../../community-modules/core/src/ts/entities/rowNode.ts";
    return getClassProperties(file, 'RowNode');
}
function getColumn() {
    const file = "../../../community-modules/core/src/ts/entities/column.ts";
    return getClassProperties(file, 'Column');
}

const generateMetaFiles = () => {
    writeFormattedFile('./doc-pages/grid-api/', 'grid-options.AUTO.json', getGridOptions());
    writeFormattedFile('./doc-pages/grid-api/', 'interfaces.AUTO.json', getInterfaces());
    writeFormattedFile('./doc-pages/grid-api/', 'grid-api.AUTO.json', getGridApi());
    writeFormattedFile('./doc-pages/row-object/', 'row-node.AUTO.json', getRowNode());
    writeFormattedFile('./doc-pages/column-properties/', 'column-options.AUTO.json', getColumnOptions());
    writeFormattedFile('./doc-pages/column-api/', 'column-api.AUTO.json', getColumnApi());
    writeFormattedFile('./doc-pages/column-object/', 'column.AUTO.json', getColumn());
    writeFormattedFile('./doc-pages/grid-api/', 'doc-interfaces.AUTO.json', buildInterfaceProps());
};

console.log(`--------------------------------------------------------------------------------`);
console.log(`Generate docs reference files...`);
console.log('Using Typescript version: ', ts.version)

generateMetaFiles()

console.log(`Generated OK.`);
console.log(`--------------------------------------------------------------------------------`);


