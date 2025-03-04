interface MetaTag {
    displayName: string;
    description: string;
    page: {
        url: string;
        name: string;
    };
    type?: string;
    isEvent?: boolean;
}
export type DocEntryMap = {
    meta?: MetaTag;
} & {
        [key in string]: DocEntry | ChildDocEntry;
    };
type DocEntry = {
    meta?: MetaTag;
    relevantTo?: never;
    options?: never;
    more?: never;
    type?: never;
} & {
    [key: string]: DocEntryMap | ChildDocEntry;
};
export interface PropertyType {
    parameters?: {
        [key in string]: string;
    };
    arguments?: {
        [key in string]: string;
    };
    returnType?: string;
}
interface ChildDocEntry {
    meta?: never;
    relevantTo?: string[];
    more?: {
        name: string;
        url: string;
    };
    description?: string;
    isRequired?: boolean;
    strikeThrough?: boolean;
    options?: string[];
    default?: string;
    type: PropertyType | string;
}
export interface ObjectCode {
    framework?: string;
    id?: string;
    breadcrumbs?: {
        [key in string]: string;
    };
    properties: DocEntryMap;
}
interface CodeEntry {
    description?: string;
    type: PropertyType;
}
export type InterfaceEntry = IEntry | ICallSignature | ITypeAlias | IEnum | IEvent;

interface BaseInterface {
    description?: string;
}

export interface IEvent extends BaseInterface {
    meta: {
        isTypeAlias?: never;
        isEnum?: never;
        isCallSignature?: never;
        isEvent: true;
    };
    name: string;
    type?: never;
}
interface IEntry extends BaseInterface {
    meta: {
        isTypeAlias?: never;
        isEnum?: never;
        isCallSignature?: never;
        isEvent?: never;
    };
    type: {
        [key in string]: string;
    };
}
interface IEnum extends BaseInterface {
    meta: {
        isTypeAlias?: never;
        isEnum: true;
        isCallSignature?: never;
        isEvent?: never;
    };
    type: string[];
}
interface ITypeAlias extends BaseInterface {
    meta: {
        isTypeAlias: true;
        isEnum?: never;
        isCallSignature?: never;
        isEvent?: never;
    };
    type: string;
}
export interface ICallSignature extends BaseInterface {
    meta: {
        isTypeAlias?: never;
        isEnum?: never;
        isCallSignature: true;
        isEvent?: never;
    };
    type: {
        arguments: {
            [key in string]: string;
        };
        returnType: string;
    };
}
export interface Config {
    isSubset?: boolean;
    isApi?: boolean;
    isEvent?: boolean;
    showSnippets?: boolean;
    lookups?: {
        codeLookup: {
            [key: string]: CodeEntry;
        };
        interfaces: {
            [key: string]: InterfaceEntry;
        };
    };
    codeSrcProvided: string[];
    gridOpProp?: InterfaceEntry;
    /**
     * Just show the code interfaces without the table entry
     */
    codeOnly?: boolean;
    /**
     * Can be used to have the doc entries expanded by default.
     */
    defaultExpand?: boolean;
    /**
     * By default we do not include the "See More" links when api-documentation is used with specific names selected.
     * This is because it is likely the link will be pointing to the same place it is currently being used.
     */
    hideMore?: boolean;
    /**
     * Hide the header to make it easy to just include the sections as part of doc pages
     */
    hideHeader?: boolean;
    /** Set the margin-bottom value to override the default of 3em */
    overrideBottomMargin?: string;
}
export type SectionProps = {
    framework: string;
    title: string;
    properties: DocEntryMap | DocEntry | ChildDocEntry;
    config: Config;
    breadcrumbs?: {
        [key in string]: string;
    };
    names?: string[];
};
export type PropertyCall = {
    framework: string;
    id: string;
    name: string;
    definition: DocEntry | ChildDocEntry;
    config: Config;
};
export type FunctionCode = {
    framework: string;
    name: string;
    type: PropertyType | string;
    config: Config;
};
export interface ApiProps {
    pageName?: string;
    framework?: string;
    source?: string;
    sources?: string[];
    section?: string;
    names?: string;
    config?: Config;
}
