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
 * Viztool permitting to render a matrix representing correlation between variables.
 *
 * @constructor
 * @param {string} container - the ID of the injected div
 * @param {Object} data - the data used in the visualization
 * @param {Array} callbacks - the list of the callbacks used by Viz
 */
class correlLoop extends VizTool {
    constructor(container, data, callbacks) {
        // Call super-class constructor
        super(container, data, callbacks);
        this.name = "correlLoop";

        // Custom construction of VizTool

        // Aliases for data
        this.data.corr = this.data.matrices[0].data;
        this.data.variances = this.data.matrices[1].data;

        // Prepare d3 constants
        this.d3 = {
            c: {
                width: d3.select("#" + this.container).node().getBoundingClientRect().width, // width of widget
                height: d3.select("#" + this.container).node().getBoundingClientRect().height, // Height of widget
                rgb_map_negative: {r: 219, g: 76, b: 76}, // Negative ceil color
                rgb_map_positive: {r: 71, g: 194, b: 102}, // Positive ceil color
                table_height_offset: 120, // Size (in px) allocated to labels displayed among x-Axis
                table_width_offset: 120, // Size (in px) allocated to labels displayed among y-Axis
                max_labels: 30,// Maximal number of labels displayed (on each axis)
            },
            o: {},
            e: {}
        };

        // Compute and stack cell sizes (according to the number of variables)
        this.d3.c.cellSizeX = (this.d3.c.width) / (this.data.variables.length);
        this.d3.c.cellSizeY = (this.d3.c.height) / (this.data.variables.length);
        // Prepare transformation state of viztool (zoom relative)
        this.transform = {scaleX: 1, scaleY: 1, translateX: 0, translateY: 0};
        // Stack the click events in order to be able to cancel default click behaviour (when double clicked)
        this.clickTimerStack = [];
    }

    /**
     * Init the VizTool : Prepare components and call rendering
     */
    display() {
        const self = this;

        // Remove content if there is some
        if (!d3.select(`#${self.container}`).selectAll("*").empty()) {
            d3.select(`#${self.container}`).selectAll("*").remove();
        }

        // Parent svg (handle rendered matrix & eventual labels)
        self.d3.o.svgParent = d3.select(`#${self.container}`)
            .append("svg")
            .attr("name", "svgParent")
            .attr("width", "100%")
            .attr("height", "100%");

        //SVG containing X labels
        self.d3.o.svgXLabels = self.d3.o.svgParent.append("svg")
            .attr("name", "svgXLabels")
            .attr("x", self.d3.c.table_width_offset)
            .attr("width", self.d3.c.width - self.d3.c.table_width_offset)
            .attr("height", self.d3.c.height - self.d3.c.table_height_offset)
            .attr("preserveAspectRatio", "xMinYMin meet")
            .attr("viewBox", `0 0 ${self.d3.c.width} ${self.d3.c.height}`);

        //SVG containing Y labels
        self.d3.o.svgYLabels = self.d3.o.svgParent.append("svg")
            .attr("name", "svgYLabels")
            .attr("y", self.d3.c.table_height_offset)
            .attr("width", self.d3.c.width - self.d3.c.table_width_offset)
            .attr("height", self.d3.c.height - self.d3.c.table_height_offset)
            .attr("preserveAspectRatio", "xMinYMin meet")
            .attr("viewBox", `0 0 ${self.d3.c.width} ${self.d3.c.height}`);

        // Main svg : permitting to render correlation matrix
        self.d3.o.svg = self.d3.o.svgParent.append("svg")
            .attr("name", "svgMatrix")
            .attr("x", self.d3.c.table_width_offset)
            .attr("y", self.d3.c.table_height_offset)
            .attr("preserveAspectRatio", "xMinYMin meet")
            .attr("viewBox", `0 0 ${self.d3.c.width} ${self.d3.c.height}`)
            .on("dblclick", function () {
                self.clickTimerStack.forEach(function (timer) {
                    clearTimeout(timer);
                });
                self.resetZoom();
            })
            .on("mousemove", function () { // Displays tooltip at cursor position
                self.mouseMoveHandler();
            });

        // Stack of all cells
        self.d3.o.cells = [];

        // Stack of all vertical labels
        self.d3.o.vertical_labels = [];
        // Stack of all horizontal labels
        self.d3.o.horizontal_labels = [];

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
            .style("display", "none")
            .style("border", "solid 1px #CCC")
            .style("padding", "0px 5px")
            .style("z-index", "10");

        // Initialize svg zoom behaviour
        self.initZoomBehaviour();

        // Call actual rendering
        self.render();

    }

    mouseMoveHandler() {
        const self = this;
        // Get mouse coordinates relatively to widget
        const mouseWidget = d3.mouse(d3.select("body").node());
        let topCoordinate = mouseWidget[1] - self.d3.o.tooltip.node()
            .getBoundingClientRect().height / 2;
        if (mouseWidget[0] > d3.select(`#${self.container}`).node().getBoundingClientRect().width / 2) {
            // Tooltip before :
            self.d3.o.tooltip.style("top", topCoordinate);
            self.d3.o.tooltip.style("left", mouseWidget[0] - (self.d3.o.tooltip.node()
                .getBoundingClientRect().width + 30));
        } else {
            // Tooltip after :
            self.d3.o.tooltip.style("top", topCoordinate);
            self.d3.o.tooltip.style("left", mouseWidget[0] + 30);
        }
    }

    // Permits zooming on a dragged rectangle on matrix (compute zooming state of viztool)
    initZoomBehaviour() {
        const self = this;

        // Zoom behaviour description
        self.d3.e.zoom = {
            startCell: null,
            endCell: null
        };
        // Zoom behaviour execution
        self.d3.e.zoom.do = d3.drag()
            .on("start", function () {
                // Get matching row and column origin for the drag:
                let cell = self.getCellAt(d3.mouse(self.d3.o.svg.node())[0], d3.mouse(self.d3.o.svg.node())[1]);
                if (cell) {
                    let cellX = parseFloat(cell.attr("x"));
                    let cellY = parseFloat(cell.attr("y"));
                    let cellWidth = parseFloat(cell.attr("width"));
                    let cellHeight = parseFloat(cell.attr("height"));
                    self.d3.e.zoom.startCell = {
                        x1: cellX,
                        y1: cellY,
                        x2: cellX + cellWidth,
                        y2: cellY + cellHeight
                    };

                    self.d3.o.selectRect
                        .attr("x", self.d3.e.zoom.startCell.x1)
                        .attr("y", self.d3.e.zoom.startCell.y1)
                        .attr("width", self.d3.e.zoom.startCell.x2 - self.d3.e.zoom.startCell.x1)
                        .attr("height", self.d3.e.zoom.startCell.y2 - self.d3.e.zoom.startCell.y1);
                }
            })
            // Display a selection rectangle over graph while dragging (sticky to grid)
            .on("drag", function () {
                // Call original mousemove handler in order to refresh tooltip position
                self.mouseMoveHandler();

                let cell = self.getCellAt(d3.mouse(self.d3.o.svg.node())[0], d3.mouse(self.d3.o.svg.node())[1]);
                if (cell) {
                    let cellX = parseFloat(cell.attr("x"));
                    let cellY = parseFloat(cell.attr("y"));
                    let cellWidth = parseFloat(cell.attr("width"));
                    let cellHeight = parseFloat(cell.attr("height"));
                    self.d3.e.zoom.endCell = {
                        x1: cellX,
                        y1: cellY,
                        x2: cellX + cellWidth,
                        y2: cellY + cellHeight
                    };

                    self.d3.o.selectRect
                        .attr("x", Math.min(self.d3.e.zoom.startCell.x1, self.d3.e.zoom.endCell.x1))
                        .attr("y", Math.min(self.d3.e.zoom.startCell.y1, self.d3.e.zoom.endCell.y1))
                        .attr("width", Math.max(self.d3.e.zoom.startCell.x2 - self.d3.e.zoom.endCell.x1,
                            self.d3.e.zoom.endCell.x2 - self.d3.e.zoom.startCell.x1))
                        .attr("height", Math.max(self.d3.e.zoom.startCell.y2 - self.d3.e.zoom.endCell.y1,
                            self.d3.e.zoom.endCell.y2 - self.d3.e.zoom.startCell.y1));
                }
            })
            // If the drag was consistent (bigger than one cell), rescale the matrix rendering according to selection
            .on("end", function () {
                let x1 = parseFloat(self.d3.o.selectRect.attr("x"));
                let y1 = parseFloat(self.d3.o.selectRect.attr("y"));
                let width = parseFloat(self.d3.o.selectRect.attr("width"));
                let height = parseFloat(self.d3.o.selectRect.attr("height"));

                // Compute if selection is bigger than one cell
                if (width > (self.d3.c.cellSizeX * self.transform.scaleX) + 1 ||
                    height > (self.d3.c.cellSizeY * self.transform.scaleY) + 1) {
                    self.executeZoom(x1, y1, width, height);
                }

                // Reset selection rectangle
                self.d3.o.selectRect
                    .attr("width", 0)
                    .attr("height", 0);

            });

        self.d3.o.svg.call(self.d3.e.zoom.do);
    }

    // Compute a new zoom level, focusing on a rectangle defined by parameters
    executeZoom(x, y, width, height) {
        const self = this;
        self.transform.translateX -= x / self.transform.scaleX;
        self.transform.translateY -= y / self.transform.scaleY;
        self.transform.scaleX = self.transform.scaleX / (width / self.d3.c.width);
        self.transform.scaleY = self.transform.scaleY / (height / self.d3.c.height);

        // Redraw matrix with a smooth transition
        d3.transition()
            .duration(300)
            .call(function () {
                self.render();
            });
    }

    // Reset initial zooming state of viztool
    resetZoom() {
        const self = this;
        self.transform.translateX = 0;
        self.transform.translateY = 0;
        self.transform.scaleX = 1;
        self.transform.scaleY = 1;
        // Redraw matrix with a smooth transition
        d3.transition()
            .duration(300)
            .call(function () {
                self.render();
            });
    }

    // Render the viztool matrix at saved zoom state and manage labels display
    render() {
        const self = this;

        self.computeLabels();
        self.computeCells();
    }

    computeLabels() {
        const self = this;
        // When focused data represents less or equals labels as maximum specified, display them
        if (self.data.variables.length <= self.d3.c.max_labels ||
            (self.data.variables.length / self.transform.scaleX <= self.d3.c.max_labels &&
                self.data.variables.length / self.transform.scaleY <= self.d3.c.max_labels)) {

            // Set up a status saving that labels are displayed
            self.no_label = false;

            // Reduce the size of the matrix svg in order to display labels
            self.d3.o.svg
                .transition()
                .duration(300)
                .attr("x", self.d3.c.table_width_offset)
                .attr("y", self.d3.c.table_height_offset)
                .attr("width", self.d3.c.width - self.d3.c.table_width_offset)
                .attr("height", self.d3.c.height - self.d3.c.table_height_offset);

            // Remove all eventual labels :
            self.d3.o.svgXLabels.selectAll("text").remove();
            self.d3.o.svgYLabels.selectAll("text").remove();
            self.d3.o.vertical_labels.length = 0;
            self.d3.o.horizontal_labels.length = 0;

            // Displays labels according to current matrix disposition (taking in account zooming state)
            self.data.variables.forEach(function (label, index) {
                // Handle vertical labels ("0.5" vertically centers to the middle of the cell)
                let yPosition = ((index + 0.5) * self.d3.c.cellSizeY + self.transform.translateY) * self.transform.scaleY;
                if (yPosition <= self.d3.c.height) {
                    self.d3.o.vertical_labels.push(self.d3.o.svgYLabels.append("text")
                        .attr("x", 0)
                        .attr("y", yPosition)
                        .attr("stroke", "#666666")
                        .text(label)
                        .style("font-weight", "lighter"));
                } else {
                    // Stack a null label in order to respect indexes
                    self.d3.o.vertical_labels.push(null);
                }
                // Handle horizontal labels ("0.5" horizontally centers to the middle of the cell)
                let xPosition = ((index + 0.5) * self.d3.c.cellSizeX + self.transform.translateX) * self.transform.scaleX;
                if (xPosition <= self.d3.c.width) {
                    self.d3.o.horizontal_labels.push(self.d3.o.svgXLabels.append("text")
                        .attr("x", xPosition)
                        .attr("y", self.d3.c.table_height_offset)
                        .attr("stroke", "#666666")
                        .text(label)
                        .attr("transform", "rotate(-45, " + xPosition + ", " + self.d3.c.table_height_offset + ")")
                        .style("font-weight", "lighter"));
                } else {
                    // Stack a null label in order to respect indexes
                    self.d3.o.horizontal_labels.push(null);
                }
            });
        } else {
            // Set up a status saving that labels are not displayed
            self.no_label = true;

            // Keep or reset Matrix svg to initial size
            self.d3.o.svg
                .transition()
                .duration(300)
                .attr("x", 0)
                .attr("y", 0)
                .attr("width", self.d3.c.width)
                .attr("height", self.d3.c.height);

            // Remove all eventual labels :
            self.d3.o.svgXLabels.selectAll("text").remove();
            self.d3.o.svgYLabels.selectAll("text").remove();
            self.d3.o.vertical_labels.length = 0;
            self.d3.o.horizontal_labels.length = 0;
        }
    }

    computeCells() {
        const self = this;
        // Remove all eventual rectangles (cells and selection Rectangles)
        if (!self.d3.o.svg.selectAll("rect").empty()) {
            self.d3.o.svg.selectAll("rect").remove();
        }
        self.d3.o.cells.length = 0;

        // For each data, draw cells
        self.data.corr.forEach(function (row, row_index) {
            row.forEach(function (cell, cell_index) {
                // If the cell is not the leading 1 (auto-correlation), draw mirrored semi matrix (/triangular matrix)
                if (cell_index !== 0) {
                    self.renderCell(cell, cell_index, row_index, true);
                }
                // Anyway, draw upper semi matrix (/triangular matrix)
                self.renderCell(cell, cell_index, row_index, false);
            });
        });
        // Create selection rectangle
        self.d3.o.selectRect = self.d3.o.svg.append("rect")
            .attr("fill", "rgba(0,0,0,0.3)")
            .style("pointer-events", "none");
    }

    renderCell(cell, cell_index, row_index, mirror) {
        const self = this;
        // compute color according to correlation coefficient
        let color = self.colorMap(cell);

        const width = self.d3.c.cellSizeX * self.transform.scaleX;
        const height = self.d3.c.cellSizeY * self.transform.scaleY;
        const transformX = self.transform.translateX * self.transform.scaleX;
        const transformY = self.transform.translateY * self.transform.scaleY;

        // Define indexes used to compute coordinates
        let hori_index = cell_index + row_index;
        let vert_index = row_index;

        // If cell is rendered in mirrored semi matrix, swap indexes
        if (mirror) {
            [hori_index, vert_index] = [vert_index, hori_index];
        }

        // Pre compute coordinates of the cell
        let computedX = width * hori_index + transformX;
        let computedY = height * vert_index + transformY;

        // Check if the cell is in the "visible" area (according to zoom state)
        if (Math.ceil(computedX + 1) >= 0 && Math.floor(computedX - 1) <= self.d3.c.width - width &&
            Math.ceil(computedY + 1) >= 0 && Math.floor(computedY - 1) <= self.d3.c.height - height) {
            self.d3.o.cells.push(self.d3.o.svg.append("rect")
                .attr("fill", color)
                .attr("stroke", color)
                .attr("stroke-width", "1px")
                .attr("x", computedX)
                .attr("y", computedY)
                .attr("width", width)
                .attr("height", height)
                .on("click", function () {
                    // Delay clic in order to be able to cancel it in case of a double click
                    self.clickTimerStack.push(setTimeout(function () {
                        // Triggers new viztool on click event on point
                        let matrices_ok = self.data.matrices.filter(function (matrix) {
                            return matrix.desc.is_rid_link;
                        });
                        let matrix = matrices_ok[0];
                        const rid = matrix.data[row_index][cell_index];
                        if (rid) {
                            ikats.api.op.result({
                                async: true,
                                rid: rid,
                                success: function (result) {
                                    if (result.status === true) {
                                        result.data.title = result.data.variables[0] + " vs " + result.data.variables[1];
                                        delete(result.variables);

                                        if (result.data.x_value.data.length > 1) {
                                            // More than one point to plot, display the curve
                                            self.addViz("D3CurveNonTemporal", result.data);
                                        }
                                        else {
                                            // Otherwise, skip the curve and go to scatterplot directly
                                            self.addViz("ScatterPlot", result.data.ts_lists[0]);
                                        }
                                    }
                                    else {
                                        notify().error("Can't trigger the next display");
                                        console.error("Can't trigger the next display");
                                    }
                                },
                                error: function (error) {
                                    notify().error("Can't trigger the next display");
                                    console.error("Can't trigger the next display", error);
                                }
                            });
                        }
                        else {
                            notify().error("No additional information for this cell");
                            console.error("No additional information for this cell");
                        }
                    }, 300));

                })
                .on("mouseover", function () {
                    // Highlight hovered cell
                    d3.select(this)
                        .attr("stroke", "black")
                        .attr("stroke-width", "2px");

                    // Show tooltip with current values
                    if (isNumber(cell) && isNumber(self.data.variances[row_index][cell_index])) {
                        self.d3.o.tooltip
                            .style("display", "block")
                            .html(self.data.variables[row_index] + " / " + self.data.variables[cell_index + row_index] +
                                "<br/> Mean : " + cell.toFixed(3) +
                                "<br/>Variance : " + self.data.variances[row_index][cell_index].toFixed(3));
                    }
                    else {
                        self.d3.o.tooltip
                            .style("display", "block")
                            .html(self.data.variables[row_index] + " / " + self.data.variables[cell_index + row_index] +
                                "<br/>No information about correlation for this pair");
                    }

                    if (!self.no_label) {
                        // Highlight horizontal and vertical labels
                        if (self.d3.o.horizontal_labels[hori_index]) {
                            self.d3.o.horizontal_labels[hori_index]
                                .style("font-weight", "bold")
                                .attr("stroke", "black");
                        }
                        if (self.d3.o.vertical_labels[vert_index]) {
                            self.d3.o.vertical_labels[vert_index]
                                .style("font-weight", "bold")
                                .attr("stroke", "black");
                        }
                    }
                })
                .on("mouseout", function () {
                    // De-highlight left cell
                    d3.select(this)
                        .attr("stroke", color)
                        .attr("stroke-width", "1px");
                    // Hide tooltip
                    self.d3.o.tooltip
                        .style("display", "none");

                    if (!self.no_label) {
                        // De-highlight horizontal and vertical labels
                        if (self.d3.o.horizontal_labels[hori_index]) {
                            self.d3.o.horizontal_labels[hori_index]
                                .style("font-weight", "lighter")
                                .attr("stroke", "#666666");
                        }
                        if (self.d3.o.vertical_labels[vert_index]) {
                            self.d3.o.vertical_labels[vert_index]
                                .style("font-weight", "lighter")
                                .attr("stroke", "#666666");
                        }
                    }
                })
            );
        }
    }

    getCellAt(x, y) {
        const self = this;
        let cellAt = null;
        if (self.d3.o.cells.some(function (cell) {
                cellAt = cell;
                return (parseInt(cell.attr("x")) < x && x < parseInt(cell.attr("x")) + parseInt(cell.attr("width"))) &&
                    (parseInt(cell.attr("y")) < y && y < parseInt(cell.attr("y")) + parseInt(cell.attr("height")));
            })) {
            return cellAt;
        } else {
            console.warn("Did not found cell at position");
            return null;
        }

    }

    // Map a color according to correlation coefficient (from -1 to 1)
    colorMap(value) {
        let color;
        if (isNumber(value)) {
            if (value < 0) {
                color = this.d3.c.rgb_map_negative;
                value = Math.abs(value);
            } else {
                color = this.d3.c.rgb_map_positive;
            }
            return "rgba(" + color.r + "," + color.g + "," + color.b + "," + value + ")";
        }
        else {
            return "lightgrey";
        }
    }

    /**
     * Wake up (Restore) the VizTool. Just re-display it (will automatically use good zoom level).
     */
    wakeUp() {
        const self = this;
        self.display();
    }

    /**
     * Sleep function of the viztool : it has no use in this VizTool
     */
    sleep() {
    }

}
