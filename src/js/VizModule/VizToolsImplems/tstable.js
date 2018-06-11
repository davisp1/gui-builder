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
 * A VizTool permitting to list the funcIDs and to grant the user options to focus, plot and show tsuid.
 *
 * @constructor
 * @param {string} container - the ID of the injected div
 * @param {Object} data - the data used in the visualization
 *                  Contains : {Array} a list of couples {"tsuid":"XX","funcId":"XX"}
 * @param {Object} callbacks - Dictionary of the callbacks available
 *                  Contains : engine - the parent engine instance
 */

class TsTable extends VizTool {
    constructor(container, data, callbacks) {
        super(container, data, callbacks);
        this.name = "TsTable";
    }

    /**
     * Display function : render the table
     */
    display() {
        $("#" + this.container).append(`<div class="row" style="border:2px solid #ccc"><div class="col-xs-5"><h4>FuncIds(s)</h4></div></div>`);

        const self = this;
        this.data.forEach(function (ts) {
            $("#" + self.container).append(
                `<div class="row" style="border:1px solid #ccc"><div class="col-xs-4">` + ts.funcId + `</div>` +
                `<div id="tsshow` + ts.tsuid +
                `" class="col-xs-1"><span class="badge"><span class="glyphicon glyphicon-eye-open"/> Visualize </span></div>` +
                `<div id="tsfocus` + ts.tsuid +
                `" class="col-xs-1"><span class="badge"><span class="glyphicon glyphicon-play-circle"/> Focus on</span></div>` +
                `<div id="tstsuid` + ts.tsuid +
                `" class="col-xs-1"><span class="badge"> SeeTSUID </span></div></div></div>`);
            $("#tsshow" + ts.tsuid).click(function () {
                self.addViz("Curve", [ts]);
            });
            $("#tsfocus" + ts.tsuid).click(function () {
                self.addViz("TsTable", [ts]);
            });
            $("#tstsuid" + ts.tsuid).click(function () {
                self.addViz("Tsuid", [ts]);
            });
        });
    }

    /**
     * Redraw the table after being woken up
     */
    wakeUp() {
        this.display();
    }

}
