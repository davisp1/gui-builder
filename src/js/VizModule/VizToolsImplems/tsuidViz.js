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
 * A VizTool permitting to show tsuids for each ts given
 *
 * @constructor
 * @param {string} container - the ID of the injected div
 * @param {Array} data - the data used in the visualization (Array of time series)
 *                  Contains : Array of objects containing :
 *                              {String} tsuid - the tsuid of a time series
 * @param {Object} callbacks - Dictionary of the callbacks available
 *                  Contains : engine - the parent engine instance
 */
class TsuidViz extends VizTool {
    constructor(container, data, callbacks) {
        // Call super-class constructor
        super(container, data, callbacks);
        this.name = "Tsuid";
    }

    /**
     * Init the VizTool : collect and format the data (if necessary) then render the VizTool
     */
    display() {
        const self = this;
        this.data.forEach(function (d) {
            $("#" + self.container).append("<h1>TSUID = " + d.tsuid + "</h1>");
        });
    }

    /**
     * Wake up (Restore) the VizTool.
     */
    wakeUp() {
        this.display();
    }
}
