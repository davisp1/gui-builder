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
 * A template to use to add a new VizTool.
 *
 * @constructor
 * @param {string} container - the ID of the injected div
 * @param {Object} data - the data used in the visualization
 * @param {Array} callbacks - the list of the callbacks used by Viz
 */
class ExampleTemplate extends VizTool {
    constructor(container, data, callbacks) {
        // Call super-class constructor
        super(container, data, callbacks);
        this.name = "ExampleName";
        // Custom construction (optional - example : collecting callbacks to variables)
    }

    /**
     * Init the VizTool : collect and format the data (if necessary) then render the VizTool
     */
    display() {
        // Please fill this part (mandatory)
    }

    /**
     * Wake up (Restore) the VizTool.
     */
    wakeUp() {
        // Please fill this part (mandatory)
    }

    /**
     * Persist the VizTool for a quick restoration.
     */
    sleep() {
        // Please fill this part (optional)
    }

}
