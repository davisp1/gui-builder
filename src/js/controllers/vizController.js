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
 * @file Defines Visualization controller
 */

/**
 * Controller handling visualization purposes : management of VizEngine and VizTools.
 * @class ikats_HMI.Controllers.VizController
 * @memberOf ikats_HMI.Controllers
 */
angular.module("ikatsapp.controllers").controller("VizController", ["toastr", "$scope", function (toastr, $scope) {

    const self = this;
    self.toastr = toastr;

    self.expanded = false;
    self.engine = new VizEngine("VizModule", self);
    self.outputViz = null;
    self.Vizmode = null;
    self.focusedNode = null;
    self.inputData = {};

    $scope.$watch(function () {
        return self.expanded;
    }, function (newval, oldval) {
        if (newval !== oldval) {
            if (newval) {
                d3.select("#viz")
                    .style("height", "100%");
                d3.select("#flowchart").style("display", "none");
            } else {
                d3.select("#viz")
                    .style("height", "0%");
                d3.select("#flowchart").style("display", "block");
            }
        }
    });

    /**
     * Checks if the operator has results to display (if any output contains data)
     *
     * @alias isVizAvailable
     * @memberOf ikats_HMI.Controllers.VizController
     * @param {ikats_HMI.Controllers.WorkflowController} wf workflow controller reference
     * @param {{}} node operator description, containing op_info
     * @returns {boolean} true if visualization should be available, false else.
     */
    self.isVizAvailable = function (wf, node) {
        self.focusedNode = wf.focusedNode;
        if (node) {
            for (let i = 0; i < node.outputConnectors.length; i++) {
                let connector = wf.chartViewModel.findOutputConnector(node.id, i).data;
                if (connector.rid || connector.value) {
                    return true;
                }
            }
            return false;
        }
        return false;
    };

    /**
     * Collect eventual input data (when input is passed by RID)
     * @param {ikats_HMI.Controllers.WorkflowController} wf workflow controller reference
     * @param {{}} node operator description, containing op_info
     */
    self.collectInputs = function (wf, node) {
        node.inputConnectors.forEach(function (x) {
            self.inputData[x.name] = wf.getSourceData(node.id, x.name);
        });
        self.outputViz = wf.focusedNode.data.outputConnectors[0];
        self.VizMode = self.suggestVizTool(self.outputViz.type);
        self.loadVT(wf);
    };

    /**
     * Permits suggesting a vizTool according to an output
     * @param type the ikats functional type used for suggesting VizTool
     * @returns {*} full details of the suggested VizTool
     */
    self.suggestVizTool = function (type) {
        return getDefaultVizTool(type);
    };

    /**
     * Reset VizModule state (flush VizTool stack, reset visualization modes)
     *
     * @alias resetVizStates
     * @memberOf ikats_HMI.Controllers.VizController
     */
    self.resetVizStates = function () {
        // Reset VizToolStack (bread-crumb)
        self.engine.removeFromStack(0);
        // Reset current visualized output
        self.outputViz = null;
        // Reset current bread-crumb item
        self.breadCrumbVizMode = null;
        // Reset visualization mode (selected VizTool)
        self.Vizmode = null;
    };

    /**
     * Get output data available for selected operator in wf
     *
     * @alias outputData
     * @memberOf ikats_HMI.Controllers.VizController
     * @param {ikats_HMI.Controllers.WorkflowController} wf workflow controller reference
     * @returns {*} false if no data is found, data else.
     */
    self.outputData = function (wf) {
        if (wf.focusedNode && self.outputViz && ObjFromArray(wf.focusedNode.data.outputConnectors, "name", self.outputViz.name)[0]) {
            const output = ObjFromArray(wf.focusedNode.data.outputConnectors, "name", self.outputViz.name)[0];

            if (output.rid !== null) {
                // Output contains a link to RID
                return wf.getDataFromRID(output.rid);
            }
            else {
                // Output doesn't contain a link to RID, use value field
                return output.value;
            }
        }
        else {
            return false;
        }
    };

    // Refresh the binds (used when modifying VizToolStack)
    self.refresh = function () {
        if ($scope.$$phase !== "$apply" && $scope.$$phase !== "$digest") {
            $scope.$apply();
        }
    };

    // Loads a VizTool
    self.loadVT = function (wfCtrl) {
        if (self.outputViz && self.VizMode) {
            self.engine.addViz(self.VizMode.name, self.outputData(wfCtrl), true);
        }
    };

    // Get debug mode state from global configuration
    self.isDebugModeActivated = function () {
        return window.CURRENT_IKATS_MODE === IKATS_MODES.DEBUG;
    };

    /**
     * VizTool part of the scope : regroup helpers to get information over viztools implementations
     *
     * @alias viztool
     * @memberOf ikats_HMI.Controllers.VizController
     * @type {Object}
     */
    self.viztool = {
        curInfos: {},
        getInfos: function (name) {
            if (name) {
                self.viztool.curInfos.desc = self.engine.getDesc(name);
                self.viztool.curInfos.ctrls = self.engine.getCtrls(name);
            }
        }
    };
}]);
