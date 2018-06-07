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
 * A component displayed by a VizEngine.
 *
 * @constructor
 * @param {string} container - the ID of the injected div
 * @param {Object} data - the data used in the visualization
 * @param {Object} callbacks - Dictionary of the callbacks available
 *                  Contains : engine - the parent engine instance
 */

// Abstract class
class VizTool {
    constructor(container, data, callbacks) {
        // Avoid abstract instance
        if (new.target === VizTool) {
            throw new TypeError("Cannot construct Abstract instances directly");
        }
        this.name="";
        this.data = data;
        this.container = container;
        this.callbacks = callbacks;
    }

    /**
     * Init a VizTool : collect and format the data (if necessary) then render the VizTool
     */
    display() {
        throw new Error("display method of VizTool " + this.name + " has to be overridden");
    }

    /**
     * Wake up (Restore) the VizTool with minimal recalculation.
     */
    wakeUp() {
        throw new Error("wakeUp method of VizTool " + this.name + " has to be overridden");
    }

    /**
     * Persist the VizTool for a quick restoration.
     */
    sleep() {
        // If actions must be performed before hiding a viztool, there shall be done here
        // Example: remove pending requests, kill timers, ...
    }

    /**
     * Common callback to add a Viz to parent VizEngine
     * @param {string} name - the name of the VizTool to add
     * @param {*} data - the data used by the added VizTool
     */
    addViz(name, data) {
        this.callbacks.engine.addViz(name, data, false);
    }
}
