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
 * A VizTool permitting to show curves for non temporal data given in data using D3 Library
 *
 * @constructor
 * @param {string} container - the ID of the injected div
 * @param {Object} data - the data used in the visualization
 *
 * example :
 * {
 *   "title": "var1 vs var2",
 *   "x_value": {
 *       "desc": {
 *           "label": "Flight number"
 *       },
 *       "data": [10, 20, 30, 40]
 *   },
 *   "y_values": [
 *       {
 *           "desc": {
 *               "label": "Pearson correlation"
 *           },
 *           "data": [correl1, correl2, correl3, correl4]
 *       }
 *   ],
 *   "ts_lists": [
 *       [tsuid_var1_10, tsuid_var2_10],
 *       [tsuid_var1_20, tsuid_var2_20],
 *       [tsuidx_var1_30, tsuidy_var2_30],
 *       [tsuidx_var1_40, tsuidy_var2_40]
 *   ]
 * }
 *
 * @param {Array} callbacks - the list of the callbacks used by Viz
 */
class D3CurveNonTemporal extends VizTool {
    constructor(container, data, callbacks) {
        // Call super-class constructor
        super(container, data, callbacks);
        this.name = "Curve Non Temporal Data";

        // Array of d3 formatted data
        this.curData = cloneObj(data);

        // Stack all pending API calls
        this.ajaxRq = [];

        this.d3 = {
            // Objects
            o: {},
            // Constants
            c: {
                width: 1200,
                height: 500,
                marginTopBot: 20,
                marginSide: 40,
                yAxisTitleWidth: 20,
                titleHeight: 30
            },
            // Transformations
            t: {}
        };


    }

    /**
     * Init the VizTool : collect and format the data (if necessary) then render the VizTool
     */
    display() {
        const self = this;

        // Display a loading screen
        d3.select("#" + self.container).append("img")
            .attr("src", "../../../icons/loading-gears.gif")
            .style("width", "100px")
            .style("height", "100px")
            .style("position", "relative")
            .style("display", "block")
            .style("margin-left", "auto")
            .style("margin-right", "auto")
            .style("top", "50%")
            .style("transform", "translateY(-50%)");

        // Then Get data points information
        self.prepareData();
        // Initialize render (first time only)
        self.render();

    }

    /**
     * Compute and render all graphical components of vizTool
     */
    render() {
        const self = this;
        // Cleans content (end of loading)
        d3.select("#" + self.container).selectAll("*")
            .remove();

        // Initialize D3 components
        self.computeScales();
        // Initialize D3 Objects
        self.initD3Objects();
        // Compute and render curves
        self.drawCurves();
        // Initialize Tooltip component
        self.initTooltip();
    }

    /**
     * Initialize tooltip component, creating a tooltip line per series
     */
    initTooltip() {
        const self = this;

        self.d3.o.tooltipLines = [];
        self.d3.o.tooltipLines.push(
            self.d3.o.tooltip.append("p")
                .style("color", "black")
                .style("margin", "0 0 4px")
                .style("font-size", "0.8em"));
        self.d3.o.tooltipLines.push(
            self.d3.o.tooltip.append("p")
                .style("color", "black")
                .style("margin", "0 0 4px")
                .style("font-size", "0.8em"));
    }

    /**
     * Initialize D3 graphical objects (composing the graphical render)
     */
    initD3Objects() {
        const self = this;


        // Tooltip component
        self.d3.o.tooltip = d3.select("#" + self.container)
            .append("div")
            .style("position", "fixed")
            .style("font-size", "1em")
            .style("background-color", "rgba(255,255,255,0.7)")
            .style("border-radius", "3px")
            .style("box-shadow", "0px 1px 1px 1px #c0c0c0")
            .style("pointer-events", "none")
            .style("font-weight", "bold")
            .style("opacity", "0")
            .style("border", "solid 1px #CCC")
            .style("padding", "0px 5px")
            .style("z-index", "10");

        // SVG component
        self.d3.o.svg = d3.select(`#${self.container}`)
            .append("svg")
            .style("max-width", "calc(100% - " + self.d3.c.yAxisTitleWidth + ")")
            .style("position", "absolute")
            .style("margin-left", self.d3.c.yAxisTitleWidth)
            .style("margin-top", self.d3.c.titleHeight)
            .attr("max-height", "100%")
            .attr("viewBox", "0 0 " + self.d3.c.width + " " + (self.d3.c.height + self.d3.c.marginTopBot + 20))
            .style("z-index", 0);

        // Container filling all available space inside draw area
        self.d3.o.screen = self.d3.o.svg.append("g")
            .attr("transform", `translate(${self.d3.c.marginSide} ${self.d3.c.marginTopBot})`);

        // Title component (top middle)
        self.d3.o.title = self.d3.o.svg
            .append("svg")
            .style("position", "absolute")
            .style("max-height", "100%")
            .style("max-width", "100%")
            .style("width", "100%")
            .attr("pointer-events", "none")
            .style("height", self.d3.c.titleHeight)
            .append("text")
            .style("stroke", "#00008b")
            .style("fill", "#00008b")
            .style("font-size", "1.8em")
            .attr("transform", "translate(" + (self.d3.c.width / 2) + " ," + 2 * self.d3.c.titleHeight / 3 + ")")
            .style("text-anchor", "middle")
            .style("text-align", "center")
            .text(self.data.title);


        // Y axis title
        self.d3.o.yTitle = self.d3.o.svg
            .append("svg")
            .style("max-height", "100%")
            .style("max-width", "100%")
            .style("height", "100%")
            .style("width", "100%")
            .style("position", "absolute")
            .attr("pointer-events", "none")
            .append("text")
            .attr("transform", "rotate(-90)")
            .attr("y", 0)
            .attr("x", -self.d3.c.height / 2)
            .attr("dy", "1em")
            .style("text-anchor", "middle")
            .text(self.data.y_values[0].desc.label);

        // Horizontal axis component
        self.d3.o.xAxis = d3.axisBottom(self.d3.t.xScale)
            .ticks(Math.min(3, self.curData.length))
            .tickSizeInner(-(self.d3.c.height - self.d3.c.marginTopBot * 2))
            .tickFormat(function (i) {
                if (i === self.data.x_value.data.length) {
                    return self.curData[i - 1][0];
                }
                if (i < 0) {
                    return self.curData[0][0];
                }
                return self.curData[i][0];
            });

        // Vertical axis component
        self.d3.o.yAxis = d3.axisLeft(self.d3.t.yScale)
            .ticks(10)
            .tickSizeInner(-(self.d3.c.width - self.d3.c.marginSide * 2));

        // X axis title
        self.d3.o.xTitle = self.d3.o.svg
            .append("svg")
            .attr("name", "xTitle")
            .style("position", "absolute")
            .style("max-height", "100%")
            .style("max-width", "100%")
            .style("width", "100%")
            .attr("pointer-events", "none")
            .style("height", "100%")
            .append("text")
            .attr("transform", "translate(" + (self.d3.c.width / 2) + " ," + (self.d3.c.height + self.d3.c.marginTopBot) + ")")
            .style("text-anchor", "middle")
            .style("text-align", "center")
            .text(self.data.x_value.desc.label);

        // Container of the chart
        self.d3.o.graph = self.d3.o.screen.append("svg")
            .attr("width", self.d3.c.width - self.d3.c.marginSide * 2)
            .attr("height", self.d3.c.height - self.d3.c.marginTopBot * 2)
            .on("click", function () {
                    // Event : click on graph => open scatterplot viztool with focused data
                    const mouse = d3.mouse(this);
                    const index = Math.round(self.d3.t.xScale.invert(mouse[0] + self.d3.c.marginSide));
                    if (self.data.ts_lists[index].length !== 0) {
                        const ts_list = self.data.ts_lists[index];
                        self.addViz('ScatterPlot', ts_list);
                    }
                }
            )
            .on("mousemove", function () {
                    // Event : move mouse => nearest real data dot is focused, tooltip is updated
                    const mouse = d3.mouse(this);
                    let index = Math.round(self.d3.t.xScale.invert(mouse[0] + self.d3.c.marginSide));

                    if (index < 0) {
                        index = 0;
                    }
                    if (index > self.curData.length - 1) {
                        index = self.curData.length - 1;
                    }

                    const valueX = self.data.x_value.data[index];
                    const valueY = self.data.y_values[0].data[index];

                if (!isNaN(valueY) && valueY !== null) {
                        // Display dot
                        self.d3.o.focusDot
                            .attr("cx", self.d3.t.xScale(index) - self.d3.c.marginSide)
                            .attr("cy", self.d3.t.yScale(valueY) - self.d3.c.marginTopBot)
                            .style("visibility", "visible");
                    } else {
                        self.d3.o.focusDot
                            .style("visibility", "hidden");
                    }

                    // Print tooltip lines
                self.d3.o.tooltipLines[0].text(self.data.x_value.desc.label + " : " + valueX);
                self.d3.o.tooltipLines[1].text(self.data.y_values[0].desc.label + " : " + valueY);

                    // Get mouse coordinates relatively to widget
                    const mouseWidgetSvg = d3.mouse(self.d3.o.svg.node().parentNode);
                    const mouseWidgetWindow = d3.mouse(d3.select("body").node());
                    self.d3.o.tooltip.style("opacity", 1);

                    if (mouseWidgetSvg[0] > self.d3.o.svg.node().parentNode.getBoundingClientRect().width / 2) {
                        // Tooltip before :
                        self.d3.o.tooltip.style("top", mouseWidgetWindow[1] - 20);
                        self.d3.o.tooltip.style("left", mouseWidgetWindow[0] - 20 - self.d3.o.tooltip.node()
                            .getBoundingClientRect().width);
                    } else {
                        // Tooltip after :
                        self.d3.o.tooltip.style("top", mouseWidgetWindow[1] - 20);
                        self.d3.o.tooltip.style("left", mouseWidgetWindow[0] + 20);
                    }
                    self.d3.o.vertCursor
                        .attr("x", mouse[0])
                        .attr("stroke", "#DDD");
                }
            )
            .on("mouseout", function () {
                    // Hide tooltip and vertCursor
                    self.d3.o.tooltip.style("opacity", 0);
                    self.d3.o.vertCursor.attr("stroke", "none");

                    // Hide all focus dots
                    self.d3.o.focusDot.style("visibility", "hidden");
                }
            );

        // Sets up a white background behind graph
        self.d3.o.graph.append("rect")
            .attr("width", self.d3.c.width)
            .attr("height", self.d3.c.height)
            .attr("fill", "#FFF");

        // Sets up a vertical cursor showing current X value
        self.d3.o.vertCursor = self.d3.o.graph.append("rect")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", "1px")
            .attr("height", "100%")
            .attr("stroke", "none")
            .attr("fill", "none")
            .style("pointer-events", "none");

        // Drag selection highlights
        self.d3.o.selectionBar = self.d3.o.graph.append("rect")
            .attr("fill", "green")
            .attr("opacity", "0.1");

        // Add axises to svg
        self.d3.o.xAxisComp = self.d3.o.svg.append("g")
            .attr("class", "xaxis")
            .attr("transform", "translate(0 , " + (self.d3.c.height - self.d3.c.marginTopBot) + ")")
            .call(self.d3.o.xAxis);

        self.d3.o.yAxisComp = self.d3.o.svg.append("g")
            .attr("class", "yaxis")
            .attr("transform", "translate(" + self.d3.c.marginSide + " , 0)")
            .call(self.d3.o.yAxis);

        // Sets up a list of svg Path representing curves (will be filled up during draw phase)
        self.d3.o.curves = [];

        // Closest points highlighting
        self.d3.o.focusDot = self.d3.o.graph.append("circle")
            .attr("cx", 0)
            .attr("cy", 0)
            .attr("r", 3)
            .attr("stroke", "none")
            .attr("fill", "#00008b")
            .style("pointer-events", "none");
    }

    /**
     * Compute coordinates and draw curves representing data
     */
    drawCurves() {
        const self = this;

        // Remove eventual loader
        if (self.d3.o.loader && !self.d3.o.loader.empty()) {
            self.d3.o.loader.remove();
        }
        // Remove eventual old curves
        self.d3.o.curves.forEach(function (curve) {
            curve.remove();
        });
        self.d3.o.curves.length = 0;
        const line = d3.line()
            .x(function (d) {
                return self.d3.t.xScale(d[2]) - self.d3.c.marginSide;
            })
            .y(function (d) {
                return self.d3.t.yScale(d[1]) - self.d3.c.marginTopBot;
            });
        self.data_lines = self.splice(self.curData);
        self.data_lines.forEach(function (data_line) {
            self.d3.o.curves.push(
                self.d3.o.graph.append("path")
                    .datum(data_line)
                    .attr("d", line)
                    .attr("stroke", "#00008b")
                    .attr("fill", "none")
                    .attr("stroke-width", "1px")
            );
        });
    }

    /**
     * Splice the data line in order to get only numerical values
     */
    splice(array) {
        let lineIndex = 0;
        let validLines = [[]];
        for (let i = 0; i < array.length; i++) {
            if (array[i][1] === null) {
                lineIndex++;
                validLines[lineIndex] = [];
            } else if (isNaN(array[i][1])) {
                lineIndex++;
                validLines[lineIndex] = [];
            } else {
                let line = array[i].slice();
                // stack initial index
                line.push(i);
                validLines[lineIndex].push(line);
            }
        }
        return validLines;
    }

    /**
     * Wake up (Restore) the VizTool.
     */
    wakeUp() {
        this.display();
    }

    /**
     * Persist the VizTool for a quick restoration.
     */
    sleep() {
        // Useless for this viztool
    }

    /**
     * Collect data for drawing curve
     */
    prepareData() {
        const self = this;

        self.curData.length = 0;
        // Retrieve x and y coordinates from original data
        const coord_x = self.data.x_value.data;
        const coord_y = self.data.y_values[0].data;

        self.curData = coord_x.map(function (value, index) {
            return [value, coord_y[index]];
        });

    }

    /**
     * Compute initial scales
     */
    computeScales() {
        const self = this;

        // Compute min and max values for y-scale
        const maxValueY = Math.max.apply(null, self.curData.map(function (point) {
            if (isNaN(point[1])) {
                return null;
            }
            return point[1];
        }));

        const minValueY = Math.min.apply(null, self.curData.map(function (point) {
            if (isNaN(point[1])) {
                return null;
            }
            return point[1];
        }));

        // Sets up a D3 scale for abscissa
        self.d3.t.xScale = d3.scaleLinear()
        // abscissa range
            .domain([-1, self.curData.length])
            // Display range
            .range([(self.d3.c.marginSide), (self.d3.c.width - self.d3.c.marginSide)]);

        let delta = maxValueY - minValueY;
        // Sets up a D3 scale for ordinate
        self.d3.t.yScale = d3.scaleLinear()
        // ordinate range
            .domain([minValueY - (0.1 * delta), maxValueY + (0.1 * delta)])
            // Display range
            .range([(self.d3.c.height - self.d3.c.marginTopBot), (self.d3.c.marginTopBot)]);
    }
}
