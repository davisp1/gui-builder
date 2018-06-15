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
 *  Class Table is a VizTool: viewer of a table, specified by data attribute, whose functional type is 'table'.
 *  This data defines the content of the cells and associated headers.
 *
 *  In addition to the viewable content, the data may define some links from the table cells/headers
 *  to some other pieces of data: from this Table viewer, the user can explore linked piece of data,
 *  by double-clicking on a Table item having a data link defined. See doubleclicked method for further details.
 *
 *  Definition of json object coding the 'table' type:
 *    - property table_desc: optional general description: object having string properties title and desc
 *
 *    - property headers: optional description of the table headers. Headers are specifically managed by the viewer,
 *      they are quite advised for scrolled contents.
 *      - property headers.col: optional object definition of the column headers
 *        - property headers.col.data: required when header is defined
 *        - optional properties: headers.col.default_links and headers.col.links
 *
 *      - property headers.row: optional definition of the row headers
 *        - property headers.row.data: required when header is defined
 *        - optional properties: headers.row.default_links and headers.row.links
 *
 *    - property content: description of the table content.
 *      - property content.cells: list of rows: each row is a list of cells. Each cell is a value (string, number or null)
 *      - optional properties: content.default_links and content.links
 *
 * Precision about data Links definition:
 *
 * The default_links and links properties are optional and set under the headers.row, headers.col and content,
 * they define how to follow the data links between the table and another data.
 * A data link is associated to resp. the row, the column, or the cell,
 * of resp. headers.row.data, headers.col.data, or content.cells sets.
 * - both 'default_links' and 'links' object define the data links properties, but
 *   - default_links object is gathering mutual properties shared by the row/column/content sets
 *   - links object defines objects specific to each row header/column header/content cell:
 *     - in header context: list of objects having properties val, type or context
 *     - in content context: list of list of objects having properties val, type or  context
 *
 * - precisions about the val/type/context properties - defined either by default_links or by links contexts -:
 *   - a data link is active only when the three properties are defined on the item
 *   - the property type: functional type of pointed data
 *   - the property val: the parameters of the link. Example: key in a database table.
 *   - the property context: defines how to retrieve the linked data. Examples:
 *     - 'processdata': when the linked data is the processdata having the key=val
 *     - 'tsuid' when the linked data is the timeserie whose tsuid=val
 *     - 'metadata' when the linked data is the metada whose key=val
 *
 *  Complete example of JSON content:
 *  {
 *     'table_desc': {
 *                      'title': 'Discretized matrix',
 *                      'desc':  'This is a ...'
 *                   }
 *
 *     'headers': {
 *        'col': {
 *
 *           'data':  [ 'funcId', 'metric', 'min_B1', 'max_B1', 'min_B2', 'max_B2' ],
 *           'default_links': null,
 *           'links': null
 *        },
 *
 *        'row': {
 *
 *            'data':  [ null, 'Flid1_VIB2', 'Flid1_VIB3', 'Flid1_VIB4', 'Flid1_VIB5' ],
 *            'default_links': {'type': 'bucket_ts', 'context': 'processdata' },
 *            'links': [     { 'val': '1' },
 *                           { 'val': '2' },
 *                           { 'val': '3' },
 *                           { 'val': '4' } ]
 *        }
 *
 *     },
 *
 *     'content':  {
 *        'cells': [[ 'VIB2', -50.0, 12.1, 1.0, 3.4 ],
 *                  [ 'VIB3',-5.0, 2.1, 1.0, 3.4 ],
 *                  [ 'VIB4', 0.0, 2.1, 12.0, 3.4 ],
 *                  [ 'VIB5', 0.0, 2.1, 1.0, 3.4 ] ],
 *        'default_links': null,
 *        'links': null
 *     }
 * }
 *
 *  @extends VizTool
 */
class Table extends VizTool {
    /**
     * @constructor
     * @param {string} container - the ID of the injected div
     * @param {Object} data - the data used in the visualization: see description in the class documentation
     * @param {Array} callbacks - the list of the callbacks used by Viz
     */
    constructor(container, data, callbacks) {

        // Handle both cases :
        // - data is the table content
        // - data is the name of the table (so get the content)
        let real_data = data;
        if (typeof(data) === "string") {
            real_data = ikats.api.table.read(data).data;
        }

        // Call super-class constructor
        super(container, real_data, callbacks);


        this.name = "Table";
        this.cell_px_height = 24;
        this.cell_px_width = 80;
        this.top_panel_height = 0;
        this.footer_height = 0;
        this.fontSize = 11;
        this.colors = {
            "focusedLabelBackGround": "#ffe6b3",
            "defaultLabelBackGround": "rgba(0,0,0,0.1)",
            "cornerBorder": "rgba(0,0,0,0.5)",
            "cellBorder": "rgba(0,0,0,0.2)",
            "labelBorder": "rgba(0,0,0,0.2)"
        };
        // Estimation of a character width (used to compute width of cells)
        this.AVG_CHAR_SIZE = 8;

        if (this.data.headers) {
            this.info_corner = {};
            if (this.data.headers.col.data[0]) {
                this.info_corner.col = this.data.headers.col.data[0];
            }
            if (this.data.headers.row.data[0]) {
                this.info_corner.row = this.data.headers.row.data[0];
            }
        }

        this.d3 = {
            o: {},
            e: {}
        };
    }

    /**
     * Handles the scroll event
     */
    content_scroll() {
        let elmnt = document.getElementById("tviz_sc_content");
        let x = elmnt.scrollLeft;
        let y = elmnt.scrollTop;
        let c_headers = document.getElementById("tviz_col_headers");
        c_headers.scrollLeft = x;
        let r_headers = document.getElementById("tviz_row_headers");
        r_headers.scrollTop = y;
    }

    /**
     * Initializes the event handling model
     */
    initEvents() {
        this.d3.e.resizeHeader = {};

        // Defines the half width of the zone trigerring the event resizing a column.
        this.d3.e.selectorHalfWidth = 5;
    }

    /**
     * Handles the double-clicking event on a data link, from
     *   - a content cell when both col_index and row_index are defined,
     *   - or a column header when row_index is null,
     *   - or a row header when col_index is null.
     * @param defaultDataLink: alias to default data link definition
     * @param specificDataLinkDef: alias to specific data link definition
     */
    doubleClicked(defaultDataLink, specificDataLinkDef) {
        const self = this;

        /* check context of link
            if context is processdata : collect data and then call the VizTool rendering
            if context is raw : just call VizTool rendering
        */
        let context = specificDataLinkDef.context || defaultDataLink.context;
        let val = specificDataLinkDef.val || defaultDataLink.val;

        if (context === "processdata") {
            ikats.api.op.result({
                "rid": val,
                "async": true,
                "success": function (exploredData) {
                    self.addViz("Curve", exploredData.data);
                },
                "error": function (error) {
                    console.error(error);
                }
            });
        }
        else if (context === "raw") {
            self.addViz("Curve", val);
        }

    }

    /**
     * Handles the event when the mouse is entering into the cell
     */
    cellEntered(row_index, col_index) {
        const self = this;
        self.d3.o.col_headers[col_index].select("textarea")
            .style("background-color", self.colors.focusedLabelBackGround);
        self.d3.o.row_headers[row_index].select("textarea")
            .style("background-color", self.colors.focusedLabelBackGround);
    }

    /**
     * Handles the event when the mouse is leaving the cell
     */
    cellLeft(row_index, col_index) {
        const self = this;
        self.d3.o.col_headers[col_index].select("textarea")
            .style("background-color", self.colors.defaultLabelBackGround);
        self.d3.o.row_headers[row_index].select("textarea")
            .style("background-color", self.colors.defaultLabelBackGround);
    }

    /**
     * Init the VizTool : collect and format the data (if necessary) then render the VizTool
     */
    display() {
        const self = this;
        self.initEvents();
        self.d3.o.container = d3.select("#" + self.container);


        //    top_panel
        // ------------------------
        //    main
        // ------------------------
        //    footer

        // where main is :
        //
        // corner     | col_header
        // ------------------------
        // row_header | content


        self.d3.o.top_panel = self.d3.o.container.append("div").attr("id", "tviz_top_panel")
            .style("height", self.top_panel_height + "px");

        self.d3.o.main = self.d3.o.container.append("div").attr("id", "tviz_main")
            .style("position", "relative")
            .style("height", "calc(100% - " +
                (self.top_panel_height + self.footer_height) + "px)");

        self.d3.o.footer = self.d3.o.container.append("div").attr("id", "tviz_footer");

        self.d3.o.corner = self.d3.o.main.append("div").attr("id", "tviz_corner")
            .style("position", "absolute")
            .style("height", self.cell_px_height + "px")
            .style("width", self.cell_px_width + "px");


        // Display corner header
        if (self.info_corner) {
            if (self.info_corner.col) {
                if (self.info_corner.row) { // Both
                    console.debug("found both");
                    let corner_cell = self.d3.o.corner.append("table")
                        .append("tr").append("th")
                        .style("font-size", (self.fontSize + 1) + "px")
                        .style("min-height", self.cell_px_height).style("max-height", self.cell_px_height);
                    self.addTextArea(corner_cell, self.info_corner.row, self.colors.cornerBorder, self.colors.defaultLabelBackGround, null, "corner_row");
                    corner_cell.append("svg")
                        .style("display", "inline")
                        .style("width", "10px")
                        .style("height", self.cell_px_height)
                        .style("background-color", self.colors.defaultLabelBackGround)
                        .style("border-top", "1px solid " + self.colors.cornerBorder)
                        .style("border-bottom", "1px solid " + self.colors.cornerBorder)
                        .append("line")
                        .attr("x1", 0)
                        .attr("x2", 10)
                        .attr("y1", 0)
                        .attr("y2", self.cell_px_height)
                        .attr("stroke-width", "1px")
                        .attr("stroke", "black");
                    self.addTextArea(corner_cell, self.info_corner.col, self.colors.cornerBorder, self.colors.defaultLabelBackGround, null, "corner_col");
                } else { // only col

                    console.debug("found only col");
                    let corner_cell = self.d3.o.corner.append("table")
                        .append("tr").append("th")
                        .style("font-size", (self.fontSize + 1) + "px")
                        .style("min-width", self.cell_px_width).style("max-width", self.cell_px_width)
                        .style("min-height", self.cell_px_height).style("max-height", self.cell_px_height);
                    self.addTextArea(corner_cell, self.info_corner.col, self.colors.cornerBorder, self.colors.defaultLabelBackGround);
                }
            } else if (self.info_corner.row) { // only row

                console.debug("found only row");
                let corner_cell = self.d3.o.corner.append("table")
                    .append("tr").append("th")
                    .style("font-size", (self.fontSize + 1) + "px")
                    .style("min-width", self.cell_px_width).style("max-width", self.cell_px_width)
                    .style("min-height", self.cell_px_height).style("max-height", self.cell_px_height);
                self.addTextArea(corner_cell, self.info_corner.row, self.colors.cornerBorder, self.colors.defaultLabelBackGround);
            }
        }
        self.addCornerColumnSeparator();


        self.d3.o.div_col_headers = self.d3.o.main.append("div").attr("id", "tviz_col_headers")
            .style("position", "absolute")
            .style("left", self.cell_px_width + "px")
            .style("height", self.cell_px_height + "px")
            .style("width", "calc(100% - " + self.cell_px_width + "px)")
            .style("overflow", "hidden")
            .append("table")
            .append("tr")
            .style("font-size", (self.fontSize + 1) + "px");

        self.d3.o.div_row_headers = self.d3.o.main.append("div").attr("id", "tviz_row_headers")
            .style("position", "absolute")
            .style("top", self.cell_px_height + "px")
            .style("width", self.cell_px_width + "px")
            .style("height", "calc(100% - " + self.cell_px_height + "px)")
            .style("overflow", "hidden")
            .append("table")
            .style("font-size", (self.fontSize + 1) + "px");

        self.d3.o.sc_content = self.d3.o.main.append("div").attr("id", "tviz_sc_content");
        self.d3.o.sc_content.style("position", "absolute")
            .style("left", self.cell_px_width + "px")
            .style("top", self.cell_px_height + "px")
            .style("max-height", "calc(100% - " + self.cell_px_height + "px)")
            .style("max-width", "calc(100% - " + self.cell_px_width + "px)")
            .style("overflow", "auto");

        self.d3.o.sc_content.on("scroll", self.content_scroll);

        self.d3.o.content = self.d3.o.sc_content.append("table").attr("id", "tviz_content").style("font-size", self.fontSize);

        self.displayColumnHeaders();

        self.displayRowHeaders();

        // When the corner is defined, adapt the size of the cells to match title
        if (self.info_corner.col) {
            if (self.info_corner.row) {
                self.setupRowHeadersWidth(Math.max(self.info_corner.col.length * self.AVG_CHAR_SIZE, self.info_corner.row.length * self.AVG_CHAR_SIZE) * 2 + 30);
            } else {
                self.setupRowHeadersWidth(self.info_corner.col.length * self.AVG_CHAR_SIZE + 20);
            }
        } else if (self.info_corner.row) {
            self.setupRowHeadersWidth(self.info_corner.row.length * self.AVG_CHAR_SIZE + 20);
        }

        self.displayContentCells();

        self.setupDefaultColWidths();
    }

    /**
     * Displays the content cells and initializes associated call-backs: this method is a step of display().
     */
    displayContentCells() {
        const self = this;
        self.d3.o.cells = [];

        self.data.content.cells.forEach(function (row, row_index) {

            let r = self.d3.o.content.append("tr");

            self.d3.o.cells[row_index] = [];

            row.forEach(function (cell, col_index) {
                let d3cell = r.append("td")
                    .style("min-width", self.cell_px_width).style("max-width", self.cell_px_width)
                    .style("min-height", self.cell_px_height).style("max-height", self.cell_px_height);

                let d3_txt_area;

                if (isNaN(cell)) {
                    d3_txt_area = self.addTextArea(d3cell, cell, self.colors.cellBorder);
                } else {
                    d3_txt_area = self.addTextArea(d3cell, parseFloat(cell).toFixed(3), self.colors.cellBorder, null, cell);
                }

                self.d3.o.cells[row_index].push(d3cell);

                d3cell.on("mouseenter", function () {
                    self.cellEntered(row_index, col_index);
                });
                d3cell.on("mouseleave", function () {
                    self.cellLeft(row_index, col_index);
                });

                // note: the column index of cell, X, is matching the column header index X+1, because of the corner
                //       the row index of cell, Y, is matching the row header index Y+1, because of the corner
                // kept as-is for the moment
                self.addDataLinkEvent(self.data.content, d3_txt_area, col_index + 1, row_index + 1);

            });
        });
    }

    /**
     * Displays the column headers and initializes associated call-backs: this method is a step of display().
     */
    displayColumnHeaders() {

        const self = this;

        self.d3.o.col_headers = [];
        self.d3.o.columnSeparators = [];
        self.data.headers.col.data.slice(1).forEach(function (header, index_header) {

            let header_cell = self.d3.o.div_col_headers.append("th")
                .style("min-width", self.cell_px_width + "px")
                .style("min-height", self.cell_px_height + "px")
                .style("max-width", self.cell_px_width + "px")
                .style("max-height", self.cell_px_height + "px");

            let colTextArea = self.addTextArea(header_cell, header, self.colors.labelBorder, self.colors.defaultLabelBackGround);

            // Subscribes data link selection call-back when a data link is defined
            // index_header + 1 gives the exact column number including the corner.
            self.addDataLinkEvent(self.data.headers.col, colTextArea, index_header + 1, null);

            // Subscribes the column resizing call-back
            self.addColumnSeparator(header_cell, index_header);


            self.d3.o.col_headers.push(header_cell);
        });
        let end_of_col_headers = self.d3.o.div_col_headers.append("th")
            .attr("valign", "top")
            .style("min-width", self.cell_px_width + "px")
            .style("min-height", self.cell_px_height + "px")
            .style("max-width", self.cell_px_width + "px")
            .style("max-height", self.cell_px_height + "px");

        self.addTextArea(end_of_col_headers, "", "transparent", "transparent");

        self.addColumnSeparator(end_of_col_headers, self.data.headers.col.data.length - 1);
    }

    /**
     * Displays the row headers and initializes associated call-backs: this method is a step of display().
     */
    displayRowHeaders() {
        const self = this;
        self.d3.o.row_headers = [];
        self.data.headers.row.data.slice(1).forEach(function (header, index_header) {

            let header_cell = self.d3.o.div_row_headers.append("tr").append("th")
                .style("min-width", self.cell_px_width).style("max-width", self.cell_px_width)
                .style("min-height", self.cell_px_height).style("max-height", self.cell_px_height);

            let rowTextArea = self.addTextArea(header_cell, header, self.colors.labelBorder, self.colors.defaultLabelBackGround);

            // Subscribes data link selection call-back when a data link is defined
            //   index_header + 1 gives the exact row number including the corner.
            self.addDataLinkEvent(self.data.headers.row, rowTextArea, null, index_header + 1);

            self.d3.o.row_headers.push(header_cell);
        });
        let end_of_row_headers = self.d3.o.div_row_headers.append("tr")
            .append("th")
            .style("min-width", self.cell_px_width + "px")
            .style("min-height", self.cell_px_height + "px")
            .style("max-width", self.cell_px_width + "px")
            .style("max-height", self.cell_px_height + "px");

        self.addTextArea(end_of_row_headers, "", "transparent", "transparent");
    }


    /**
     * Adds to the subscriber dom element, the data link selection event.
     * This event is triggered by double-clicking.
     *
     * The call-back is defined from the dataParent object properties
     *   - default_links,
     *   - links,
     *   - column index of dataParent,
     *   - row index of dataParent.
     *
     * Example of dataParent: data.content, or data.headers.row, or data.headers.col.
     *
     * @param dataParent: this.data part: object having optional properties default_links or links
     * @param subscriber: dom element subscribed to the data link selection
     * @param col_index: the column: index used in order to retrieve the specific definion from links. null when undefined.
     * @param row_index: the row index: index used in order to retrieve the specific definion from links. null when undefined.
     */
    addDataLinkEvent(dataParent, subscriber, col_index, row_index) {
        const self = this;
        let defaultDataLink = dataParent.default_links;
        let col_defined = col_index !== null;
        let row_defined = row_index !== null;

        // reads the specific info according to the context ...
        let specificDataLinkDef = null;
        if (col_defined && row_defined && dataParent.links && dataParent.links[row_index - 1][col_index - 1]) {
            // ... from cell content
            specificDataLinkDef = dataParent.links[row_index - 1][col_index - 1];
        }
        else if (col_defined && self.data.headers.col.links && self.data.headers.col.links[col_index]) {
            // ... from column header
            defaultDataLink = self.data.headers.col.default_links;
            specificDataLinkDef = self.data.headers.col.links[col_index];
        }
        else if (row_defined && self.data.headers.row.links && self.data.headers.row.links[row_index]) {
            // ... from row header
            defaultDataLink = self.data.headers.row.default_links;
            specificDataLinkDef = self.data.headers.row.links[row_index];
        }

        // Only subscribes when data link definition is complete:
        if (((defaultDataLink && defaultDataLink.val) || (specificDataLinkDef && specificDataLinkDef.val)) &&
            ((defaultDataLink && defaultDataLink.type) || (specificDataLinkDef && specificDataLinkDef.type)) &&
            ((defaultDataLink && defaultDataLink.context) || (specificDataLinkDef && specificDataLinkDef.context) )) {

            subscriber.on("dblclick", function () {
                self.doubleClicked(defaultDataLink, specificDataLinkDef, col_index, row_index);
            });
            subscriber.style("cursor", "pointer");

        }
    }

    /**
     * Adds the textarea to the d3cell
     * @param d3cell
     * @param text
     * @param colorBorder
     * @param backgroundColor
     * @param fulltext
     * @param cornerMode
     */
    addTextArea(d3cell, text, colorBorder, backgroundColor, fulltext, cornerMode) {
        let ta = null;
        if (cornerMode) {
            switch (cornerMode) {
                case "corner_row":
                    ta = d3cell.append("textarea").attr("readonly", "")
                        .style("resize", "none")
                        .style("overflow", "hidden")
                        .style("border", "1px solid " + colorBorder)
                        .style("border-right", "none")
                        .style("width", this.cell_px_width / 2).style("height", this.cell_px_height)
                        .style("background-color", backgroundColor)
                        .style("padding-left", "10px")
                        .style("text-align", "left");
                    break;
                case "corner_col":
                    ta = d3cell.append("textarea").attr("readonly", "")
                        .style("resize", "none")
                        .style("overflow", "hidden")
                        .style("border", "1px solid " + colorBorder)
                        .style("border-left", "none")
                        .style("width", this.cell_px_width / 2).style("height", this.cell_px_height)
                        .style("background-color", backgroundColor)
                        .style("padding-right", "10px")
                        .style("text-align", "right");
                    break;
            }
        } else {
            ta = d3cell.append("textarea").attr("readonly", "")
                .style("resize", "none")
                .style("overflow", "hidden")
                .style("border", "1px solid " + colorBorder)
                .style("width", this.cell_px_width).style("height", this.cell_px_height)
                .style("background-color", backgroundColor)
                .style("text-align", "center");
        }

        if (fulltext) {
            ta.attr("title", fulltext);
        }

        ta.text(text);
        return ta;
    }

    /**
     * Adds a specific div, in order to interact with resizing corner column event.
     * this is a specific case for the corner cell. Otherwise see addColumnSeparator().
     */
    addCornerColumnSeparator() {
        const self = this;
        const halfWidth = self.d3.e.selectorHalfWidth;

        let cornerWidth = self.d3.o.corner.node().getBoundingClientRect().width;

        let separator = self.d3.o.corner.append("div")
            .style("z-index", 101)
            .style("position", "relative")
            .style("top", -this.cell_px_height)
            .style("left", cornerWidth - halfWidth)
            .style("width", 2 * halfWidth)
            .style("height", this.cell_px_height)
            .style("cursor", "col-resize")
            .style("background-color", "transparent");

        this.d3.o.cornerSeparator = separator;
        const dragBehaviour = d3.drag()
            .on("start", function () {

                self.d3.e.resizeHeader.start = d3.mouse(document.body)[0];
                self.d3.e.resizeHeader.initialWidth = self.d3.o.corner.node().getBoundingClientRect().width;
            })
            .on("drag", function () {

                self.d3.e.resizeHeader.end = d3.mouse(document.body)[0];
                const delta = self.d3.e.resizeHeader.end - self.d3.e.resizeHeader.start;
                const computedWidth = Math.max(self.d3.e.resizeHeader.initialWidth + delta, 80);

                self.setupRowHeadersWidth(computedWidth);

            });
        separator.call(dragBehaviour);

    }

    setupDefaultColWidths() {
        const self = this;
        self.d3.o.col_headers.forEach(function (header, index) {
            self.setupHeadersWidth(header, index + 1, header.text().length * 10);
        });
    }

    setupHeadersWidth(attachedCell, index_col, width) {
        const self = this;
        attachedCell.style("min-width", width)
            .style("max-width", width)
            .style("width", width);

        attachedCell.select("textarea").style("min-width", width)
            .style("max-width", width)
            .style("width", width);

        self.d3.o.cells.forEach(function (row) {
            row[index_col - 1].style("min-width", width)
                .style("max-width", width)
                .style("width", width);
            row[index_col - 1].select("textarea").style("min-width", width)
                .style("max-width", width)
                .style("width", width);
        });
    }

    setupRowHeadersWidth(width) {
        const self = this;
        const halfWidth = self.d3.e.selectorHalfWidth;

        self.d3.o.corner.style("min-width", width)
            .style("max-width", width)
            .style("width", width);

        if (self.info_corner.col && self.info_corner.row) {
            self.d3.o.corner.selectAll("textarea").style("min-width", (width - 10) / 2)
                .style("max-width", (width - 10) / 2)
                .style("width", (width - 10) / 2);
        } else {
            self.d3.o.corner.selectAll("textarea").style("min-width", (width))
                .style("max-width", (width))
                .style("width", (width));
        }

        self.d3.o.cornerSeparator.style("left", width - halfWidth);

        self.d3.o.div_row_headers.style("min-width", width)
            .style("max-width", width)
            .style("width", width);

        self.d3.o.sc_content.style("left", width)
            .style("max-width", "calc(100% - " + width + "px)");

        d3.select("#tviz_col_headers").style("left", width)
            .style("width", "calc(100% - " + width + "px");

        d3.select("#tviz_row_headers")
            .style("width", width);

        self.d3.o.row_headers.forEach(function (cell) {
            cell.style("min-width", width)
                .style("max-width", width)
                .style("width", width);
            cell.select("textarea").style("min-width", width)
                .style("max-width", width)
                .style("width", width);
        });
    }

    /**
     * Adds a specific div, in order to interact with resizing column event.
     */
    addColumnSeparator(d3cell, index_col) {

        let self = this;
        let halfWidth = 5;
        let attachedCell = self.d3.o.col_headers[index_col - 1];
        let separator = d3cell.append("div")
            .style("z-index", 100)
            .style("position", "relative")
            .style("top", -this.cell_px_height)
            .style("left", -halfWidth)
            .style("width", 2 * halfWidth)
            .style("height", this.cell_px_height)
            .style("cursor", "col-resize")
            .style("background-color", "transparent");

        if (this.d3.o.columnSeparators.length > 0) {
            this.d3.o.columnSeparators.push(separator);
            const dragBehaviour = d3.drag()
                .on("start", function () {

                    self.d3.e.resizeHeader.start = d3.mouse(document.body)[0];
                    self.d3.e.resizeHeader.initialWidth = self.d3.o.col_headers[index_col - 1].node().getBoundingClientRect().width;
                })
                .on("drag", function () {

                    self.d3.e.resizeHeader.end = d3.mouse(document.body)[0];
                    const delta = self.d3.e.resizeHeader.end - self.d3.e.resizeHeader.start;
                    const computedWidth = Math.max(self.d3.e.resizeHeader.initialWidth + delta, 0);

                    self.setupHeadersWidth(attachedCell, index_col, computedWidth);
                });
            separator.call(dragBehaviour);
        }
        else {
            this.d3.o.columnSeparators.push(null);
        }
    }

    /**
     * Wake up (Restore) the VizTool.
     */
    wakeUp() {
        // Display default state
        this.display();
        // Update visualization with saved scroll state
        if (this.savedScroll) {
            let block = document.getElementById("tviz_sc_content");
            block.scrollLeft = self.savedScroll.x;
            block.scrollTop = self.savedScroll.y;
            let c_headers = document.getElementById("tviz_col_headers");
            c_headers.scrollLeft = self.savedScroll.x;
            let r_headers = document.getElementById("tviz_row_headers");
            r_headers.scrollTop = self.savedScroll.y;
            self.savedScroll = null;
        }
    }

    /**
     * Persist the VizTool for a quick restoration.
     */
    sleep() {
        // Save scrolling state :
        let elmnt = document.getElementById("tviz_sc_content");
        this.savedScroll = {
            x: elmnt.scrollLeft,
            y: elmnt.scrollTop
        };
    }

}
