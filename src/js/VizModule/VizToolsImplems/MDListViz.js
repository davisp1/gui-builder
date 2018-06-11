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
 * MDListViz.
 * Display the metadata just computed by the QualityStats calculator
 *
 * @constructor
 * @param {string} container ID of the injected div
 * @param {Object} data Key contains the TSUID, sub-key contains metadata name, sub-key value is the associated value
 * @param {Array} callbacks list of the callbacks used by Viz
 *  should contains :   - a reference to the input dsname as ['inputs']
 */
class MDListViz extends VizTool {
    constructor(container, data, callbacks) {
        // Call super-class constructor
        super(container, data, callbacks);
        this.name = "MD List";

        // List of duet metadata name / type
        this.mdTypes = null;

        // Need inputs for the Functional Id associated to the TSUID
        this.ts_list = callbacks.inputs.ts_list;
    }

    /**
     * Request to display
     */
    display() {
        const self = this;

        // Display a short loading page
        d3.select("#" + self.container)
            .attr("class", "table-responsive")
            .html("Loading");

        // Get the types of the metadata to know how to display information
        ikats.api.md.types({
            async: true,
            success: function (results) {
                self.mdTypes = results.data;
                // Once retrieved, draw the viztool
                self.draw();
            },
            error: function () {
                console.error("Can't get metadata types");
            }
        });
    }


    /**
     * Wake up (Restore) the VizTool.
     */
    wakeUp() {
        this.draw();
    }


    /**
     * Draw the viztool content
     */
    draw() {

        // 'this' keyword depends on context. Using 'self' allows to avoid this specific behaviour
        const self = this;

        // Build table
        d3.select("#" + self.container)
            .attr("class", "table-responsive")
            .html("");

        const table = d3.select("#" + self.container)
            .append("table")
            .attr("class", "table table-striped table-bordered table-hover table-condensed");

        // TSUIDS represents all TSUIDS found in results
        const TSUIDS = Object.keys(self.data);

        // Get unique meta data name list
        let mdToHandle = [];
        TSUIDS.forEach(function (tsuid) {
            mdToHandle = mdToHandle.concat(Object.keys(self.data[tsuid]));
        });
        mdToHandle = uniq(mdToHandle).sort();

        // Build Header line
        const first_tr = table.append("thead").append("tr");
        ["TS"].concat(mdToHandle).forEach(function (md) {
            first_tr.append("th").text(md);
        });

        // Build 1st column (Functional Id)
        const tr = table.append("tbody").selectAll("tr")
            .data(TSUIDS).enter()
            .append("tr");
        tr.append("th")
            .style("cursor", "pointer")
            .text(d => fidFromTSList(self.callbacks.inputs.ts_list, d))
            // A click on the cell will trigger the Curve VizTool
            .on("click", function (d) {
                self.addViz("Curve", $.grep(self.callbacks.inputs.ts_list, x => x.tsuid === d));
            });

        // Build the content (metadata)
        mdToHandle.forEach(function (md) {
            tr.append("td").text(function (tsuid) {
                try {
                    let value = self.data[tsuid][md];
                    // Choose right representation depending on metadata type
                    switch (self.mdTypes[md]) {
                        case "date":
                            value = new Date(parseInt(value)).toISOString();
                            break;
                        case "string":
                            break;
                        case "number":
                            value = parseInt(value * 1000, 10) / 1000;
                            break;
                        case "bool":
                            value = value.toString();
                            break;
                        case "complex":
                            value = JSON.stringify(value);
                            break;
                        default:
                            console.error("Meta Not handled", md, self.mdTypes[md]);
                            value = self.data[tsuid][md];
                    }
                    return value;
                }
                catch (e) {
                    // Error management that should never occurs
                    console.error(`Something went wrong while getting metadata ${md} for TS ${tsuid}`, e);
                    return "-";
                }
            });
        });
    }
}
