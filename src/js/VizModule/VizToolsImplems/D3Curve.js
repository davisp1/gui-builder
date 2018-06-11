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
 * A VizTool permitting to show curves for the time series given in data using D3 Library
 *
 * @constructor
 * @param {string} container the ID of the injected div
 * @param {Array} data the data used in the visualization (Array of time series)
 *                  Contains : tsuid the tsuid of the TS
 *                             funcId the functional identifier of the TS
 * @param {Object} callbacks Dictionary of the callbacks available
 */
class D3Curve extends VizTool {
    constructor(container, data, callbacks) {
        // Call super-class constructor
        super(container, data, callbacks);
        this.name = "Curve";

        // Array of d3 formatted data, one line per ts, containing timestamps, values, and some state values
        this.curData = [];

        // Data corresponding to the first draw. Contains same information as this.curData
        this.initialData = [];

        // Flag indicating if a resampling should be applied (true) or not (false) for initial state.
        this.resampled = false;

        // Stack all pending API calls
        this.ajaxRq = [];

        // Max number of points that can be displayed at a time in viztool (for all data)
        this.MAX_RAW_POINTS = 10000;

        // Indicate if the viztool has "loading" in progress (to prevent from triggering events)
        this.isLoading = true;

        // Scale of "out of range" data to load
        // (permits better interaction, but slightly lower precision when value is high)
        // value set to 1 means 100% of the visible window range will be retrieved
        // (50% on the left side, 50% on the right side)
        this.RANGE_OUT = 1;

        this.d3 = {
            // Objects
            o: {},
            // Constants
            c: {
                width: 1200,
                height: 500,
                marginTopBot: 20,
                marginSide: 40,
                flagsColor: "red",
                FLAG_DIRECTIONS: {
                    vertical: "vertical",
                    horizontal: "horizontal",
                    dot: "dot",
                    invalid: null
                },
                flagLabelShift: 10
            },
            // Transformations
            t: {
                align: false
            },
            // Events
            e: {}
        };

        this.data = JSON.parse(JSON.stringify(this.data));
        // Check if data contains flags (meaning the type is "ts_bucket")
        if (this.data.flags) {
            this.flags = this.data.flags;
            this.data = this.data.data;
            this.setFlagsTypes();
        }

        // Palette of colors used in VizTool, one color per TS in data, if there is more TS than colors in palette
        // then palette is completed with new random colors
        this.colorPalette = [
            "#ffa500", //orange
            "#008000", //green
            "#0000ff", //blue
            "#800080", //violet
            "#ff0000", //red
            "#008b8b", //darkcyan
            "#000000", //black
            "#a52a2a", //brown
            "#00008b", //darkblue
            "#a9a9a9", //darkgrey
            "#006400", //darkgreen
            "#8b008b", //darkmagenta
            "#556b2f", //darkolivegreen
            "#ff8c00", //darkorange
            "#bdb76b", //darkkhaki
            "#9932cc", //darkorchid
            "#8b0000", //darkred
            "#e9967a", //darksalmon
            "#ff00ff", //fuchsia
            "#4b0082", //indigo
            "#808000", //olive
            "#ffc0cb", //pink
        ];

        // Setup a default value for the (x) zooming state
        this.timeZoomState = [null, null];
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

        // Get metadata information
        self.collectMeta().then(function () {
            // Then Get data points information
            self.collectData().then(function () {
                // Initialize render (first time only)
                self.setDefaultDataParam();
                self.render();
                self.saveInitialData();
            });
        });
    }

    /**
     * Iterate over flags to augment their data with their types.
     */
    setFlagsTypes() {
        const self = this;
        self.flags.forEach(function (flag) {
            flag.type = self.getFlagType(flag);
        });
    }

    /**
     * Identify the type of a given flag
     * @param {Object} flag the flag to get the type from
     * @returns {String} the type of the flag given as parameter ("vertical","horizontal","dot" or null if invalid)
     */
    getFlagType(flag) {
        const self = this;
        if (flag.timestamp !== null && flag.timestamp !== undefined) {
            if (flag.value !== null && flag.value !== undefined) {
                return self.d3.c.FLAG_DIRECTIONS.dot;
            } else {
                return self.d3.c.FLAG_DIRECTIONS.vertical;
            }
        }
        else {
            if (flag.value !== null && flag.value !== undefined) {
                return self.d3.c.FLAG_DIRECTIONS.horizontal;
            }
            console.warn("Flag ", flag, " is badly formatted, it will not be displayed");
            return self.d3.c.FLAG_DIRECTIONS.invalid;
        }
    }

    saveInitialData() {
        const self = this;
        self.initialData = JSON.parse(JSON.stringify(self.curData));
    }

    /**
     * Produce an API call to get all metadata for current ts(s)
     * @returns {Promise} resolved when metadata is fully collected
     */
    collectMeta() {
        const self = this;
        return new Promise(function (resolve) {
            ikats.api.md.read({
                ts_list: self.data.map(function (ts) {
                    return ts.tsuid;
                }),
                async: true,
                success: function (metas) {
                    // When api call results in a success, resolve promise
                    self.data.metas = metas.data;
                    resolve();
                },
                error: function () {
                    // If fails, just block process and tell the user the problem
                    d3.select("#" + self.container).html("Could not get metadata for given TS list.");
                    notify().error("Could not get metadata for given TS list.");
                }
            });
        });
    }

    /**
     * Compute and render all graphical components of vizTool
     */
    render() {
        const self = this;
        // Cleans content (end of loading)
        d3.select("#" + self.container).selectAll("*")
            .remove();

        if (self.data.length === 1) {
            // Add a button to cut the TS
            d3.select("#" + this.container)
                .append("button")
                .attr("class", "btn btn-default")
                .text("Save visible area as a new TS")
                .on("click", function () {
                    self.buildModal();
                });
        }

        // Initialize D3 components
        // Scales
        self.computeScales(false);
        if (self.d3.t.align) {
            self.computeAlignScales();
        }
        // Initialize D3 Events
        self.initD3Events();
        // Initialize D3 Objects
        self.initD3Objects();
        // Compute and render curves
        self.drawCurves();
        if (this.flags) {
            // Render flags
            self.drawFlags();
        }
        // Initialize Legend component
        self.initLegend();
        // Initialize Tooltip component
        self.initTooltip();
        // The viztool becomes ready to handle events
        self.isLoading = false;
    }

    /**
     * Decorate current data array with additional variables
     */
    setDefaultDataParam() {

        const self = this;

        // Sets up visibility variable for each data line
        self.d3.visibleCurves = [];
        self.curData.forEach(function (datum, index) {
            self.d3.visibleCurves[index] = true;
        });
    }

    /**
     * Toggle on/off the display of the legend component
     *
     * @param show boolean indicating to show (true) or hide (false) the legend
     */
    showLegend(show) {
        const self = this;
        let display_mode = "block";
        if (show === false) {
            display_mode = "none";
        }
        self.d3.o.legend.selectAll(".ts_label")
            .style("display", display_mode);
    }

    /**
     * Toggle on/off alignment of start dates
     *
     * @param show boolean indicating to align (true) or reset (false) the curves
     */
    alignStarts(show) {
        const self = this;

        // Reset zoom state
        self.resetZoom(true);
    }

    /**
     * Initialize legend component, creating a legend line per TS
     */
    initLegend() {
        const self = this;

        // Array containing all legend lines (visible or not)
        self.d3.legendLines = [];
        self.curData.forEach(function (datum, index) {
            self.d3.legendLines.push(
                self.d3.o.legend.append("p")
                    .style("color", function () {
                        if (self.d3.visibleCurves[index]) {
                            return self.colorPalette[index];
                        } else {
                            return "#CCC";
                        }
                    })
                    .attr("class", "ts_label")
                    .style("font-size", "0.8em")
                    .style("cursor", "pointer")
                    .style("margin", "0px 3px")
                    .text(datum.funcId)
                    .on("click", function () {
                        if (!self.isLoading) {
                            // Toggle visibility of the clicked TS
                            self.d3.visibleCurves[index] = !self.d3.visibleCurves[index];
                            self.quickUpdate();
                        }
                    })
                    .on("mouseover", function () {
                        d3.select(this).style("text-decoration", "underline");
                    })
                    .on("mouseout", function () {
                        d3.select(this).style("text-decoration", "none");
                    })
            );
        });
    }

    /**
     * Initialize tooltip component, creating a tooltip line per TS
     */
    initTooltip() {
        const self = this;

        // Array containing all tooltip lines (visible or not)
        self.d3.tooltipLines = [];
        self.curData.forEach(function (datum, index) {
            if (index > self.colorPalette.length) {
                notify().error("Palette does not contain enough colors to render curve with color, " +
                    "this should never occur, contact an administrator");
                self.d3.tooltipLines.push(
                    self.d3.o.tooltip.append("p")
                        .style("color", "#000")
                        .style("margin", "0 0 4px")
                        .style("font-size", "0.8em")
                );
            } else {
                self.d3.tooltipLines.push(
                    self.d3.o.tooltip.append("p")
                        .style("color", self.colorPalette[index])
                        .style("margin", "0 0 4px")
                        .style("font-size", "0.8em")
                );
            }
        });
    }

    /**
     * Initialize D3 graphical objects (composing the graphical render)
     */
    initD3Objects() {
        const self = this;

        // Legend component (top right)
        self.d3.o.legend = d3.select("#" + self.container).append("div")
            .style("position", "absolute")
            .style("right", "40px")
            .style("text-align", "right")
            .style("background-color", "rgba(255,255,255,0.6)");

        // State variable telling if legend is visible or hidden
        self.d3.o.legend.visible = true;

        self.d3.o.action_buttons = d3.select("#" + self.container).append("div")
            .style("position", "absolute")
            .style("left", "80px")
            .style("text-align", "right")
            .style("background-color", "rgba(255,255,255,0.6)");

        // Little text to help using this viztool
        self.d3.o.action_buttons
            .append("span")
            .attr("class", "btn btn-link")
            .attr("title", function () {
                if (!self.d3.t.align) {
                    return "Activate aligned starts mode, curves will be displayed according to their duration not regarding the date (will disable zoom and pan)";
                } else {
                    return "Go back to standard mode (will enable zoom and pan)";
                }
            })
            .style("font-size", "0.7em")
            .style("color", "rgba(0,0,0,0.4)")
            .text(function () {
                if (!self.d3.t.align) {
                    return "Align starts";
                } else {
                    return "Reset view";
                }
            })
            .style("margin-right", "5px")
            .on("click", function () {
                self.d3.t.align = !self.d3.t.align;

                self.alignStarts(self.d3.t.align);
            });

        // Little text to help using this viztool
        self.d3.o.legend
            .append("span")
            .attr("class", "btn btn-link")
            .style("font-size", "0.7em")
            .style("color", "rgba(0,0,0,0.4)")
            .text("hide legend")
            .style("margin-right", "5px")
            .on("click", function () {
                // Toggle legend display
                if (self.d3.o.legend.visible) {
                    d3.select(this).text("show legend");
                } else {
                    d3.select(this).text("hide legend");
                }
                self.d3.o.legend.visible = !self.d3.o.legend.visible;
                self.showLegend(self.d3.o.legend.visible);
            });

        // Tooltip component
        self.d3.o.tooltip = d3.select("#" + self.container)
            .append("div")
            .style("position", "absolute")
            .style("font-size", "0.8em")
            .style("background-color", "rgba(255,255,255,0.7)")
            .style("border-radius", "3px")
            .style("box-shadow", "0px 1px 1px 1px #c0c0c0")
            .style("pointer-events", "none")
            .style("font-weight", "bold")
            .style("opacity", "0")
            .style("border", "solid 1px #CCC")
            .style("padding", "0px 5px")
            .style("z-index", "10");

        // Init time holder in tooltip
        self.d3.o.tooltip.timeholder = self.d3.o.tooltip.append("span")
            .style("font-size", "0.8em");

        // SVG component
        self.d3.o.svg = d3.select(`#${self.container}`)
            .append("svg")
            .attr("max-width", "100%")
            .attr("max-height", "100%")
            .attr("viewBox", `0 0 ${self.d3.c.width} ${self.d3.c.height}`);

        // Horizontal axis component
        self.d3.o.xAxis = d3.axisBottom(self.d3.t.timeScale)
            .ticks(5)
            .tickSizeInner(-(self.d3.c.height - self.d3.c.marginTopBot * 2))
            .tickFormat(function (d) {
                const date = new Date(d);
                if (self.d3.t.align) {
                    let delta = date.getTime() / 1000;
                    const days = Math.floor(delta / 86400);
                    delta -= days * 86400;

                    const hours = Math.floor(delta / 3600) % 24;
                    delta -= hours * 3600;

                    const minutes = Math.floor(delta / 60) % 60;
                    delta -= minutes * 60;

                    const seconds = Math.round(delta);
                    return days + "d " + hours + "h " + minutes + "m " + seconds + "s";
                } else {
                    return date.toISOString().substr(0, 23);
                }
            });

        // Vertical axis component
        self.d3.o.yAxis = d3.axisLeft(self.d3.t.valueScale)
            .ticks(10)
            .tickSizeInner(-(self.d3.c.width - self.d3.c.marginSide * 2));

        // Container filling all available space inside draw area
        self.d3.o.screen = self.d3.o.svg.append("g")
            .attr("transform", `translate(${self.d3.c.marginSide} ${self.d3.c.marginTopBot})`);

        // Container of the chart
        self.d3.o.graph = self.d3.o.screen.append("svg")
            .attr("width", self.d3.c.width - self.d3.c.marginSide * 2)
            .attr("height", self.d3.c.height - self.d3.c.marginTopBot * 2)
            .on("dblclick", function () {
                if (!self.isLoading) {
                    self.resetZoom();
                }
            })
            .on("mousemove", function () {
                if (!self.isLoading) {
                    const mouse = d3.mouse(this);
                    const timestamp = Math.floor(self.d3.t.timeScale.invert(mouse[0] + self.d3.c.marginSide));
                    if (self.d3.t.align) {
                        const date = new Date(timestamp);
                        let delta = date.getTime() / 1000;
                        const days = Math.floor(delta / 86400);
                        delta -= days * 86400;

                        const hours = Math.floor(delta / 3600) % 24;
                        delta -= hours * 3600;

                        const minutes = Math.floor(delta / 60) % 60;
                        delta -= minutes * 60;

                        const seconds = Math.round(delta);
                        self.d3.o.tooltip.timeholder.text(days + "d " + hours + "h " + minutes + "m " + seconds + "s");
                    } else {
                        self.d3.o.tooltip.timeholder.text(new Date(timestamp).toISOString().substr(0, 23));
                    }

                    // Verify if data is ready
                    if (self.curData.filter(function (line) {
                            return line.data_points;
                        }).length === self.data.length) {
                        // Get points corresponding to current date
                        self.curData.forEach(function (dat, index) {
                            if (self.d3.visibleCurves[index]) {
                                let closest;
                                // Get the closest data point
                                if (self.d3.t.align) {
                                    // Aligned mode
                                    closest = dat.data_points.timestamps.reduce(function (prev, curr, index) {
                                        if (Math.abs((curr) - (timestamp + dat.meta.start_date)) < Math.abs((prev.timestamp) - (timestamp + dat.meta.start_date))) {
                                            return {
                                                index: index,
                                                timestamp: curr
                                            };
                                        } else {
                                            return prev;
                                        }
                                    }, {"index": 0, "timestamp": 0});
                                } else {
                                    // Default mode
                                    closest = dat.data_points.timestamps.reduce(function (prev, curr, index) {
                                        if (Math.abs((curr) - timestamp) < Math.abs((prev.timestamp) - timestamp)) {
                                            return {
                                                index: index,
                                                timestamp: curr
                                            };
                                        } else {
                                            return prev;
                                        }
                                    }, {"index": 0, "timestamp": 0});
                                }
                                if (dat.data_points.values[closest.index] || dat.data_points.values[closest.index] === 0) {
                                    // Display dot
                                    if (self.d3.t.align) {
                                        // Aligned mode
                                        self.d3.o.focusDots[index]
                                            .attr("fill", self.colorPalette[index])
                                            .attr("cx", self.d3.t.timeScale(closest.timestamp - dat.meta.start_date) - self.d3.c.marginSide)
                                            .attr("cy", self.d3.t.valueScale(dat.data_points.values[closest.index]) - self.d3.c.marginTopBot);

                                        // Print tooltip line
                                        self.d3.tooltipLines[index]
                                            .text(self.data[index].funcId + "(" + new Date(closest.timestamp).toISOString() + ")" + " : " +
                                                dat.data_points.values[closest.index].toFixed(4));
                                    } else {
                                        // Default mode
                                        self.d3.o.focusDots[index]
                                            .attr("fill", self.colorPalette[index])
                                            .attr("cx", self.d3.t.timeScale(closest.timestamp) - self.d3.c.marginSide)
                                            .attr("cy", self.d3.t.valueScale(dat.data_points.values[closest.index]) - self.d3.c.marginTopBot);

                                        // Print tooltip line
                                        self.d3.tooltipLines[index]
                                            .text(self.data[index].funcId + " : " +
                                                dat.data_points.values[closest.index].toFixed(4));
                                    }
                                }
                            }
                        });

                        // Get mouse coordinates relatively to widget
                        const mouseWidget = d3.mouse(self.d3.o.svg.node().parentNode);
                        self.d3.o.tooltip.style("opacity", 1);
                        if (mouseWidget[0] > self.d3.o.svg.node().parentNode.getBoundingClientRect().width / 2) {
                            // Tooltip before :
                            self.d3.o.tooltip.style("top", mouseWidget[1] + 20);
                            self.d3.o.tooltip.style("left", mouseWidget[0] - self.d3.o.tooltip.node()
                                .getBoundingClientRect().width);
                        } else {
                            // Tooltip after :
                            self.d3.o.tooltip.style("top", mouseWidget[1] + 20);
                            self.d3.o.tooltip.style("left", mouseWidget[0] + ( self.d3.c.marginSide) + 30);
                        }
                        self.d3.o.vertCursor
                            .attr("x", self.d3.t.timeScale(timestamp) - self.d3.c.marginSide)
                            .attr("stroke", "#DDD");
                    }
                }
            })
            .on("mouseout", function () {
                // Hide tooltip and vertCursor
                self.d3.o.tooltip.style("opacity", 0);
                self.d3.o.vertCursor.attr("stroke", "none");

                // Hide all focus dots
                self.d3.o.focusDots.forEach(function (dot) {
                    dot.attr("fill", "none");
                });
            })
            .call(self.d3.e.zoom.do);

        // Sets up a white background behind graph
        self.d3.o.graph.append("rect")
            .attr("width", self.d3.c.width)
            .attr("height", self.d3.c.height)
            .attr("fill", "#FFF");

        // Sets up a vertical cursor showing current time (according to mouse position)
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
            .attr("transform", "translate(0," + (self.d3.c.height - self.d3.c.marginTopBot) + ")")
            .call(self.d3.o.xAxis);

        self.d3.o.yAxisComp = self.d3.o.svg.append("g")
            .attr("class", "yaxis")
            .attr("transform", "translate(" + self.d3.c.marginSide + ",0)")
            .call(self.d3.o.yAxis);

        // Sets up a list of svg Path representing curves (will be filled up during draw phase)
        self.d3.o.curves = [];

        // Sets up a list of svg Path representing flags (vertical/horizontal or dot marks)
        self.d3.o.flags = [];

        // Sets up a list of label for previously declared flags list
        self.d3.o.flagsLabel = [];

        // Closest points highlighting
        self.d3.o.focusDots = [];
        self.curData.forEach(function () {
            self.d3.o.focusDots.push(
                self.d3.o.graph.append("circle")
                    .attr("cx", 0)
                    .attr("cy", 0)
                    .attr("r", 3)
                    .attr("stroke", "none")
                    .attr("fill", "none")
                    .style("pointer-events", "none"));
        });
    }

    /**
     * Restore initial state of VizTool (zooming and aggregation level if necessary)
     * @param switchingMode
     */
    resetZoom(switchingMode = false) {
        const self = this;
        // Check if viztool needs to be fully reloaded or only zoomed-out
        if (self.resampled) {
            // Break all pending request
            self.ajaxRq.forEach(function (rq) {
                rq.abort();
            });
            self.ajaxRq.length = 0;

            // Reload everything
            self.showLoading();
            self.curData = JSON.parse(JSON.stringify(self.initialData));
            self.computeScales(true);
            self.render();
        } else {
            self.computeScales(true);
            if (switchingMode) {
                self.render();
            } else {
                self.quickUpdate();
            }
        }
    }

    /**
     * Sets up a loading screen on VizTool, blocking interaction and inviting user to wait completion
     * @param opacity the opacity of the loading background
     * @param rgbcolor the color of the loading background
     */
    showLoading(opacity = "0.5", rgbcolor = "125,125,125") {
        const self = this;
        self.isLoading = true;
        this.d3.o.loader = this.d3.o.graph.append("g");
        this.d3.o.loader.append("rect")
            .attr("width", "100%")
            .attr("height", "100%")
            .attr("fill", "rgba(" + rgbcolor + "," + opacity + ")")
            .style("pointer-events", "all");
        this.d3.o.loader.append("image")
            .attr("xlink:href", "../../../icons/loading-gears.gif")
            .attr("x", self.d3.c.width / 2 - 25 - self.d3.c.marginSide)
            .attr("y", self.d3.c.height / 2 - 25 - self.d3.c.marginTopBot)
            .attr("width", "50px")
            .attr("height", "50px")
            .style("pointer-events", "all");

        // Hide tooltip
        self.d3.o.tooltip.style("opacity", 0);
    }

    /**
     * Make a quick redraw of VizTool, not collecting Data but just updating rendering.
     * @param update transition duration
     */
    quickUpdate(duration = 300) {
        const self = this;

        // Remove potential loader
        if (this.d3.o.loader && !this.d3.o.loader.empty()) {
            this.d3.o.loader.remove();
        }
        // Re compute axises
        self.d3.o.xAxisComp
            .transition().duration(duration)
            .call(self.d3.o.xAxis);
        self.d3.o.yAxisComp
            .transition().duration(duration)
            .call(self.d3.o.yAxis);

        // Redraw visible curves
        self.d3.o.curves.forEach(function (curve, index) {
            if (self.d3.visibleCurves[index]) {
                const line = d3.line()
                    .x(function (d, i) {
                        if (self.d3.t.align) {
                            return (self.d3.t.timeScale(self.curData[index].data_points.timestamps[i] - self.curData[index].meta.start_date) - self.d3.c.marginSide);
                        } else {
                            return (self.d3.t.timeScale(self.curData[index].data_points.timestamps[i]) - self.d3.c.marginSide);
                        }
                    })
                    .y(function (d, i) {
                        return self.d3.t.valueScale(self.curData[index].data_points.values[i]) - self.d3.c.marginTopBot;
                    });
                curve.transition()
                    .attr("stroke", self.colorPalette[index])
                    .attr("d", line)
                    .transition()
                    .duration(duration)
                    .style("opacity", "1.00");

            } else {
                curve.transition()
                    .duration(duration)
                    .style("opacity", "0.00")
                    .transition()
                    .attr("stroke", "none");
            }
        });

        if (self.flags) {
            self.d3.o.flags.forEach(function (flag, index) {
                let curFlagData = self.flags[index];
                let curLabel = self.d3.o.flagsLabel[index];
                switch (curFlagData.type) {
                    case self.d3.c.FLAG_DIRECTIONS.vertical :
                        flag.transition()
                            .duration(duration)
                            .attr("x1", self.d3.t.timeScale(curFlagData.timestamp) - (self.d3.c.marginSide))
                            .attr("x2", self.d3.t.timeScale(curFlagData.timestamp) - (self.d3.c.marginSide));
                        curLabel.transition()
                            .duration(duration)
                            .attr("transform", "rotate(90," +
                                (self.d3.t.timeScale(curFlagData.timestamp) - (self.d3.c.marginSide) + self.d3.c.flagLabelShift) +
                                "," + self.d3.c.flagLabelShift + ")")
                            .attr("x", self.d3.t.timeScale(curFlagData.timestamp) - (self.d3.c.marginSide) + self.d3.c.flagLabelShift)
                            .attr("y", self.d3.c.flagLabelShift);
                        break;
                    case self.d3.c.FLAG_DIRECTIONS.horizontal :
                        flag.transition()
                            .duration(duration)
                            .attr("y1", self.d3.t.valueScale(curFlagData.value) - (self.d3.c.marginTopBot))
                            .attr("y2", self.d3.t.valueScale(curFlagData.value) - (self.d3.c.marginTopBot));
                        curLabel.transition()
                            .duration(duration)
                            .attr("x", self.d3.c.flagLabelShift)
                            .attr("y", self.d3.t.valueScale(curFlagData.value) - (self.d3.c.marginTopBot) - self.d3.c.flagLabelShift);
                        break;
                    case self.d3.c.FLAG_DIRECTIONS.dot :
                        flag.transition()
                            .duration(duration)
                            .attr("cx", self.d3.t.timeScale(curFlagData.timestamp) - self.d3.c.marginSide)
                            .attr("cy", self.d3.t.valueScale(curFlagData.value) - self.d3.c.marginTopBot)
                            .attr("r", "2");
                        curLabel.transition()
                            .duration(duration)
                            .attr("x", self.d3.t.timeScale(curFlagData.timestamp) - self.d3.c.marginSide + self.d3.c.flagLabelShift)
                            .attr("y", self.d3.t.valueScale(curFlagData.value) - self.d3.c.marginTopBot + self.d3.c.flagLabelShift);
                        break;
                    default :
                        // Handle badly formatted flag
                        console.warn("Invalid flag have been ignored.");
                }
            });
        }

        // Update tooltip in order to show or hide lines (regarding curve visibility)
        self.d3.tooltipLines.forEach(function (line, index) {
            if (self.d3.visibleCurves[index]) {
                line.style("display", "block");
            } else {
                line.style("display", "none");
            }
        });

        // Update legend in order to show or hide lines (regarding curve visibility)
        self.d3.legendLines.forEach(function (line, index) {
            if (self.d3.visibleCurves[index]) {
                line.style("color", self.colorPalette[index]);
            } else {
                line.style("color", "#CCC");
            }
        });
    }

    /**
     * Initialize d3 events behaviours
     */
    initD3Events() {
        const self = this;

        // ZOOM behavior
        self.d3.e.zoom = {
            originSelectPoint: {},
            enabled: true
        };
        self.d3.e.zoom.do = d3.drag()
            .on("start", function () {
                // Keep trace of the origin of the drag
                self.d3.e.zoom.originSelectPoint.x = d3.event.x;
                self.d3.e.zoom.originSelectPoint.y = d3.event.y;
                self.d3.e.zoom.enabled = !self.isLoading && !self.d3.t.align;
                self.d3.o.focusDots.forEach(function (dot) {
                    dot.attr("fill", "none");
                });
                self.d3.o.tooltip.style("opacity", 0);
                self.d3.o.vertCursor
                    .attr("stroke", "none");
            })
            // Display a selection rectangle over graph while dragging
            .on("drag", function () {
                if (self.d3.e.zoom.enabled) {
                    //check if the selection is vertical or horizontal
                    const dx = d3.event.x - self.d3.e.zoom.originSelectPoint.x;
                    const dy = d3.event.y - self.d3.e.zoom.originSelectPoint.y;
                    if (Math.abs(dx) > Math.abs(dy)) {
                        // Vertical selection
                        if (dx < 0) {
                            self.d3.o.selectionBar
                                .attr("x", self.d3.e.zoom.originSelectPoint.x + dx)
                                .attr("y", 0)
                                .attr("width", Math.abs(dx))
                                .attr("height", self.d3.c.height);
                        } else {
                            self.d3.o.selectionBar
                                .attr("x", self.d3.e.zoom.originSelectPoint.x)
                                .attr("y", 0)
                                .attr("width", dx)
                                .attr("height", self.d3.c.height);
                        }
                    } else {
                        // Horizontal selection
                        if (dy < 0) {
                            self.d3.o.selectionBar
                                .attr("y", self.d3.e.zoom.originSelectPoint.y + dy)
                                .attr("x", 0)
                                .attr("width", self.d3.c.width)
                                .attr("height", Math.abs(dy));
                        } else {
                            self.d3.o.selectionBar
                                .attr("y", self.d3.e.zoom.originSelectPoint.y)
                                .attr("x", 0)
                                .attr("width", self.d3.c.width)
                                .attr("height", dy);
                        }
                    }
                }
            })
            // If the drag was consistent (not a click), rescale the graph according to selection
            .on("end", function () {
                if (self.d3.e.zoom.enabled) {
                    // Reset selection rectangle
                    self.d3.o.selectionBar
                        .attr("width", 0)
                        .attr("height", 0);

                    const dx = d3.event.x - self.d3.e.zoom.originSelectPoint.x;
                    const dy = d3.event.y - self.d3.e.zoom.originSelectPoint.y;
                    if (dx !== 0 || dy !== 0) {
                        if (Math.abs(dx) > Math.abs(dy)) {
                            self.timeZoomState = [
                                self.d3.t.timeScale.invert(Math.min(d3.event.x, self.d3.e.zoom.originSelectPoint.x) + self.d3.c.marginSide),
                                self.d3.t.timeScale.invert(Math.max(d3.event.x, self.d3.e.zoom.originSelectPoint.x) + self.d3.c.marginSide)
                            ];
                            // Time scale
                            self.d3.t.timeScale.domain(self.timeZoomState);
                            // Operate an Horizontal zoom and then call new data (if necessary)
                            self.quickUpdate();

                            if (self.resampled) {
                                self.showLoading(0.3, "120,120,120");
                                // Wait the end of zoom animation, then re-collect data
                                setTimeout(function () {
                                    // Collect new data :
                                    const domain = self.d3.t.timeScale.domain();
                                    self.collectData(domain[0], domain[1]).then(function () {
                                        self.drawFlags();
                                        self.drawCurves();
                                        self.isLoading = false;
                                    });
                                }, 400);
                            }
                        } else {
                            // Value scale
                            self.d3.t.valueScale.domain([
                                self.d3.t.valueScale.invert(
                                    Math.max(d3.event.y, self.d3.e.zoom.originSelectPoint.y) + self.d3.c.marginTopBot),
                                self.d3.t.valueScale.invert(
                                    Math.min(d3.event.y, self.d3.e.zoom.originSelectPoint.y) + self.d3.c.marginTopBot)
                            ]);

                            // Operate a vertical zoom
                            self.quickUpdate();
                        }
                    }
                }
            });

        // PAN Descriptor
        self.d3.e.pan = {
            // Origin point of the drag (converted to timestamps)
            originPointX: null,
            // Current time shift during pan interaction (in timestamp)
            XShift: null,
            // Origin point of the drag (converted to timestamps)
            originPointY: null,
            // Current time shift during pan interaction (in timestamp)
            YShift: null,
            // Instances of scales (permits avoiding side effect due to scale changing)
            keepX: null,
            keepY: null,
            // State of pan behavior (should not be enabled when interface is loading)
            enabled: true
        };

        // PAN behavior
        self.d3.e.pan.do = d3.drag()
            .on("start", function () {
                self.d3.e.pan.keepX = self.d3.t.timeScale.copy();
                self.d3.e.pan.originPointX = self.d3.e.pan.keepX.invert(d3.event.x);
                self.d3.e.pan.keepY = self.d3.t.valueScale.copy();
                self.d3.e.pan.originPointY = self.d3.e.pan.keepY.invert(d3.event.y);
                self.d3.e.pan.enabled = !self.isLoading && !self.d3.t.align;
                self.d3.o.focusDots.forEach(function (dot) {
                    dot.attr("fill", "none");
                });
                self.d3.o.tooltip.style("opacity", 0);
                self.d3.o.vertCursor
                    .attr("stroke", "none");
            })
            .on("drag", function () {
                if (self.d3.e.pan.enabled) {
                    self.d3.e.pan.XShift = self.d3.e.pan.originPointX - self.d3.e.pan.keepX.invert(d3.event.x);
                    self.d3.t.timeScale.domain([
                        self.d3.e.pan.keepX.domain()[0] + self.d3.e.pan.XShift,
                        self.d3.e.pan.keepX.domain()[1] + self.d3.e.pan.XShift
                    ]);
                    self.d3.e.pan.YShift = self.d3.e.pan.originPointY - self.d3.e.pan.keepY.invert(d3.event.y);
                    self.d3.t.valueScale.domain([
                        self.d3.e.pan.keepY.domain()[0] + self.d3.e.pan.YShift,
                        self.d3.e.pan.keepY.domain()[1] + self.d3.e.pan.YShift
                    ]);
                    self.quickUpdate(0);
                }
            })
            .on("end", function () {
                if (self.d3.e.pan.enabled) {
                    // Refresh points
                    // Collect data again if necessary

                    // Get min and max timestamp
                    const minTimestamp = Math.min(...self.curData.map(function (line) {
                        return line.meta.start_date;
                    }));
                    const maxTimestamp = Math.max(...self.curData.map(function (line) {
                        return line.meta.end_date;
                    }));

                    // Check if visualized window is included between min and max timestamps
                    if ((minTimestamp > self.d3.t.timeScale.domain()[0] || maxTimestamp < self.d3.t.timeScale.domain()[1]) && self.resampled) {
                        self.showLoading(0.3, "120,120,120");
                        self.collectData(self.d3.t.timeScale.domain()[0], self.d3.t.timeScale.domain()[1]).then(function () {
                                self.drawFlags();
                                self.drawCurves();
                                self.isLoading = false;
                            }
                        );
                    }
                    self.d3.e.pan.originPointX = null;
                    self.d3.e.pan.keepX = null;
                }
            });

        // Keyboard listeners, permits switching between pan and zoom behaviours
        d3.select("body")
            .on("keydown", function () {
                if (d3.event.shiftKey) {
                    self.d3.o.graph.call(self.d3.e.pan.do);
                }
            })
            .on("keyup", function () {
                if (!d3.event.shiftKey) {
                    self.d3.o.graph.call(self.d3.e.zoom.do);
                }
            });
    }

    /**
     * Draw flags according to their types
     */
    drawFlags() {
        const self = this;
        if (self.flags) {
            // Remove potential old flags
            self.d3.o.flags.forEach(function (flag, index) {
                flag.remove();
                self.d3.o.flagsLabel[index].remove();
            });
            // Reset stacks of flags and flags label
            self.d3.o.flags.length = 0;
            self.d3.o.flagsLabel.length = 0;

            // Render and stack flags
            // render a line if flag is vertical or horizontal
            // render a circle if flag is a dot
            self.flags.forEach(function (flag, index) {
                // Prepare svg component for flag
                switch (flag.type) {
                    case "vertical":
                        self.d3.o.flags.push(
                            self.d3.o.graph.append("line")
                                .attr("x1", self.d3.t.timeScale(flag.timestamp) - (self.d3.c.marginSide))
                                .attr("y1", 0)
                                .attr("x2", self.d3.t.timeScale(flag.timestamp) - (self.d3.c.marginSide))
                                .attr("y2", self.d3.c.height)
                        );
                        self.d3.o.flagsLabel.push(
                            self.d3.o.graph.append("text")
                                .attr("x", self.d3.t.timeScale(flag.timestamp) - (self.d3.c.marginSide) + self.d3.c.flagLabelShift)
                                .attr("y", self.d3.c.flagLabelShift)
                                .attr("transform", "rotate(90," +
                                    (self.d3.t.timeScale(flag.timestamp) - (self.d3.c.marginSide) + self.d3.c.flagLabelShift) + "," + self.d3.c.flagLabelShift + ")")
                        );
                        break;
                    case "horizontal" :
                        self.d3.o.flags.push(
                            self.d3.o.graph.append("line")
                                .attr("x1", 0)
                                .attr("y1", self.d3.t.valueScale(flag.value) - (self.d3.c.marginTopBot))
                                .attr("x2", self.d3.c.width)
                                .attr("y2", self.d3.t.valueScale(flag.value) - (self.d3.c.marginTopBot))
                        );
                        self.d3.o.flagsLabel.push(
                            self.d3.o.graph.append("text")
                                .attr("x", self.d3.c.flagLabelShift)
                                .attr("y", self.d3.t.valueScale(flag.value) - (self.d3.c.marginTopBot) - self.d3.c.flagLabelShift)
                        );
                        break;
                    case "dot" :
                        self.d3.o.flags.push(
                            self.d3.o.graph.append("circle")
                                .attr("cx", self.d3.t.timeScale(flag.timestamp) - self.d3.c.marginSide)
                                .attr("cy", self.d3.t.valueScale(flag.value) - self.d3.c.marginTopBot)
                                .attr("r", "2")
                        );
                        self.d3.o.flagsLabel.push(
                            self.d3.o.graph.append("text")
                                .attr("x", self.d3.t.timeScale(flag.timestamp) - self.d3.c.marginSide + self.d3.c.flagLabelShift)
                                .attr("y", self.d3.t.valueScale(flag.value) - self.d3.c.marginTopBot + self.d3.c.flagLabelShift)
                        );
                        break;
                    default :
                        self.d3.o.flags.push(null);
                        self.d3.o.flagsLabel.push(null);
                }
                // Paint flag
                if (self.d3.o.flags[index]) {
                    self.d3.o.flags[index]
                        .attr("stroke", self.d3.c.flagsColor);
                }
                // Paint flag label
                if (self.d3.o.flagsLabel[index]) {
                    self.d3.o.flagsLabel[index]
                        .attr("fill", self.d3.c.flagsColor)
                        .text(flag.label);
                }
            });
        }
    }

    /**
     * Compute coordinates and draw curves representing data
     */
    drawCurves() {
        const self = this;

        // Remove potential loader
        if (self.d3.o.loader && !self.d3.o.loader.empty()) {
            self.d3.o.loader.remove();
        }
        // Remove potential old curves
        self.d3.o.curves.forEach(function (curve) {
            curve.remove();
        });
        self.d3.o.curves.length = 0;
        self.curData.forEach(function (dataLine, lineIndex) {
            const line = d3.line()
                .x(function (d, i) {
                    if (self.d3.t.align) {
                        return (self.d3.t.timeScale(dataLine.data_points.timestamps[i] - dataLine.meta.start_date) - self.d3.c.marginSide);
                    } else {
                        return (self.d3.t.timeScale(dataLine.data_points.timestamps[i]) - self.d3.c.marginSide);
                    }
                })
                .y(function (d, i) {
                    return (self.d3.t.valueScale(dataLine.data_points.values[i]) - self.d3.c.marginTopBot);
                });
            self.d3.o.curves.push(
                self.d3.o.graph.append("path")
                    .datum(dataLine.data_points.timestamps)
                    .attr("d", line)
                    .attr("stroke", function () {
                        if (self.d3.visibleCurves[lineIndex]) {
                            // Check if palette contains pre-defined colors
                            if (lineIndex < self.colorPalette.length) {
                                return self.colorPalette[lineIndex];
                            } else {
                                // Generate a random color and save it to the palette
                                const color = "#" + ((1 << 24) * Math.random() | 0).toString(16);
                                self.colorPalette.push(color);
                                return color;
                            }
                        } else {
                            return "none";
                        }
                    })
                    .attr("fill", "none")
                    .attr("stroke-width", "1px")
                    .style("opacity", "1.00")
            );
        });
    }

    /**
     * Compute initial zoom scales
     * @param updateMode Whether the compute should replace (when false) or update scales (when true)
     */
    computeScales(updateMode) {
        const self = this;

        // Compute min and max values for scale
        const maxValue = Math.max.apply(null, self.curData.map(function (line) {
            return Math.max.apply(null, line.data_points.values);
        }));

        const minValue = Math.min.apply(null, self.curData.map(function (line) {
            return Math.min.apply(null, line.data_points.values);
        }));

        // Compute min and max timestamps for scale
        let minTimestamp = Math.min(...self.curData.map(function (line) {
            return line.meta.start_date;
        }));

        let maxTimestamp = Math.max(...self.curData.map(function (line) {
            return line.meta.end_date;
        }));

        if (maxTimestamp - minTimestamp <= 1) {
            minTimestamp -= 1000;
            maxTimestamp += 1000;
        }

        self.timeZoomState = [minTimestamp, maxTimestamp];

        if (updateMode) {
            // Sets up a D3 scale for time (will be used as horizontal)
            self.d3.t.timeScale
            // Timestamp range
                .domain([minTimestamp, maxTimestamp]);

            // Sets up a D3 scale for values (will be used as vertical)
            self.d3.t.valueScale
            // Value range
                .domain([minValue - (0.1 * maxValue), 1.1 * maxValue]);
        } else {
            // Sets up a D3 scale for time (will be used as horizontal)
            self.d3.t.timeScale = d3.scaleLinear()
            // Timestamp range
                .domain([minTimestamp, maxTimestamp])
                // Display range
                .range([(self.d3.c.marginSide), (self.d3.c.width - self.d3.c.marginSide)]);

            // Sets up a D3 scale for values (will be used as vertical)
            self.d3.t.valueScale = d3.scaleLinear()
            // Value range
                .domain([minValue - (0.1 * maxValue), 1.1 * maxValue])
                // Display range
                .range([(self.d3.c.height - self.d3.c.marginTopBot), (self.d3.c.marginTopBot)]);
        }
    }

    /**
     * Compute initial zoom scales for aligned mode
     */
    computeAlignScales() {
        // Get longest series (over time)
        const self = this;
        // longest duration (milliseconds)
        let maxDuration = 0;
        self.curData.forEach(function (datum) {
            maxDuration = Math.max(maxDuration, datum.meta.end_date - datum.meta.start_date);
        });
        self.d3.t.timeScale
            .domain([0, maxDuration]);
    }

    /**
     * Wake up (Restore) the VizTool.
     */
    wakeUp() {
        const self = this;
        // Only re render VizTool (should be super fast)
        self.render();
    }

    /**
     * Make the viztool sleep : abort all pending requests
     */
    sleep() {
        const self = this;
        // Abort all
        self.ajaxRq.forEach(function (rq) {
            rq.abort();
        });
        self.ajaxRq.length = 0;
    }

    /**
     * Collect useful data (downsampled if needed)
     *
     * @param start start of the time window to display (ms timestamp)
     * @param end end of the time window to display (ms timestamp)
     *
     * @return {Promise} succeeding if all data is collected
     */
    collectData(start, end) {
        const self = this;
        self.curData.length = 0;
        return new Promise(function (resolve) {
            // Keep track of downsampled timeseries for information display
            const downsampledTS = [];
            self.data.forEach(function (datum) {
                const dataLine = {
                    "funcId": datum.funcId
                };
                self.curData.push(dataLine);

                // Down-sampling period
                let dp = null;
                let meta = {};

                // Get points within defined range
                if (start && end) {

                    const total_period = Math.abs(end - start);

                    // Calculate dp considering data + out of range and the current number of TS
                    dp = (self.RANGE_OUT + 1) * total_period / (self.MAX_RAW_POINTS / self.data.length);

                    // Get start date, calculated according out of range data rate
                    meta.start_date = start - total_period * (self.RANGE_OUT) / 2;

                    // Get end date, calculated according out of range data rate
                    meta.end_date = end + total_period * (self.RANGE_OUT) / 2;

                    dataLine.meta = meta;

                    // Check potential invalidation of dp
                    try {
                        // If qual ref period is defined, use it to check dp consistency
                        const qual_ref_period = parseInt(getMd(self.data.metas, datum.tsuid, "qual_ref_period"), 10);
                        // All points fit in the display, downsampling not needed
                        if (total_period <= qual_ref_period) {
                            dp = null;
                        }
                    } catch (e) {
                        // Else, get nbPoints from OpenTSDB
                        // Get nb points into time window
                        console.warn("qual_ref_period metadata not available for " + datum.tsuid + "(" + datum.funcId + "). Computing nb_points (slower)");
                        const nb_points = ikats.api.ts.nbPoints({
                            tsuid: datum.tsuid,
                            sd: start,
                            ed: end
                        }).data;

                        // All points fit in the display, downsampling not needed
                        if (nb_points <= self.MAX_RAW_POINTS) {
                            dp = null;
                        }
                    }
                }
                // No date provided, get full range points based on metadata
                else {
                    // Get nb points from metadata
                    meta.nb_points = parseInt(getMd(self.data.metas, datum.tsuid, "qual_nb_points"), 10);

                    // Get start date from metadata
                    meta.start_date = parseInt(getMd(self.data.metas, datum.tsuid, "ikats_start_date"), 10);

                    // Get end date from metadata
                    meta.end_date = parseInt(getMd(self.data.metas, datum.tsuid, "ikats_end_date"), 10);

                    if (meta.start_date === meta.end_date) {
                        meta.end_date += 1;
                    }

                    dataLine.meta = meta;

                    if (meta.nb_points > self.MAX_RAW_POINTS / self.data.length) {
                        self.resampled = true;
                        // Calculate aggregation :
                        const total_period = Math.abs(meta.end_date - meta.start_date);
                        dp = total_period / (self.MAX_RAW_POINTS / self.data.length);
                    }

                }

                // Keep information about downsampling
                if (dp) {
                    downsampledTS.push($.extend({"dp": dp}, datum));
                }

                self.ajaxRq.push(ikats.api.ts.read({
                    tsuid: datum.tsuid,
                    async: true,
                    da: dp && "avg" || null,
                    dp: dp,
                    sd: meta.start_date,
                    ed: meta.end_date,
                    md: self.data.metas,
                    success: function (ts_points) {
                        dataLine.data_points = {
                            timestamps: [],
                            values: []
                        };

                        // Extract data points from data returned
                        for (let current_timestamp in ts_points.data) {
                            dataLine.data_points.timestamps.push(parseInt(current_timestamp, 10));
                            dataLine.data_points.values.push(ts_points.data[current_timestamp]);
                        }
                    },
                    error: function (e) {
                        notify().error(" Details : " + e, "Error : Could not get data for TS " + datum.funcId);
                        console.error(e);
                    }
                }));
            });

            jQuery.when(...self.ajaxRq).done(function () {
                // Remove pending requests from stack
                self.ajaxRq.length = 0;
                console.info(downsampledTS.length + " TS downsampled", downsampledTS);
                resolve();
            });
        });
    }


    /**
     * Build confirmation modal with JQuery
     */
    buildModal() {
        const self = this;
        $("#" + self.container + "_algoConfirmCut").remove();
        $("#body").append(
            `<div class='modal fade' id='${self.container}_algoConfirmCut' tabindex='-1' role='dialog' aria-labelledby='wfLoadModalTitle'>
                <div class='modal-dialog' role='document'>
                    <div class='modal-content'>
                        <div class='modal-header'>
                            <button type='button' class='close' data-dismiss='modal' aria-label='Close'>
                                <span aria-hidden='true'>&times;</span>
                            </button>
                            <h4 class='modal-title' id='wfLoadModalTitle'>Assisted TS cut</h4>
                        </div>
                        <div class='modal-body'>
                            <div class='row'>
                                <div class='col-xs-12'>
                                    <label> Confirm creation of a new time series with : </label>
                                </div>
                            </div>
                            <div class='row' style='padding-top:10px'>
                                <div class='col-xs-3'></div>
                                <div class='col-xs-2' style='top:5px;'>
                                    <label>Start date</label>
                                </div>
                                <div class='col-xs-4'>
                                    <input type='text' id='${self.container}_start_input_cut' class='form-control' placeholder='...'
                                           value='${new Date(self.timeZoomState[0]).toISOString()}' style='width:220px'> </input>
                                </div>
                            </div>
                            <div class='row' style='padding-top:10px'>
                                <div class='col-xs-3'></div>
                                <div class='col-xs-2' style='top:5px;'>
                                   <label>End date</label>
                                </div>
                                <div class='col-xs-4'>
                                    <input type='text' id='${self.container}_end_input_cut' class='form-control' placeholder='...'
                                           value='${new Date(self.timeZoomState[1]).toISOString()}' style='width:220px'> </input>
                                </div>
                            </div>
                            <div class='row' style='padding-top:10px'>
                                <div class='col-xs-3'></div>
                                <div class='col-xs-2' style='top:5px;'>
                                   <label>Functional Identifier</label>
                                </div>
                                <div class='col-xs-4'>
                                    <input type='text' id='${self.container}_fid_input_cut' class='form-control' placeholder='(optional)'
                                           value='' style='width:220px'> </input>
                                </div>
                            </div>
                            <div class='row' style='padding-top:10px'>
                                <div class='col-xs-12'>
                                    <a id='${self.container}_confirm_save_cut' class='btn btn-default' style='float:right'>Save as a new TS</a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `);
        $("#" + self.container + "_confirm_save_cut")
            .on("click", function () {
                self.operateCut();
            });
        $("#" + self.container + "_algoConfirmCut").modal("show");
    }

    /**
     * Set up options for the cut TS according to what was captured in fields
     */
    operateCut() {
        const self = this;
        const sd = new Date($("#" + this.container + "_start_input_cut").val()).getTime();
        const ed = new Date($("#" + this.container + "_end_input_cut").val()).getTime();
        const fid = $("#" + this.container + "_fid_input_cut").val();
        this.cutTS(sd, ed, self.data[0].tsuid, fid);
    }

    /**
     * Calls Cut_TS algo with given options
     * @param sd start date of the cut to operate
     * @param ed end date of the cut to operate
     * @param tsuid Internal unique identifier of the TS to cut
     * @param fid Functional identifier to use for the new TS
     */
    cutTS(sd, ed, tsuid, fid) {
        const self = this;
        ikats.api.op.list({
            async: true,
            success: function (op_list) {
                const cut_ts_op_id = $.grep(op_list.data, function (op) {
                    return op.name === "cut_ts";
                })[0].id;
                ikats.api.op.run({
                    async: true,
                    op_id: cut_ts_op_id,
                    args: {
                        sd: sd,
                        ed: ed,
                        nb_points: null,
                        fid: fid,
                        tsuid: tsuid
                    },
                    success: function (request) {
                        const timer = setInterval(function () {
                            const r = ikats.api.op.status(request.data.pid);
                            if (r.status) {
                                switch (r.data.status) {
                                    case "INIT":
                                    case "RUN":
                                        break;
                                    case "ALGO_OK":
                                        // Filling results
                                        const results = ikats.api.op.results(request.data.pid).data;
                                        const rid = results[0].rid;
                                        const newTs = ikats.api.op.result(rid).data;
                                        notify().info("FuncID : " + newTs.funcId, "TS created : ", {
                                            timeOut: 10000,
                                            tapToDismiss: false,
                                            extendedTimeOut: 5000
                                        });
                                        console.info("New TS created with FID: " + newTs.funcId);
                                        clearInterval(timer);
                                        break;
                                    // case "ALGO_KO":
                                    // case "ENGINE_KO":
                                    default:
                                        notify().error("Could not cut the TS, contact an administrator", "Error :");
                                        clearInterval(timer);
                                        break;
                                }
                            }
                        }, 1000);
                    },
                    error: function () {
                        notify().error("Could not run cut_ts algo", "Error :");
                    }
                });
            },
            error: function () {
                notify().error("Could not retrieve cut_ts algorithm", "Error :");
            },
            complete: function () {
                $("#" + self.container + "_algoConfirmCut").modal("hide");
            }
        });

        notify().info("Saving an extract of the visible TS to a new TS", "Creating new TS");

    }
}

