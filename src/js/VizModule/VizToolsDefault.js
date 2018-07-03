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

// Define default VizTool name to suggest to the user for each handled type
VizToolsDefault = {
    "ts_list": "TsTable",
    "ds_name": "Text",
    "tsuid_list": "TsTable",
    "pattern": "pattern",
    "randproj": "random_projection",
    "md_list": "MDList",
    "text": "Text",
    "percentage": "Percentage",
    "correlation_by_context": "D3CurveNonTemporal",
    "table": "Table",
    "correlation_dataset": "Correlation matrix",
    "ts_bucket": "Curve",
    "SAX_result": "SAX",
    "kmeans_mds": "Clusters"
};

/**
 * Returns the default viztool fo a given functional type
 * @param type the functional type to get default viztool from
 * @returns {*}
 */
const getDefaultVizTool = function (type) {
    let viztoolName = VizToolsDefault[type];
    if (!viztoolName) {
        let VTcandidates = VizToolsLibrary.filter(function (vt) {
            return (vt.types.indexOf(type) !== -1 ||
                (!vt.types.length && (!vt.debugModeOnly || window.CURRENT_IKATS_MODE === IKATS_MODES.DEBUG)));
        });
        if (VTcandidates.length) {
            return VTcandidates[0];
        } else {
            return null;
        }
    }
    return VizToolsLibrary.filter(function (vt) {
        return vt.name === viztoolName;
    })[0];
};