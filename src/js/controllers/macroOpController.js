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
 * @file Defines Macro-operators/custom-operators controller
 */

/**
 * Controller handling macro-operators and custom-operators aspects : lists them and permits CRUD on them
 * @class IKATS_GUI.Controllers.MacroOpController
 * @memberOf IKATS_GUI.Controllers
 */
angular.module("ikatsapp.controllers").controller("MacroOpController", ["toastr", "$scope", function (toastr, $scope) {

    const self = this;

    self.data = [];

    /**
     * Refresh the binds (used after async requests)
     */
    $scope.refresh = function () {
        if ($scope.$$phase !== "$apply" && $scope.$$phase !== "$digest") {
            $scope.$apply();
        }
    };

    // Trick to allow creation of macro operators using Angular ng-repeat
    self.groups = ["My Operators"];

    /**
     * Permits compatibility of refresh function outside of controller
     * (Refresh the binds (used after async requests))
     *
     * @alias refresh
     * @memberOf IKATS_GUI.Controllers.MacroOpController
     * @type {function}
     */
    self.refresh = $scope.refresh;

    /**
     * Saves the selection as macro operator in backend
     *
     * @alias saveSelection
     * @memberOf IKATS_GUI.Controllers.MacroOpController
     * @param {IKATS_GUI.Controllers.WorkflowController} wf workflow controller reference
     */
    self.saveSelection = function (wf) {
        let selection = wf.getSelection();
        let best_dist = Number.MAX_VALUE;
        let transform_coordinates = null;
        // if there is no selection, just abort
        if (selection.nodes.length < 1) {
            return;
        }

        // Verify if saving a macro operator or just a customized op (same treatment, just human readability)
        let mode = "macro";
        if (wf.getSelection().nodes.length === 1) {
            mode = "custom";
        }
        if (!wf.selectionName || wf.selectionName === "") {
            toastr.error("You need to input a name for your " + mode + " operator", "Impossible to save new Operator");
            return;
        }

        selection.nodes.forEach(function (node) {
            // Select "master" node (the one which will be driving the drag and drop),
            // should be the operator the most top left
            const cur_dist = Math.abs(node.x) + Math.abs(node.y);
            if (cur_dist < best_dist) {
                best_dist = cur_dist;
                transform_coordinates = [-node.x, -node.y];
            }

            // Save the operator to a minimal state (not useful to keep trace of every attribute)
            $.each(node.op_info.outputs, function (index, output) {
                delete output.value;
                delete output.rid;
            });
            node.op_info._progress = 100;
            node.op_info._state = OP_STATES.idle;
            delete node.op_info.lastStart;
            delete node.op_info.lastStartLocal;
            delete node.op_info.duration;
            delete node.op_info.pid;
        });

        selection.nodes.forEach(function (node) {
            // Transform every coordinates relatively to "master" node
            node.x += transform_coordinates[0];
            node.y += transform_coordinates[1];
        });

        // Converts to a string
        selection = angular.toJson(selection);

        ikats.api.mo.save({
            async: true,
            name: wf.selectionName,
            description: wf.selectionDesc || "",
            data: selection,
            id: null,
            success: function () {
                toastr.success(mode + " operator " + wf.selectionName + " saved", " Added operator");
                // Reset name :
                wf.selectionName = null;
                wf.selectionDesc = null;
                // Update HMI to take in account new OP
                self.list();

                // Dismiss eventual Modal
                $(".modal").modal("hide");
            },
            error: function () {
                toastr.error("Error occurred while saving " + mode + "-operator " + wf.selectionName);
            }
        });
    };

    /**
     * List the available macro and custom OPs
     *
     * @alias list
     * @memberOf IKATS_GUI.Controllers.MacroOpController
     */
    self.list = function () {
        ikats.api.mo.list({
            async: true,
            success: function (result) {
                self.data = result.data;
                self.refresh();
            },
            error: function () {
                toastr.error("Error occurred while listing macro operators");
            }
        });
    };

    /**
     * Method to prepare a macro for deletion
     *
     * @alias confirmDel
     * @memberOf IKATS_GUI.Controllers.MacroOpController
     * @param {{}} macro descriptor of the macro operator to delete
     */
    self.confirmDel = function (macro) {
        self.macroToDelete = macro;
    };

    /**
     * Method to delete a MO
     *
     * @alias del
     * @memberOf IKATS_GUI.Controllers.MacroOpController
     */
    self.del = function () {
        ikats.api.mo.del({
            async: true,
            id: self.macroToDelete.id,
            success: function () {
                toastr.info("Macro operator deleted");
                self.list();
            },
            error: function () {
                toastr.error("Impossible to delete Macro operator", "Error");
            }
        });
    };

}]);
