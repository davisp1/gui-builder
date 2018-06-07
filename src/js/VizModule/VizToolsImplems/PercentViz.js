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
 * Viztool displaying the percentage information as progress bar.
 *
 * @constructor
 * @param {string} container - the ID of the injected div
 * @param {Object} data - the data used in the visualization
 * @param {Array} callbacks - the list of the callbacks used by Viz
 */
class PercentViz extends VizTool {
    constructor(container, data, callbacks) {
        // Call super-class constructor
        super(container, data, callbacks);
        this.name = "Percentage";
    }

    /**
     * Init the VizTool : collect and format the data (if necessary) then render the VizTool
     */
    display() {
        const self = this;

        if (typeof(self.data) !== "number") {
            console.error(self.data + " is not a number");
        }

        d3.select(`#${self.container}`).html("");

        // Display value
        let divValue = d3.select(`#${self.container}`).append("h2").style("margin-top","25px");
        divValue.html((self.data * 100).toFixed(2) + "%");

        // Display progress bar
        let divProgress = d3.select(`#${self.container}`).append("div");
        divProgress.attr("class", "progress")
            .style("width", "100%");
        let divBar = divProgress.append("div");
        divBar.attr("class", "progress-bar progress-bar-striped")
            .attr("role", "progressbar")
            .attr("aria-valuemin", 0)
            .attr("aria-valuemax", 1)
            .attr("aria-valuenow", self.data)
            .style("width", (self.data * 100) + "%");

        // Data greater than 100%
        if (self.data > 1) {
            // Set bar to red color + animated
            divBar.attr("class", "progress-bar progress-bar-danger progress-bar-striped active");
        }
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
