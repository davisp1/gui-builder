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
 * Display a scatterplot for a list of 2 TS.
 *
 * When data contains 2 TS, only display the scatter plot.
 * Otherwise, a panel allows to choose which TS to use for plotting.
 *
 * @constructor
 * @param {string} container - the ID of the injected div
 * @param {Object} data - the list of TSUID with their functional identifier
 * @param {Array} callbacks - the list of the callbacks used by Viz
 */
class ScatterPlot extends VizTool {
    constructor(container, data, callbacks) {

        // Call super-class constructor
        super(container, data, callbacks);

        this.name = "ScatterPlot";

        // Configuration of the display
        this.config = {
            displayForm: data.length > 2, // Display form only when data contains more than 2 TS
            point: {
                size: 2, // Radius of the point
                color: "#337AB7" // Color of the point
            },
            highlightPoint: {
                size: 5, // Radius of the point when highlighted
                color: "#ded872" // Color of the point when highlighted
            },
            highlightLine: {
                color: "#7F7F7F" // Color of the horizontal line when highlighted
            },
            tooltip: {
                bgcolor: "#33b9f8", // Background color of the tooltip,
                color: "#FFFFFF", // Foreground color of the tooltip,
                opacity: 0.9 // Transparency of the tooltip
            }
        };

        // List of TSUID
        this.tsuidList = this.data;
        this.fidList = {};
        if (typeof(this.data[0]) !== "string") {
            // This is a ts_list type (with tsuid and funcId), extract tsuid list
            this.tsuidList = this.data.map(x => x.tsuid);
            // Define the mapping to get Functional Identifier
            this.data.forEach(x => this.fidList[x.tsuid] = x.funcId);
        }
        else {
            // Request to get Functional Identifiers
            const fid_results = ikats.api.ts.fid({tsuid_list: this.tsuidList}).data;
            fid_results.forEach(x => this.fidList[x.tsuid] = x.funcId);
        }

        // Stack all pending API calls
        this.ajaxRq = [];

        // Metadata list
        this.md_list = [];

        // Contains the values to display among X and Y axises
        this.datapoints = {
            X: [],
            Y: []
        };

        // List of selected TS for display among X and Y axises
        this.selectedTS = {};
        this.selectedTS.X = this.tsuidList[0];
        let yIndex = 1;
        if (this.tsuidList.length === 1) {
            yIndex = 0;
        }
        this.selectedTS.Y = this.tsuidList[yIndex];

        // D3 specific information
        this.d3 = {
            // Objects
            o: {},
            // Constants default values
            c: {
                width: 500,
                height: 500,
                yAxisWidth: 50,
                xAxisHeight: 25
            },
            // Transformations
            t: {}
        };

    }

    /**
     * Display the VizTool :
     * - initialize the viztool information
     * - Get the metadata for the TS list
     * - collect and format the data (then render the viztool)
     */
    display() {
        const self = this;

        // Initialize the layout and sub components
        this.init();

        console.time("Metadata gathering duration");

        // Get the metadata list
        ikats.api.md.read({
            ts_list: this.tsuidList,
            async: true,
            success: function (data) {
                self.md_list = data.data;
                self.getData();
            },
            error: function () {
                self.callbacks.toastr.error("Can't get metadata for these TS");
            },
            complete: function () {
                console.timeEnd("Metadata gathering duration");
            }
        });
    }

    /**
     * Wake up (Restore) the VizTool.
     */
    wakeUp() {
        // Initialize the layout and sub components
        this.init();
        // Data are already known, just redraw them
        this.redraw();
    }

    /**
     * Persist the VizTool for a quick restoration.
     */
    sleep() {
        const self = this;
        // Abort all pending/running requests
        self.ajaxRq.forEach(function (rq) {
            rq.abort();
        });
        self.ajaxRq.length = 0;
    }


    /**
     * Get the data from the database for both selected TS
     */
    getData() {

        console.time("Data gathering duration");

        const self = this;

        self.loadingVisible(true);

        // Shorten the fid information (many uses)
        const fidX = self.fidList[self.selectedTS.X];
        const fidY = self.fidList[self.selectedTS.Y];

        // Request the points of the X series
        self.ajaxRq.push(ikats.api.ts.read({
            tsuid: self.selectedTS.X,
            async: true,
            md: self.md_list,
            success: function (data) {
                // Clean old points
                self.datapoints.X = [];
                // Extract data points from data returned
                Object.keys(data.data).map(timestamp => self.datapoints.X.push(data.data[timestamp]));
                self.logger("info", self.datapoints.X.length + " points retrieved from " + fidX);
            },
            error: function (e) {
                self.logger("error", "Couldn't get points for " + fidX);
                self.callbacks.toastr.error(" Details : " + e, "Error : Could not get data for TS " + fidX);
                console.error(e);
            }
        }));

        // Request the points of the Y series
        self.ajaxRq.push(ikats.api.ts.read({
            tsuid: self.selectedTS.Y,
            async: true,
            md: self.md_list,
            success: function (data) {
                // Clean old points
                self.datapoints.Y = [];
                // Extract data points from data returned
                Object.keys(data.data).map(timestamp => self.datapoints.Y.push(data.data[timestamp]));
                self.logger("info", self.datapoints.Y.length + " points retrieved from " + fidY);
            },
            error: function (e) {
                self.logger("error", "Couldn't get points for " + fidY);
                self.callbacks.toastr.error(" Details : " + e, "Error : Could not get data for TS " + fidY);
                console.error(e);
            }
        }));

        jQuery.when(...self.ajaxRq).done(function () {
            // Remove pending requests from stack
            self.ajaxRq.length = 0;

            console.timeEnd("Data gathering duration");

            // Both series have their points, redraw the scatterplot
            self.redraw();
        });
    }

    /**
     * Initialize the layout and the sub components
     */
    init() {
        const self = this;

        // Presentation Layout
        self.layout = {};

        // Main frame, used for dimensions purposes
        self.layout.divMain = d3.select(`#${self.container}`)
            .append("div")
            .style("width", "100%")
            .attr("class", "row");


        // Layout is different according to form display flag
        if (self.config.displayForm) {
            // When form shall be displayed, the form takes 25% of the area, the chart takes 75%
            self.layout.divLeft = self.layout.divMain
                .append("div")
                .attr("class", "col-md-9");
            self.layout.divRight = self.layout.divMain
                .append("div")
                .attr("class", "col-md-3");
        }
        else {
            // When form shall not be displayed, the chart takes 100%
            self.layout.divLeft = self.layout.divMain
                .append("div")
                .attr("class", "col-md-12");
        }


        // Loading screen layout
        self.layout.loading = self.layout.divLeft.append("div");

        // Initialize all the SVG and canvas components
        this.initSvg();

        self.layout.loading
            .attr("name", "ScatterPlot_Loading")
            .style("position", "absolute")
            .style("width", self.d3.c.width)
            .style("height", self.d3.c.height)
            .classed("hidden", false);

        self.layout.loading
            .append("img")
            .attr("src", "../../../icons/loading-gears.gif")
            .style("width", "100px")
            .style("height", "100px")
            .style("position", "relative")
            .style("display", "block")
            .style("margin-left", "auto")
            .style("margin-right", "auto")
            .style("top", "50%")
            .style("transform", "translateY(-50%)");

        // Initialize the form content if requested
        if (self.config.displayForm) {
            this.initForm();
        }
    }

    /**
     * Initialize the form panel part
     */
    initForm() {
        const self = this;

        // Reference to target div for form (used many times)
        const form = self.layout.divRight;

        // Build a sorted fid list
        const fidList = Object.values(self.fidList).sort();

        // X axis combo box
        form.append("label").html("X");
        const xSelect = form.append("select")
            .attr("id", "scatterplot_Xselect")
            .attr("class", "form-control")
            .on("change", function () {
                // When a new value is selected, get the corresponding information to get the data
                self.selectedTS.X = self.data.filter(x => x.funcId === this.value)[0].tsuid;
                self.clearLog();
                self.getData();
            });
        xSelect
            .selectAll("option")
            .data(fidList).enter()
            .append("option")
            .property("selected", function (d) {
                // Select the default value (the first of the unordered list)
                return d === self.data.filter(x => x.tsuid === self.selectedTS.X)[0].funcId;
            })
            .text(function (d) {
                return d;
            });

        // Y axis combo box
        form.append("label").html("Y");
        const ySelect = form.append("select")
            .attr("id", "scatterplot_Yselect")
            .attr("class", "form-control")
            .on("change", function () {
                // When a new value is selected, get the corresponding information to get the data
                self.selectedTS.Y = self.data.filter(x => x.funcId === this.value)[0].tsuid;
                self.clearLog();
                self.getData();
            });
        ySelect
            .selectAll("option")
            .data(fidList).enter()
            .append("option")
            .property("selected", function (d) {
                // Select the default value (the second of the unordered list)
                return d === self.data.filter(x => x.tsuid === self.selectedTS.Y)[0].funcId;
            })
            .text(function (d) {
                return d;
            });

        // Action bar
        form.append("label")
            .style("padding-top", "5px")
            .style("margin-right", "5px")
            .html("Actions");
        const actionBar = form.append("div");
        // Action buttons
        // Swap
        actionBar.append("button")
            .html(`<span class="glyphicon glyphicon-sort"></span>`)
            .attr("title", "Swap X and Y")
            .attr("type", "button")
            .attr("class", "btn btn-primary btn-sm")
            .on("click", function () {
                self.swapAction();
            });

        // Show curves
        actionBar.append("button")
            .html(`<span class="glyphicon glyphicon-eye-open"></span>`)
            .attr("title", "Show curves")
            .attr("type", "button")
            .attr("class", "btn btn-primary btn-sm")
            .on("click", function () {
                const ts_list = self.data.filter(x => x.tsuid === self.selectedTS.X || x.tsuid === self.selectedTS.Y);
                self.addViz("Curve", ts_list);
            });

        // Defines a logger area
        self.loggerDiv = form.append("div")
            .style("padding-top", "5px");

    }

    /**
     * Initialize the SVG components (graph part on the left side of the layout)
     */
    initSvg() {
        const self = this;

        self.d3.o.divTitle = self.layout.divLeft.append("div");

        self.d3.o.divTitle
            .style("text-align", "center");

        const div = self.layout.divLeft.append("div");

        self.d3.c.width = div.node().getBoundingClientRect().width - 20;

        const displayWidth = self.d3.c.width - self.d3.c.yAxisWidth;
        const displayHeight = self.d3.c.height - self.d3.c.xAxisHeight;

        // SVG area
        self.d3.o.svg = div.append("svg")
            .style("position", "absolute")
            .attr("name", "ScatterPlot_svg")
            .attr("width", self.d3.c.width)
            .attr("height", self.d3.c.height)
            .append("g");

        // Factory used to get nearest point from mouse position
        self.d3.o.factory = d3.geom.quadtree();

        // Horizontal Scale
        self.d3.t.scaleX = d3.scaleLinear()
            .range([0, displayWidth]);

        // Vertical Scale
        self.d3.t.scaleY = d3.scaleLinear()
            .range([displayHeight, 0]);

        // Horizontal axis
        self.d3.o.xAxis = d3.axisBottom(self.d3.t.scaleX)
            .ticks(10);

        // Vertical axis
        self.d3.o.yAxis = d3.axisLeft(self.d3.t.scaleY)
            .ticks(10);

        // Group containing X axis
        self.d3.o.xg = self.d3.o.svg.append("g")
            .attr("name", "ScatterPlot_xg")
            .style("height", self.d3.c.xAxisHeight)
            .style("fill", "none")
            .style("stroke", "#000")
            .style("stroke-width", "1px")
            .attr("transform", "translate(" + self.d3.c.yAxisWidth + "," + displayHeight + ")");

        // Group containing Y axis
        self.d3.o.yg = self.d3.o.svg.append("g")
            .attr("name", "ScatterPlot_yg")
            .style("width", self.d3.c.yAxisWidth)
            .style("fill", "none")
            .style("stroke", "#000")
            .style("stroke-width", "1px")
            .attr("transform", "translate(" + self.d3.c.yAxisWidth + ",0)");

        // Div containing the canvas (canvas can't be directly placed inside svg
        self.d3.o.chartArea = div.append("div")
            .attr("name", "ScatterPlot_chartArea")
            .style("width", displayWidth)
            .style("height", displayHeight);

        // Point drawing area
        self.d3.o.canvas = self.d3.o.chartArea.append("canvas")
            .attr("name", "ScatterPlot_canvas")
            .attr("width", displayWidth)
            .attr("height", displayHeight)
            .style("position", "relative")
            .style("left", self.d3.c.yAxisWidth + "px");

        // Canvas context (preparation)
        self.d3.o.context = self.d3.o.canvas.node().getContext("2d");
        self.d3.o.context.fillStyle = self.config.point.color;

        // Highlighted point
        self.d3.o.selectedPoint = self.d3.o.svg.append("circle")
            .attr("transform", "translate(" + self.d3.c.yAxisWidth + ",0)")
            .attr("r", self.config.highlightPoint.size)
            .attr("fill", self.config.highlightPoint.color)
            .classed("hidden", true);

        // Horizontal line following highlighted point
        self.d3.o.selectedHline = self.d3.o.svg.append("line")
            .attr("transform", "translate(" + self.d3.c.yAxisWidth + ",0)")
            .attr("x1", 0)
            .attr("x2", displayWidth)
            .attr("y1", 0)
            .attr("y2", 0)
            .style("stroke-dasharray", "5, 5")
            .style("stroke-width", "1px")
            .style("stroke", self.config.highlightLine.color)
            .classed("hidden", true);

        // Vertical line following highlighted point
        self.d3.o.selectedVline = self.d3.o.svg.append("line")
            .attr("transform", "translate(" + self.d3.c.yAxisWidth + ",0)")
            .attr("x1", 0)
            .attr("x2", 0)
            .attr("y1", 0)
            .attr("y2", displayHeight)
            .style("stroke-dasharray", "5, 5")
            .style("stroke-width", "1px")
            .style("stroke", self.config.highlightLine.color)
            .classed("hidden", true);

        // Tooltip attributes
        self.d3.o.tooltip = self.d3.o.chartArea.append("div")
            .attr("name", "ScatterPlot_tooltip")
            .style("position", "absolute")
            .style("padding", "5px")
            .style("background", self.config.tooltip.bgcolor)
            .style("color", self.config.tooltip.color)
            .style("border", 0)
            .style("border-radius", "4px")
            .style("pointer-events", "none")
            .style("opacity", 0);
    }

    /**
     * Display the loading screen or not
     * @param show: indicate to show or hide the loading screen
     */
    loadingVisible(show) {
        const self = this;
        self.layout.loading.classed("hidden", !show);
    }

    /**
     * Handle the actions to perform while swapping the X and Y data
     */
    swapAction() {

        const self = this;

        // Get current values
        const selectedX = d3.select("#scatterplot_Xselect").property("value");
        const selectedY = d3.select("#scatterplot_Yselect").property("value");

        // Swap them
        d3.select("#scatterplot_Xselect").property("value", selectedY);
        d3.select("#scatterplot_Yselect").property("value", selectedX);

        // Update data
        const swapSelection = self.selectedTS.X;
        self.selectedTS.X = self.selectedTS.Y;
        self.selectedTS.Y = swapSelection;

        // Swap data points
        const swapItem = cloneObj(self.datapoints.Y);
        self.datapoints.Y = cloneObj(self.datapoints.X);
        self.datapoints.X = swapItem;
        // Clear the former logs
        self.clearLog();
        self.logger("info", "Swapping X and Y");

        // Update graph
        self.redraw();
    }

    /**
     * Set the graph title
     */
    updateTitle() {

        const self = this;

        self.d3.o.divTitle
            .html(`<b>${self.fidList[self.selectedTS.X]}</b> vs <b>${self.fidList[self.selectedTS.Y]}</b>`);
    }

    /**
     * Render the display based on current data
     */
    redraw() {
        const self = this;

        console.time("Redraw duration");

        // Warn in case of length mismatch
        if (self.datapoints.X.length !== self.datapoints.Y.length) {
            self.logger("warn", "Series don't have the same number of points");
            console.warn("Series don't have the same number of points (X:" + self.datapoints.X.length + ", Y:" + self.datapoints.Y.length + ")");
            self.callbacks.toastr.warning("Series don't have the same number of points (X:" + self.datapoints.X.length + ", Y:" + self.datapoints.Y.length + ")");
        }

        // Building the points array for the quadtree
        console.time("Removing Duplicate Time");
        let points = [];
        const pointsLength = min([self.datapoints.X.length, self.datapoints.Y.length]);
        for (let i = 0; i < pointsLength; i++) {
            points.push([self.datapoints.X[i], self.datapoints.Y[i]]);
        }

        let set = new Set();
        points.forEach(point => set.add(JSON.stringify(point)));
        points = Array.from(set).map(e => JSON.parse(e));

        console.timeEnd("Removing Duplicate Time");


        console.info("Plotting " + points.length + " points");
        self.logger("info", "Plotting " + pointsLength + " points");

        let minmaxX = d3.extent(self.datapoints.X);
        let marginX = (minmaxX[1] - minmaxX[0]) * 0.05;
        self.d3.t.scaleX.domain([minmaxX[0] - marginX,minmaxX[1]+ marginX]);

        let minmaxY = d3.extent(self.datapoints.Y);
        let marginY = (minmaxY[1] - minmaxY[0]) * 0.05;
        self.d3.t.scaleY.domain([minmaxY[0] - marginY,minmaxY[1]+ marginY]);

        // Redraw axes
        self.d3.o.xg.call(self.d3.o.xAxis);
        self.d3.o.yg.call(self.d3.o.yAxis);

        // Clear and update canvas
        self.d3.o.context.clearRect(0, 0, self.d3.c.width, self.d3.c.height);

        // Reduce point size when too many points
        let pointSize = self.config.point.size;
        if (pointsLength > 200) {
            pointSize = 1;
        }

        // Draw every point
        points.forEach(function (p) {
            self.d3.o.context.beginPath();
            // x position, y position, radius, start angle, end angle
            self.d3.o.context.arc(
                self.d3.t.scaleX(p[0]),
                self.d3.t.scaleY(p[1]),
                pointSize,
                0,
                2 * Math.PI);
            self.d3.o.context.fill();
        });

        // Building a tree for the displayed points to make easier the search of the closest point
        let tree = null;
        try {
            tree = self.d3.o.factory(points);
        }
        catch (RangeError) {
            // Error happened during the tree building (infinite recursion)
            // Possible when having too many points to plot
            console.error("No tooltip available due to RangeError in tree factory");
            self.callbacks.toastr.error("Can't display tooltip");
        }

        // Mouse is moving over canvas
        // Highlight closest point from mouse position
        self.d3.o.canvas.on("mousemove", function () {

            // Get the mouse position
            const mouse = d3.mouse(this);

            // Defines the closest point from the mouse position
            const closest = tree.find([
                self.d3.t.scaleX.invert(mouse[0]),
                self.d3.t.scaleY.invert(mouse[1])
            ]);

            // Draw a circle at the closest point position
            self.d3.o.selectedPoint
                .attr("cx", self.d3.t.scaleX(closest[0]))
                .attr("cy", self.d3.t.scaleY(closest[1]));

            self.d3.o.selectedPoint.classed("hidden", false);
            self.d3.o.selectedHline.classed("hidden", false);
            self.d3.o.selectedVline.classed("hidden", false);

            // Draw horizontal dashed line at point position
            self.d3.o.selectedHline
                .attr("y1", self.d3.t.scaleY(closest[1]))
                .attr("y2", self.d3.t.scaleY(closest[1]));

            // Draw vertical dashed line at point position
            self.d3.o.selectedVline
                .attr("x1", self.d3.t.scaleX(closest[0]))
                .attr("x2", self.d3.t.scaleX(closest[0]));

            // Tooltip content
            let msg = `X: <b>${self.fidList[self.selectedTS.X]}:</b> ${closest[0].toFixed(4)}<br>`;
            msg += `Y: <b>${self.fidList[self.selectedTS.Y]}:</b> ${closest[1].toFixed(4)}`;

            self.d3.o.tooltip
                .style("opacity", self.config.tooltip.opacity)
                .html(msg);
            // Tooltip position (lower right by default)
            // Applying some shift to not stack the tooltip to the point and to fix alignment
            let shiftX = 5 + self.d3.o.canvas.node().getBoundingClientRect().left;
            let shiftY = 5 + self.d3.o.divTitle.node().getBoundingClientRect().height;
            if (self.d3.t.scaleX(closest[0]) > (self.d3.t.scaleX.range()[1] / 2)) {
                // Second horizontal half. Move tooltip to the left side of position
                shiftX -= self.d3.o.tooltip.node().getBoundingClientRect().width + 13;
            }
            if (self.d3.t.scaleY(closest[1]) > (self.d3.t.scaleY.range()[0] / 2)) {
                // Second vertical half. Move tooltip to the top side of position
                shiftY -= self.d3.o.tooltip.node().getBoundingClientRect().height + 10;
            }
            self.d3.o.tooltip
                .style("left", self.d3.t.scaleX(closest[0]) + shiftX)
                .style("top", self.d3.t.scaleY(closest[1]) + shiftY);
        });

        self.d3.o.canvas
            .on("mouseover", function () {
                // Show focus information when inside draw area
                self.d3.o.selectedPoint.classed("hidden", false);
                self.d3.o.selectedHline.classed("hidden", false);
                self.d3.o.selectedVline.classed("hidden", false);
                self.d3.o.tooltip.classed("hidden", false);
            })
            .on("mouseout", function () {
                // Hide focus information when out of draw area
                self.d3.o.selectedPoint.classed("hidden", true);
                self.d3.o.selectedHline.classed("hidden", true);
                self.d3.o.selectedVline.classed("hidden", true);
                self.d3.o.tooltip.classed("hidden", true);
            });

        self.updateTitle();

        self.loadingVisible(false);

        console.timeEnd("Redraw duration");
    }

    /**
     * Display a log information to the logger area
     * @param level: level of the message (info,warn,error)
     * @param msg: message to log
     */
    logger(level, msg) {
        const self = this;

        // Logger is displayed inside Form area.
        // If the latter is not displayed, don't do anything
        if (self.config.displayForm) {

            // Add new entry
            const entry = self.loggerDiv.append("div");
            let glyph = null;
            let alertStyle = null;

            // Apply the correct glyph and styles corresponding to the level
            switch (level) {
                case "warn":
                    glyph = "glyphicon-warning-sign";
                    alertStyle = "alert-warning";
                    break;
                case "error":
                    glyph = "glyphicon-exclamation-sign";
                    alertStyle = "alert-danger";
                    break;
                default:
                    // Default level is "info"
                    glyph = "glyphicon-info-sign";
                    alertStyle = "alert-info";
                    break;
            }

            // Build entry content and attributes.
            const sign = `<span class="glyphicon ${glyph}"></span>&nbsp`;
            entry
                .attr("class", alertStyle)
                .attr("role", "alert")
                .style("margin-top", "1px")
                .html(`${sign} ${msg}`);
        }
    }

    /**
     * Clear the logger area
     */
    clearLog() {
        const self = this;
        // Logger is displayed inside Form area.
        // If the latter is not displayed, don't do anything
        if (self.config.displayForm) {
            self.loggerDiv.html("");
        }
    }
}
