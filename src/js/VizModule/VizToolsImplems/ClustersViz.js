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
 * Display a ClustersViz for a list of n clusters.
 *
 *
 * @constructor
 * @param {string} container - the ID of the injected div
 * @param {Object} data - see kmeans_mds functional type for details
 *    ex :{
 *          "C1": {
 *                  "centroid":  [x,y],
 *                      tsuid1: [x,y],
 *                      tsuid2: [x,y]
 *                 },
 *          "C2" : ...
 *  }
 * @param {Array} callbacks - the list of the callbacks used by Viz
 */
class ClustersViz extends VizTool {
    constructor(container, data, callbacks) {

        // Call super-class constructor
        super(container, data, callbacks);

        this.name = "Clusters";

        // Configuration of the display
        this.config = {
            point: {
                size: 3, // Radius of the point
            },
            highlightPoint: {
                size: 10, // Radius of the point when highlighted
                color: "rgba(180,180,180,0.2)" // Color of the point when highlighted
            },
            highlightLine: {
                color: "#7F7F7F" // Color of the horizontal/vertical line when highlighted
            },
            tooltip: {
                bgcolor: "#33b9f8", // Background color of the tooltip,
                color: "#FFFFFF", // Foreground color of the tooltip,
                opacity: 0.9 // Transparency of the tooltip
            }
        };

        // Palette of colors used in VizTool, one color per cluster in data
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
            "#9400d3", //darkviolet
            "#ff00ff", //fuchsia
            "#4b0082", //indigo
            "#ff00ff", //magenta
            "#800000", //maroon
            "#000080", //navy
            "#808000", //olive
            "#ffc0cb", //pink
            "#800080" //purple
        ];

        // Contains the values to display among X and Y axises, tooltip message and associated tsuid link
        this.datapoints = {
            X: [],
            Y: [],
            MSG: [],
            LINK: []
        };

        // decode entries
        this.tsuidList = [];
        this.clusterIndexList = [];
        this.clusterSizeList = [];

        // Stack all pending API calls
        this.ajaxRq = [];

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

        // Initialize all the SVG and canvas components
        this.initSvg();

        // Initialize the layout and sub components
        self.init().then(function () {
            // Draw the scatterplot
            self.draw();
        });
    }

    /**
     * Wake up (Restore) the VizTool.
     */
    wakeUp() {

        // Initialize all the SVG and canvas components
        this.initSvg();

        // Draw the scatterplot
        this.draw();
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
     * Initialize the layout and the sub components
     */
    init() {
        const self = this;

        // reformatting input data
        // for each cluster
        for (let cluster in self.data) {
            this.clusterIndexList.push(self.datapoints.X.length);
            let current_index = self.clusterIndexList[self.clusterIndexList.length - 1];
            let clusterContent = self.data[cluster];
            let clusterSize = 0;
            for (let key in clusterContent) {
                if (key !== "centroid") {
                    // store tsuid in tsuid list
                    if (!self.tsuidList.includes(key)) {
                        self.tsuidList.push(key);
                    }
                    // push data point to data points list
                    self.datapoints.X.push(clusterContent[key][0]);
                    self.datapoints.Y.push(clusterContent[key][1]);
                    self.datapoints.MSG.push("");
                    self.datapoints.LINK.push(key);
                    clusterSize++;
                }
                else {
                    // push centroid at the beginning of data points list
                    self.datapoints.X.splice(current_index, 0, clusterContent[key][0]);
                    self.datapoints.Y.splice(current_index, 0, clusterContent[key][1]);
                    self.datapoints.MSG.splice(current_index, 0, cluster);
                    self.datapoints.LINK.splice(current_index, 0, "");
                }
            }
            self.clusterSizeList.push(clusterSize);

        }

        self.fidList = {};
        // asynchronous request to get Functional Identifiers
        return new Promise(function (resolve) {
            ikats.api.ts.fid({
                async: true,
                tsuid_list: self.tsuidList,
                success: function (x) {
                    let fid_results = x.data;
                    fid_results.forEach(x => self.fidList[x.tsuid] = x.funcId);
                },
                error: function () {
                    self.fidList = {};
                },
                complete: function () {
                    self.datapoints.LINK.forEach(function (tsuid, index) {
                        if (tsuid !== "") {
                            // time series case
                            if (tsuid in self.fidList) {
                                self.datapoints.MSG[index] = self.fidList[tsuid];
                            }
                        } else {
                            // centroid case
                            self.datapoints.MSG[index] = "Centroïd " + self.datapoints.MSG[index] + " (size:" + self.clusterSizeList.shift() + ")";
                        }
                    });
                    resolve();
                }
            });
        });
    }


    /**
     * Initialize the SVG components (graph part on the left side of the layout)
     */
    initSvg() {
        const self = this;

        // Presentation Layout
        self.layout = {};

        // Main frame, used for dimensions purposes
        self.layout.divMain = d3.select(`#${self.container}`)
            .append("div")
            .style("width", "100%")
            .attr("class", "row");

        // The chart takes 100%
        self.layout.divLeft = self.layout.divMain
            .append("div")
            .attr("class", "col-md-12");

        // Loading screen layout
        self.layout.loading = self.layout.divLeft.append("div");

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
            .attr("id", "ScatterPlot_svg")
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
        self.d3.o.xAxis = d3.axisBottom(self.d3.t.scaleX);

        // Vertical axis
        self.d3.o.yAxis = d3.axisLeft(self.d3.t.scaleY);

        // Group containing X axis
        self.d3.o.xg = self.d3.o.svg.append("g")
            .attr("id", "ScatterPlot_xg")
            .style("height", self.d3.c.xAxisHeight)
            .style("fill", "none")
            .style("stroke", "#000")
            .style("stroke-width", "1px")
            .attr("transform", "translate(" + self.d3.c.yAxisWidth + "," + displayHeight + ")");

        // Group containing Y axis
        self.d3.o.yg = self.d3.o.svg.append("g")
            .attr("id", "ScatterPlot_yg")
            .style("width", self.d3.c.yAxisWidth)
            .style("fill", "none")
            .style("stroke", "#000")
            .style("stroke-width", "1px")
            .attr("transform", "translate(" + self.d3.c.yAxisWidth + ",0)");

        // Div containing the canvas (canvas can't be directly placed inside svg
        self.d3.o.chartArea = div.append("div")
            .attr("id", "ScatterPlot_chartArea")
            .style("width", displayWidth)
            .style("height", displayHeight);

        // Point drawing area
        self.d3.o.canvas = self.d3.o.chartArea.append("canvas")
            .attr("id", "ScatterPlot_canvas")
            .attr("width", displayWidth)
            .attr("height", displayHeight)
            .style("position", "relative")
            .style("left", self.d3.c.yAxisWidth + "px");

        // Canvas context (preparation)
        self.d3.o.context = self.d3.o.canvas.node().getContext("2d");

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
            .style("opacity", 0.9)
            .classed("hidden", true);
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
     * Set the graph title
     */
    updateTitle() {
        const self = this;
        self.d3.o.divTitle
            .html(`<b>K-means clustering on Time Series</b>`);
    }

    /**
     * Render the display based on current data
     */
    draw() {
        const self = this;
        console.time("Draw duration");

        let nbPoints = self.datapoints.X.length;
        console.info("Plotting " + nbPoints + " points");

        let points = [];
        for (let i = 0; i < nbPoints; i++) {
            points.push([self.datapoints.X[i], self.datapoints.Y[i], self.datapoints.LINK[i], self.datapoints.MSG[i]]);
        }

        let minmaxX = d3.extent(self.datapoints.X);
        let marginX = (minmaxX[1] - minmaxX[0]) * 0.05;
        self.d3.t.scaleX.domain([minmaxX[0] - marginX, minmaxX[1] + marginX]);

        let minmaxY = d3.extent(self.datapoints.Y);
        let marginY = (minmaxY[1] - minmaxY[0]) * 0.05;
        self.d3.t.scaleY.domain([minmaxY[0] - marginY, minmaxY[1] + marginY]);

        // Draw axes
        self.d3.o.xg.call(self.d3.o.xAxis);
        self.d3.o.yg.call(self.d3.o.yAxis);

        // Clear and update canvas
        self.d3.o.context.clearRect(0, 0, self.d3.c.width, self.d3.c.height);

        // clone clusterIndexList to consume it
        let indexList = JSON.parse(JSON.stringify(self.clusterIndexList));
        let currentIndexClust = indexList.shift();
        let indexPalette = 0;


        // Draw every point
        points.forEach(function (p, index) {
            let pointSize = 2;
            let symbol = d3.symbol()
                .type(d3.symbolCross)
                .size(40)
                .context(self.d3.o.context);
            self.d3.o.context.beginPath();
            if (index === currentIndexClust) {
                if (indexPalette === (self.colorPalette.length - 1)) {
                    // Generate a random color and save it to the palette
                    const color = "#" + ((1 << 24) * Math.random() | 0).toString(16);
                    self.colorPalette.push(color);
                }
                self.d3.o.context.fillStyle = self.colorPalette[indexPalette++];
                currentIndexClust = indexList.shift();
                self.d3.o.context.translate(self.d3.t.scaleX(p[0]), self.d3.t.scaleY(p[1]));
                symbol();
                self.d3.o.context.translate(-self.d3.t.scaleX(p[0]), -self.d3.t.scaleY(p[1]));
            } else {
                self.d3.o.context.arc(
                    // x position, y position, radius, start angle, end angle
                    self.d3.t.scaleX(p[0]),
                    self.d3.t.scaleY(p[1]),
                    pointSize,
                    0,
                    2 * Math.PI);
            }
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

            self.d3.o.canvas.on("click", function () {
                if (closest[2] !== "") {
                    self.addViz("Curve", [{tsuid: closest[2], funcId: closest[3]}]);
                } else {
                    let centroid = closest[3].split(" ")[1];
                    const tsuid_list = Object.keys(self.data[centroid]).filter(x => x !== "centroid");
                    const ts_list = tsuid_list.map(x => ({tsuid: x, funcId: self.fidList[x]}));
                    self.addViz("Curve", ts_list);
                }
            });

            // Draw a circle at the closest point position
            self.d3.o.selectedPoint
                .attr("cx", self.d3.t.scaleX(closest[0]))
                .attr("cy", self.d3.t.scaleY(closest[1]));

            self.d3.o.selectedPoint.classed("hidden", false);
            self.d3.o.selectedHline.classed("hidden", false);
            self.d3.o.selectedVline.classed("hidden", false);
            self.d3.o.tooltip.classed("hidden", false);

            // Draw horizontal dashed line at point position
            self.d3.o.selectedHline
                .attr("y1", self.d3.t.scaleY(closest[1]))
                .attr("y2", self.d3.t.scaleY(closest[1]));

            // Draw vertical dashed line at point position
            self.d3.o.selectedVline
                .attr("x1", self.d3.t.scaleX(closest[0]))
                .attr("x2", self.d3.t.scaleX(closest[0]));

            // Tooltip content
            let msg = `${closest[3]}<br>`;

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
            .on("mouseout", function () {
                // Hide focus information when out of draw area
                self.d3.o.selectedPoint.classed("hidden", true);
                self.d3.o.selectedHline.classed("hidden", true);
                self.d3.o.selectedVline.classed("hidden", true);
                self.d3.o.tooltip.classed("hidden", true);
            });

        self.updateTitle();

        self.loadingVisible(false);

        console.timeEnd("Draw duration");
    }


}
