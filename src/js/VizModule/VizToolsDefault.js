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
    "correlation_by_context": "D3CurveNonTemporal",
    "correlation_dataset": "Correlation matrix",
    "ds_name": "Text",
    "kmeans_mds": "Clusters",
    "md_list": "MDList",
    "pattern": "pattern",
    "percentage": "Percentage",
    "randproj": "random_projection",
    "SAX_result": "SAX",
    "table": "Table",
    "tdt": "Text",
    "text": "Text",
    "ts_bucket": "Curve",
    "ts_list": "TsTable",
    "tsuid_list": "TsTable"
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
