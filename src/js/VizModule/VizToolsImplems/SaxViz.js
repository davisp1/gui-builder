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
 * A viztool permitting to show a SAX result on one TS at a time.
 *
 * @constructor
 * @param {string} container - the ID of the injected div
 * @param {Object} data - the data used in the visualization
 *                  Contains: Object containing :
 *                            {String} ds_name - the name of the current dataset
 *                            {Arrau} ts_list - list of couples of {tsuid:XXX,funcid:XXX}
 * @param {Array} callbacks - the list of the callbacks used by Viz :
 *  should contains :   - a reference to the input dsname as ['inputs']
 */
class SaxViz extends VizTool {
    constructor(container, data, callbacks) {
        // Call super-class constructor
        super(container, data, callbacks);
        this.name = "SAX";
        // Get ds_name from callbacks
        this.data.ds_name = callbacks.inputs.ds_name;
    }

    /**
     * Init the VizTool : collect and format the data (if necessary) then render the VizTool
     */
    display() {
        const self = this;

        // Collect data :
        ikats.api.ds.read({
            "ds_name": this.data.ds_name,
            "async": true,
            "success": function (d) {
                self.data.ts_list = d.data.ts_list;
                if (d.data.ts_list.length !== 0) {
                    self.drawSelectedTs(self.data.ts_list[0].tsuid);
                } else {
                    console.error("SAX Display aborted : Trying to display an empty list of tsuids");
                }
            }
        });
    }

    /**
     * Wake up (Restore) the VizTool.
     */
    wakeUp() {
        if (this.datum !== null) {
            this.renderSax();
        }
    }

    /**
     * Function permitting to display a SAX result for a given list of tsuids
     *
     *
     */
    drawSelectedTs(tsuid) {
        const self = this;

        // Get current ts_points :
        ikats.api.ts.read({
            tsuid: tsuid,
            async: true,
            error: function (e) {
                console.error("Displaying sax for given tsuid list resulted in an error : ", e);
            },
            success: function (d) {
                self.data.raw = d;
                self.curtsuid = tsuid;
                self.current_data = self.data[tsuid];
                self.datum = {
                    rawkeys: Object.keys(self.data.raw.data).map(function (key) {
                        return parseInt(key);
                    }),
                    rawvalues: Object.keys(self.data.raw.data).map(function (key) {
                        return self.data.raw.data[key];
                    }),
                    paa: self.current_data.paa,
                    sax_breakpoints: self.current_data.sax_breakpoints,
                    sax_string: self.current_data.sax_string
                };
                self.renderSax(tsuid);
            }
        });
    }

    renderSax() {
        const self = this;
        // Set margin at the top and bot of the VizTool
        const margin_topbot = 20;

        // Set margin at right and left of the VizTool
        const margin_side = 40;

        // Set ContentBox size
        const height = 500;
        const width = 950;

        // Pre compute minimum and maximum values in data
        const maxVal = 1.1 * Math.max(...self.datum.rawvalues);
        const minVal = Math.min(...self.datum.rawvalues) - 0.1 * maxVal;

        // Sets up a D3 scale for values (will be used as vertical)
        const y = d3.scaleLinear()
            .domain([minVal, maxVal])
            .range([(height - margin_topbot), (margin_topbot)]);

        // Sets up a D3 scale for values (will be used as horizontal)
        const xVal = d3.scaleLinear()
            .domain([Math.min(...self.datum.rawkeys), Math.max(...self.datum.rawkeys)])
            .range([(margin_side), (width - margin_side)]);

        // Sets up a D3 scale for paa levels (will be used as horizontal)
        const xPAA = d3.scaleLinear()
            .domain([0, self.datum.paa.length])
            .range([(margin_side), (width - margin_side)]);

        // Uncomment these lines for an hypothetical come back of the normalized version
        /*var ynorm = d3.scaleLinear()
         .domain([-1,1])
         .range([minval,maxval]);   */

        // Function to compute the horizontal axis
        const xAxis = d3.axisBottom(xVal)
            .ticks(Math.min(5, self.datum.rawkeys.length))
            .tickFormat(function (d) {
                const date = new Date(d);
                return date.toISOString();
            });

        // Function to compute the vertical axis
        const yAxis = d3.axisLeft(y)
            .ticks(10);

        // Compute a path line (curve) from data
        const valueLine = d3.line()
            .x(function (d, i) {
                return xVal(self.datum.rawkeys[i]);
            })
            .y(function (d) {
                return y(d);
            });

        // Build the combobox permitting to select the ts to display
        const onTsChanged = function () {
            svg.remove();
            div.remove();
            self.drawSelectedTs(this.value);
            this.remove();
        };

        // Build a selector to choose from which TS to display the SAX results
        const ts_selector = d3.select("#" + self.container).append("select")
            .attr("class", "form-control")
            .on("change", onTsChanged);

        // Define the selector options
        ts_selector.selectAll("option")
            .data(self.data.ts_list)
            .enter()
            .append("option")
            .attr("value", function (d) {
                return d.tsuid;
            })
            .text(function (d) {
                return d.funcId;
            })
            .each(function (d) {
                if (d.tsuid === self.curtsuid) {
                    d3.select(this).attr("selected", "");
                }
            });

        // Create a false empty data array (with same size as rawdata) in order to compute launching animation
        const startData = self.datum.rawkeys.map(function () {
            return 0;
        });

        // Main SVG component
        const svg = d3.select("#" + self.container)
            .append("svg")
            .attr("width", "100%")
            .attr("height", "100%")
            .attr("viewBox", "0 0 950 500");

        //Define the div for the tooltip in order to display the value of a point in curve by pointing it
        const div = d3.select("#" + self.container).append("div")
            .attr("class", "tooltip")
            .style("opacity", 0)
            .style("position", "fixed")
            .style("background-color", "#d1eeee")
            .style("border-radius", "3px")
            .style("padding", "2px");


        // Print data curve
        svg.append("path")
            .attr("fill", "none")
            .attr("stroke", "blue")
            .attr("stroke-width", "1px")
            .transition()
            .delay(200)
            .duration(500)
            .attrTween("d", function () {
                return d3.interpolateString(valueLine(startData), valueLine(self.datum.rawvalues));
            });

        // PAA selector
        const paaDisplay = svg.selectAll("g")
            .data(self.datum.paa);

        // SAX selector
        const saxDisplay = svg.selectAll("g")
            .data(self.datum.sax_breakpoints);

        // G component in which PaaOverlay will be injected
        const paaOverlay = paaDisplay
            .enter()
            .append("g");

        // Add all PAA horizontal lines
        paaOverlay.append("line")
            .attr("x1", function (d, i) {
                return xPAA(i);
            })
            .attr("y1", function (d) {
                return y(d);
            })
            .attr("x2", function (d, i) {
                return xPAA(i + 1);
            })
            .attr("y2", function (d) {
                return y(d);
            })
            .attr("stroke", "red")
            .attr("stroke-width", "2")
            .attr("opacity", "0")
            .transition()
            .delay(700)
            .duration(200)
            .attrTween("opacity", function () {
                return d3.interpolateString("0.01", "1.00");
            });

        // Add vertical delimiters
        paaOverlay.append("line")
            .attr("x1", function (d, i) {
                return xPAA(i + 1);
            })
            .attr("x2", function (d, i) {
                return xPAA(i + 1);
            })
            .attr("y1", margin_topbot)
            .attr("y2", height - margin_topbot)
            .attr("stroke", "black")
            .attr("stroke-width", "2")
            .attr("stroke-dasharray", "5,20")
            .attr("opacity", "0")
            .transition()
            .delay(700)
            .duration(200)
            .attrTween("opacity", function () {
                return d3.interpolateString("0.01", "0.30");
            });

        // Add sax letters
        // noinspection UnnecessaryLocalVariableJS
        let saxOverlay = paaOverlay;
        saxOverlay.append("text")
            .attr("opacity", "0")
            .attr("x", function (d, i) {
                return xPAA(i) + (xPAA(0));
            })
            .attr("y", function (d) {
                return y(d) - 10;
            })
            .attr("font-weight", "bold")
            .text(function (d, i) {
                return self.datum.sax_string.substr(i, 1);
            })
            .transition()
            .delay(700)
            .duration(200)
            .attrTween("opacity", function () {
                return d3.interpolateString("0.01", "1.00");
            });

        // Add sax areas (Breakpoints)
        saxDisplay.enter()
            .append("g")
            .append("line")
            .attr("x1", margin_side)
            .attr("x2", width - margin_side)
            .attr("y1", function (d) {
                return y(d);
            })
            .attr("y2", function (d) {
                return y(d);
            })
            .attr("stroke", "black")
            .attr("opacity", "0.3")
            .attr("stroke-width", "1")
            .attr("display", "none")
            .transition()
            .delay(700)
            .attr("display", "block");


        svg.selectAll("g").data(self.datum.sax_breakpoints)
            .enter()
            .append("g")
            .append("text")
            .attr("x", "10")
            .attr("y", "20")
            .text(function (d) {
                return d;
            });

        // Add axises
        svg.append("g")
            .attr("transform", "translate(0," + (height - margin_topbot) + ")")
            .call(xAxis);
        svg.append("g")
            .attr("transform", "translate(" + margin_side + ",0)")
            .call(yAxis);

        // Print dots of data (last because interactive with mouse events [superposition])
        svg.selectAll("circle")
            .data(self.datum.rawvalues)
            .enter()
            .append("circle")
            .attr("cx", function (d, i) {
                return xVal(self.datum.rawkeys[i]);
            })
            .attr("cy", function () {
                return y(0);
            })
            .attr("r", 10)
            .attr("fill-opacity", "0")
            .on("mouseover", function (d, i) {
                div.transition()
                    .duration(200)
                    .style("display", "block")
                    .style("opacity", 0.9);
                div.html("value = <span style='color:red'>" + d + "</span><br/>" +
                    "date = <span style='color:red'>" + new Date(self.datum.rawkeys[i]).toISOString() + "</span>")
                    .style("left", (d3.event.pageX + 20) + "px")
                    .style("top", (d3.event.pageY - 28) + "px");
                d3.select(this)
                    .transition()
                    .attr("fill-opacity", "1")
                    .attr("r", 5);
            })
            .on("mouseout", function () {
                div.transition()
                    .duration(500)
                    .style("opacity", 0)
                    .style("display", "none");
                d3.select(this)
                    .transition()
                    .attr("fill-opacity", "0")
                    .attr("r", 10);
            })
            // Add transition for kick off
            .transition()
            // Add delay so that it looks nice
            .delay(200)
            .duration(500)
            // Set radius to wished size
            .attr("r", 10)
            .attr("cx", function (d, i) {
                return xVal(self.datum.rawkeys[i]);
            })
            .attr("cy", function (d) {
                return y(d);
            });
    }

}
