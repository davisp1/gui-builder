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
 * VizEngine, a component permitting to display VizTools.
 * @file
 * @namespace
 * @constructor
 * @param {string} container - The id of the container DOM element.
 * @param {Object} scope - the angular scope of the parent controller
 *
 * @property {Array} vizToolsStack - Stack containing a session of VizTools
 * @property {VizTool} vt - Current displayed VizTool
 */
class VizEngine {
    constructor(container, scope) {
        // Id of the DOM container of the visualization
        this.container = container;
        // Data scope of the VizEngine caller
        this.scope = scope;
        // Stack containing the active (on top) and all the stacked sleeping ToolViz
        this.vizToolsStack = [];
        // Current opened viztool reference
        this.vt = null;
        // Current opened Viztool index into breadcrumb (VizToolsStack)
        this.currentVtIndex = 0;
    }

    /**
     * Display the last VizTool of the stack
     *
     * @param {int} index - the index of the vizToolsStack to show
     * @param {boolean=} firstDisplay - true if the VizTool should display (for the first time), false or undefined if it should only wake-up
     */
    show(index, firstDisplay) {
        if (this.vt !== null) {
            this.vt.sleep();
            $("#" + this.container + "Content").html("");
        }
        this.vt = this.vizToolsStack[index];
        this.currentVtIndex = index;
        this.scope.breadCrumbVizMode = this.vt.instanceName;
        if (firstDisplay) {
            this.vt.display();
        } else {
            this.vt.wakeUp();
        }

        if (this.scope && this.scope.refresh) {
            this.scope.refresh();
        }
    }

    /**
     * Helper - Permits to know which VizTools are available to display a type of data
     *
     * @param {string} type - the type of the data
     * @return {Array} available VizTools
     */
    getAvailableVizTools(type) {
        let avt = [];
        VizToolsLibrary.forEach(function (viztool) {
            if ((viztool.types.includes(type) || !viztool.types.length) &&
                (!viztool.debugModeOnly || window.CURRENT_IKATS_MODE === IKATS_MODES.DEBUG)
            ) {
                avt.push(viztool);
            }
        });
        return avt;
    }

    /**
     * Add a new VizTool and refresh view
     *
     * @param {string} VizName - the name of the VizTool to add
     * @param {Object} data - the data needed by the viztool
     * @param {boolean} newContext -  force the VizTool to open in a new context (reset VizToolsStack)
     */
    addViz(VizName, data, newContext) {
        if (VizName !== undefined) {
            // In case of new context, we flush the vizToolsStack
            if (newContext) {
                // Properly kill current viztools
                if (this.vt !== null) {
                    this.vt.sleep();
                }
                this.vizToolsStack = [];
            } else {
                this.vizToolsStack = this.vizToolsStack.splice(0, this.currentVtIndex +
                    1);
            }
            let viz = null;

            // Find the corresponding VizTool object
            for (let i = 0; i < VizToolsLibrary.length; i++) {
                if (VizToolsLibrary[i].name === VizName) {
                    viz = VizToolsLibrary[i];
                }
            }
            if (viz === null) {
                $("#" + this.container + "Content").html("");
            }

            // Build the callback object
            const callbacks = {};
            callbacks.engine = this;
            callbacks.toastr = this.scope.toastr;
            if (viz.context && viz.context.includes("inputs")) {
                callbacks.inputs = JSON.parse(JSON.stringify(this.scope.inputData));
            }
            if (viz.context && viz.context.includes("parameters")) {
                callbacks.parameters = this.scope.focusedNode.data.op_info.parameters
                    .map((p) => Object.assign({}, p));
            }
            // Instantiate the VizTool
            const vtool = new viz.classRef(this.container + "Content", data,
                callbacks);
            vtool.instanceName = VizName;
            this.vizToolsStack.push(vtool);

            this.show(this.vizToolsStack.length - 1, true);
        }
    }

    /**
     * Remove all the viztools equals and after a given viztool from the VizToolsStack
     *  @param {number} index - the index from which it should remove
     */
    removeFromStack(index) {
        this.vizToolsStack = this.vizToolsStack.splice(0, index);
        if (index !== 0) {
            this.show(this.vizToolsStack.length - 1);
        } else {
            $("#" + this.container + "Content").html("");
            this.vt = null;
        }
    }

    /**
     * Get the description of a viztool contained into VizToolsLibrary
     *  @param {string} name - the name of the viztool
     */
    getDesc(name) {
        let implems = VizToolsLibrary.filter(function (vt) {
            return vt.name === name;
        });
        if (implems.length) {
            return implems[0].desc;
        }
    }

    /**
     * Get the controls of a viztool contained into VizToolsLibrary
     *  @param {string} name - the name of the viztool
     */
    getCtrls(name) {
        let implems = VizToolsLibrary.filter(function (vt) {
            return vt.name === name;
        });
        if (implems.length) {
            let keyMap = implems[0].keyMap;
            // transform keymap to an array of couples
            let result = [];
            if (keyMap) {
                Object.keys(keyMap).forEach(function (key) {
                    result.push([key, keyMap[key]]);
                });
            }
            return result;
        }
    }

}
