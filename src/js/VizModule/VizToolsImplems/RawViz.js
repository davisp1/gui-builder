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
 * Viztool displaying the raw information used by other viztool.
 * This viztool is generic to any type of data to display.
 *
 * @constructor
 * @param {string} container - the ID of the injected div
 * @param {Object} data - the data used in the visualization
 * @param {Array} callbacks - the list of the callbacks used by Viz
 */
class RawViz extends VizTool {
    constructor(container, data, callbacks) {
        // Call super-class constructor
        super(container, data, callbacks);
        this.name = "Raw";
    }

    /**
     * Init the VizTool : collect and format the data (if necessary) then render the VizTool
     */
    display() {
        const self = this;

        let btn = d3.select(`#${self.container}`).append("button");
        let div = d3.select(`#${self.container}`).append("pre");

        btn.html("Copy to clipboard")
            .attr("class", "btn")
            .on("click", function () {
                copyToClipboard(div);
            });

        let msg = null;
        try {
            // Render JSON if JSON parseable
            msg = JSON.stringify(self.data, null, 4);
        }
        catch (e) {
            // Not a JSON, display raw text
            msg = self.data;
        }

        div.html(msg);
    }

    /**
     * Wake up (Restore) the VizTool.
     */
    wakeUp() {
        const self = this;
        self.display();
    }

    /**
     * Persist the VizTool for a quick restoration.
     */
    sleep() {
        // Useless in this case => do nothing
    }

}
