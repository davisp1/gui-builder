/**
 * Copyright 2018 CS Systèmes d'Information
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * Unordered library of all available VizTools
 * should list object of format :
 * {
 *  name:'name', - name of the VizTool
 *  types:['type1','type2','type3'], - list of compatible data types
 *  classRef:Class - ClassName of the implementation of VizTool
 *  context:['specific_context_1','specific_context_2'] - The list of contextual data to grant the file access to (Only 'inputs' and 'parameters' are currently supported)
 *  debugModeOnly:bool, - Define if the viztool is only available in Debug mode (true) or not (false)
 *  keyMap:{"key1":"def of action 1","key2":"def of action 2","mouseEvt1":"def of action 3"}, - Dictionnary of "event":"action description"
 *  desc:'description', - textual description of VizTool
 * }
 * @file
 * @type {Array}
 */
VizToolsLibrary = [{
    name: "Raw",
    types: [],
    classRef: RawViz,
    keyMap: {},
    desc: "Displays raw information",
    debugModeOnly: true
}, {
    name: "TsTable",
    types: ["ts_list"],
    classRef: TsTable,
    keyMap: {
        "click": "Execute action for selected line"
    },
    desc: "Show content of ts_list and permits to visualize each one."
}, {
    name: "Tsuid",
    types: ["ts_list", "ts"],
    classRef: TsuidViz,
    desc: "!!DEBUG PURPOSE ESSENTIALLY!! Show internal data identifier (TSUID)",
    debugModeOnly: true
}, {
    name: "Text",
    types: ["dot", "text", "ds_name", "table"],
    classRef: TextViz,
    desc: "Display the text contained in the output"
}, {
    name: "SAX",
    types: ["SAX_result"],
    classRef: SaxViz,
    context: ["inputs"],
    keyMap: {
        "mouse hover": "tooltip the value of a point"
    },
    desc: "Displays a SAX result"
}, {
    name: "MDList",
    types: ["md_list"],
    classRef: MDListViz,
    context: ["inputs"],
    desc: "Permits showing Metadata set in a table"
}, {
    name: "MDEdit",
    types: ["ts_list"],
    classRef: MDEditViz,
    keyMap: {
        "click": "Execute action on current line (update or deletion)"
    },
    desc: "Permits visualizing and editing metadata for a list of time series"
}, {
    name: "pattern",
    types: ["pattern"],
    classRef: patternViz,
    keyMap: {
        "drag": "Zoom on an area (may be vertical or horizontal)",
        "shift + drag": "Pan",
        "double click": "Reset zoom"
    },
    desc: "Shows the result of a pattern matching over a time series"
}, {
    name: "random_projection",
    types: ["pattern_groups"],
    classRef: randomProjectionViz,
    keyMap: {
        "drag": "Zoom on an area (may be vertical or horizontal)",
        "shift + drag": "Pan",
        "double click": "Reset zoom"
    },
    desc: "Shows the result of a pattern matching over a time series"
}, {
    name: "Curve",
    types: ["ts_list", "ts_bucket"],
    classRef: D3Curve,
    keyMap: {
        "drag": "Zoom on an area (may be vertical or horizontal)",
        "shift + drag": "Pan",
        "double click": "Reset zoom",
        "click on legend": "Toggle on/off a curve display"
    },
    desc: "Plot one or several time series"
}, {
    name: "ScatterPlot",
    types: ["ts_list", "tsuid_list"],
    classRef: ScatterPlot,
    keyMap: {},
    desc: "Display TS1 vs TS2 (scatterplot or X/Y) for 2 TS"
}, {
    name: "D3CurveNonTemporal",
    types: ["correlation_by_context"],
    classRef: D3CurveNonTemporal,
    keyMap: {
        "click": "Display scatterplot about the 2 TS corresponding to this point"
    },
    desc: "Plot a non temporal series"
}, {
    name: "Correlation matrix",
    types: ["correlation_dataset"],
    classRef: correlLoop,
    keyMap: {
        "drag": "Zoom on a rectangular area",
        "double click": "Reset zoom",
        "hover": "Show data tooltip",
        "click": "focus on a couple of variables"
    },
    desc: "Displays the correlation coefficient between couples of variables"
}, {
    name: "Table",
    types: ["table"],
    classRef: Table,
    keyMap: {
        "double click": "Double Click on a row header, a column header or a cell to explore its linked content -when defined-, in a deeper view. When a link exists the mouse pointer is changed",
        "drag": "Drag header column separators to change the column size."
    },
    desc: "Display a table whose sub-parts can be explored by clicking on them."
}, {
    name: "Percentage",
    types: ["percentage", "number"],
    classRef: PercentViz,
    keyMap: {},
    desc: "Display numbers as percentage bar."
}, {
    name: "Clusters",
    types: ["kmeans_mds"],
    classRef: ClustersViz,
    keyMap: {
        "hover": "Show data tooltip",
        "click": "display curve of corresponding time series"
    },
    desc: "Displays a scatterplot with clusters identified by a centroid and a specific color"
},
    // Contributions
    // inject:json
    // endinject
];
