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
 * @typedef {Object} ts_scores Score format of pattern matching
 *
 * We need the following information to identify a matching
 *  - The score for each timestamp
 *  - The interval (start date, end date) of the match
 *
 * @property {number[]} ts_scores.scores Array of TSUID providing the scores values
 * @property {number[]} ts_scores.intervals Array of TSUID providing the end date of the interval matching the score
 */

/**
 * A viztool permitting to show a pattern matching result on one TS at a time.
 *
 * @constructor
 * @param {string} container - the ID of the injected div
 *                  Contains : Object containing :
 *                             {Array} ref_tsuids - A list of TSUIDS
 *                             {Dict} patterns - Dictionary of patterns
 *                             {Array} pattern_names - Array of sorted keys of patterns
 * @param {Array} callbacks - the list of the callbacks used by Viz :
 *  should contains :  nothing at the moment
 */
class randomProjectionViz extends VizTool {
    constructor(container, data, callbacks) {
        // Call super-class constructor
        super(container, data, callbacks);
        this.name = "RandomProjection";


        // Raw inputs
        this.data = {
            ref_tsuids: data.context.tsuids,
            patterns: data.patterns,
            regex: data.regex,
            pattern_names: Object.keys(data.patterns).sort(function (a, b) {
                return a.localeCompare(b, undefined, {numeric: true, sensitivity: "base"});
            })
        };

        // Displayed data
        this.selection = {
            // Represents the position of the selected TS in lists composing this.data
            index: 0,

            pattern_index: 0,
            regex: "Not Found",

            // Data content for this selection
            points: [],
            all_tsuids: [],
            intervals: [],
            all_fids: []
        };

        // List of Metadata associated to these TS
        this.mdList = [];

        // Container of D3 items
        this.d3 = {
            c: {}, // Constants
            o: {}, // Objects
            t: {}, // Transformations
            a: {}, // Actions
            v: {}, // Variables
            e: {}  // Events
        };

        this.pendingQueries = [];
    }

    /**
     * Initialize the D3 SVG and all components using the current selected ts as data
     */
    initD3() {

        const self = this;

        // Initialize D3 components
        self.initD3Constants();
        self.initD3Variables();
        self.initD3Transformations();
        self.initD3Actions();
        self.initD3Objects();
        self.initD3Events();

        // Add axises to svg
        self.d3.o.svg.append("g")
            .attr("class", "xaxis")
            .attr("transform", "translate(0," + (self.d3.c.height - self.d3.c.marginTopBot) + ")")
            .call(self.d3.o.xAxis);
        self.d3.o.svg.append("g")
            .attr("class", "yaxis")
            .attr("transform", "translate(" + self.d3.c.marginSide + ",0)")
            .call(self.d3.o.yAxis);
    }


    /**
     * Collect and format the data, then call drawing function.
     */
    display() {
        const self = this;

        // Collect meta data used for reference TSUID
        self.pendingQueries.push(ikats.api.md.read({
            ts_list: this.data.ref_tsuids,
            async: true,
            success: function (d) {

                // Store the metadata
                self.mdList = d.data;

                // Initialize the display
                self.getData(null, null, function () {
                    self.initD3();
                    self.fullRedraw(200, false);
                });
            },
            error: function () {
                self.callbacks.toastr.error("Can't get metadata for these TS");
            }
        }));
    }

    /**
     * Wake up (Restore) the VizTool.
     */
    wakeUp() {
        const self = this;
        self.initD3();
        self.fullRedraw(200, false);
    }

    /**
     * @typedef {Object} downsamplingResult
     * @property {number} sd date corresponding to the beginning of window of the downsampling (EPOCH ms)
     * @property {number} ed date corresponding to the end of the window of the downsampling (EPOCH ms)
     * @property {number} dp downsampling period to use (in ms)
     * @property {number} numberOfPointsInRange Number of real points (not downsampled) inside the requested window
     */

    /**
     * Compute the various necessary elements to compute a downsampling TS
     *
     * extraRange field having value 0.5 means:
     * * 50% of the displayed window range will be retrieved after the last displayed point
     * * 50% of the displayed window range will be retrieved before the first displayed point
     *
     * @param {string} tsuid TSUID to compute
     * @param {number} winStart start date to start from (visible part) (in ms from EPOCH)
     * @param {number} winEnd end date to end to (visible part) (in ms from EPOCH)
     * @param {number} pixRate number of pixels/point
     * @param {number} extraRange Percentage (between [0; 1]) of extraRange to get
     * @returns {downsamplingResult} parameters used to get the TS points
     */
    computeDownSampling(tsuid, winStart, winEnd, pixRate = 2, extraRange = 1) {

        const self = this;

        // Number of pixels allowed to display the chart
        const pixels = $(`#${self.container}`).width() / pixRate;

        // Computed displayed range
        const range = winEnd - winStart;

        // Compute start and end dates (points that will be retrieved, not the displayed range)
        const sd = parseInt(winStart - range * extraRange, 10);
        const ed = parseInt(winEnd + range * extraRange, 10);

        // Get the number of real points inside the window range
        let numberOfPointsInRange = 0;
        const nbPointRet = ikats.api.ts.nbPoints({
            tsuid: tsuid,
            sd: winStart,
            ed: winEnd
        });
        if (nbPointRet.status) {
            numberOfPointsInRange = nbPointRet.data;
        }

        // Down Sampling period (no downsampling by default)
        let dp = 0;

        // Don't down sample if enough pixels to map the points
        if (numberOfPointsInRange > pixels) {
            // Compute the downsampling period
            dp = parseInt((winEnd - winStart) / pixels, 10);
        }

        return {
            sd: sd,
            ed: ed,
            dp: dp,
            numberOfPointsInRange: numberOfPointsInRange
        };
    }

    /**
     * Permits to load scores, intervals and origin TS for selected index, if succeeded, trigger the callback
     *
     * @param {?number} windowStart start date of the window to observe. Use metadata information by default
     * @param {?number} windowEnd end date of the window to observe. Use metadata information by default
     * @param {function} callback Callback to call when request is completed
     */
    getData(windowStart, windowEnd, callback) {
        const self = this;

        console.time("Data collected in");


        const pattern_name = self.data.pattern_names[self.selection.index];


        const pattern_dict = self.data.patterns[pattern_name];

        self.selection.regex = pattern_dict.regex;


        self.selection.all_tsuids = Object.keys(pattern_dict.locations);

        const tsuid_fid_mapping = ikats.api.ts.fid({tsuid_list: self.selection.all_tsuids});

        self.selection.all_fids = self.selection.all_tsuids.map(function (tsuid) {
            // Get good mapping line
            return tsuid_fid_mapping.data.filter(function (mapping_line) {
                return mapping_line.tsuid === tsuid;
            })[0].funcId;
        });

        // chosen pattern
        const tsuid = self.selection.all_tsuids[self.selection.pattern_index];

        const intervals = [];

        const value = pattern_dict.locations[tsuid].seq;

        for (let i = 0; i < value.length; i++) {
            const seq = value[i];

            const sd = seq.timestamp;
            const ed = sd + seq.size;

            intervals.push([sd, ed]);
        }

        self.selection.intervals = intervals;

        // Get the window range
        if (( windowStart === null) || (windowEnd === null)) {
            try {
                windowStart = parseInt(getMd(self.mdList, tsuid, "ikats_start_date"), 10);
                windowEnd = parseInt(getMd(self.mdList, tsuid, "ikats_end_date"), 10);
            }
            catch (e) {
                self.callbacks.toastr.error(e);
                return;
            }
        }

        // Promise objects returned by Ajax queries
        let ajaxRq = [];

        // Get simultaneously scoresTsuids, intervals and original TS

        // TS Points
        // Get the downsampling information to prepare the query
        let dsInfo = self.computeDownSampling(tsuid, windowStart, windowEnd);

        const query = ikats.api.ts.read({
            tsuid: tsuid,
            sd: dsInfo.sd,
            ed: dsInfo.ed,
            dp: dsInfo.dp,
            da: "avg",

            async: true,
            error: function (e) {
                console.error("Getting given tsuid data resulted in an error : ", e);
                self.callbacks.toastr.error("Couldn't get origin tsuid data", "Error : ");
            },
            success: function (d) {
                self.selection.points = d.data;
            }
        });
        ajaxRq.push(query);
        self.pendingQueries.push(query);


        // Action to perform once ALL requests have been done
        jQuery.when(...ajaxRq).done(function () {

            console.timeEnd("Data collected in");
            console.info(Object.keys(self.selection.points).length + " points retrieved");

            callback();
        });
    }

    /**
     * Initialize all constants used by D3
     */
    initD3Constants() {

        const self = this;

        // Set ContentBox size
        self.d3.c.width = 1200;
        self.d3.c.height = 500;

        // Set margin at the top and bot of the VizTool
        self.d3.c.marginTopBot = 20;

        // Set margin at right and left of the VizTool
        self.d3.c.marginSide = 40;

    }

    /**
     * Initialize all variables used by D3
     */
    initD3Variables() {

        const self = this;

        const dps = self.selection.points;

        // Time series values only
        self.d3.v.rawValues = Object.keys(dps).map(function (key) {
            return dps[key];
        });

        //Time series timestamps only
        self.d3.v.rawTimestamps = Object.keys(dps).map(function (key) {
            return parseInt(key, 10);
        });

        // Pre compute minimum and maximum values in used data to fit the display range
        const delta = max(self.d3.v.rawValues) - min(self.d3.v.rawValues);
        self.d3.v.minVal = min(self.d3.v.rawValues) - 0.1 * delta;
        self.d3.v.maxVal = max(self.d3.v.rawValues) + 0.1 * delta;
    }

    /**
     * Initialize D3 TsLine component
     */
    initD3TsLine() {

        const self = this;

        // Component definition
        self.d3.o.tsLine = {
            color: "blue",
            o: self.d3.o.graph.append("path")
                .attr("class", "tsLine"),
            // Sets up a D3 scale for timestamps (will be used as horizontal)
            timeScale: self.d3.t.timeScale,
            // Sets up a D3 scale for values (will be used as vertical)
            valueScale: self.d3.t.valueScale
        };

        /**
         * Set the coordinates of the line corresponding to the visible graph part being shown
         */
        self.d3.o.tsLine.line = d3.line()
            .curve(d3.curveBasis)
            .x(function (d, i) {
                return self.d3.o.tsLine.timeScale(self.d3.v.rawTimestamps[i]);
            })
            .y(function (d) {
                return self.d3.o.tsLine.valueScale(d);
            });

        /**
         * Apply a quick update of the object tsLine
         *
         * @param {number} duration transition duration
         * @param {boolean} tagOld indicate if the object shall be tagged as "old data"
         */
        self.d3.o.tsLine.quickUpdate = function (duration, tagOld = false) {

            let strokeColor = self.d3.o.tsLine.color;
            if (tagOld) {
                strokeColor = "grey";
            }

            // UPDATE
            self.d3.o.tsLine.o
                .attr("transform", "translate(-" + self.d3.c.marginSide + " -" + self.d3.c.marginTopBot + ")")
                .attr("fill", "none")
                .attr("stroke", strokeColor)
                .attr("stroke-width", "1px")
                .transition().duration(duration)
                .attr("d", function () {
                    return self.d3.o.tsLine.line(self.d3.v.rawValues);
                });
        };

        /**
         * Apply a full update of the object tsLine
         * @param duration {number} transition duration
         * @param keepX {boolean} indicating if the scaling of X has to be updated
         * @param keepY {boolean} indicating if the scaling of Y has to be updated
         */
        self.d3.o.tsLine.fullUpdate = function (duration, keepX, keepY) {

            if (!keepX) {
                self.d3.o.tsLine.timeScale.domain(d3.extent(self.d3.v.rawTimestamps));
            }
            if (!keepY) {
                self.d3.o.tsLine.valueScale.domain([self.d3.v.minVal, self.d3.v.maxVal]);
            }


            // Refresh data values
            self.d3.o.tsLine.o
                .data(self.d3.o.tsLine.line(self.d3.v.rawValues));

            // EXIT old data
            self.d3.o.tsLine.o
                .exit()
                .remove();

            self.d3.o.tsLine.quickUpdate(duration, false);

            // ENTER
            self.d3.o.tsLine.o
                .enter()
                .attr("d", function () {
                    return self.d3.o.tsLine.line(self.d3.v.rawValues);
                })
                .attr("transform", "translate(-" + self.d3.c.marginSide + " -" + self.d3.c.marginTopBot + ")")
                .attr("fill", "none")
                .attr("stroke", self.d3.o.tsLine.color)
                .attr("stroke-width", "1px");
        };
    }


    /**
     * Initialize D3 Intervals component
     */

    initD3Intervals() {

        const self = this;

        // Component definition
        self.d3.o.intervals = {
            fillColor: "#add8e6",
            fillColorFocused: "#7ade7c",
            strokeColor: "#000",
            strokeColorFocused: "#FF0000",
            // If above limit, don"t display the intervals
            maxItems: 100,
            o: function () {
                return self.d3.o.graph.selectAll(".intervalsRect");
            },
            translate: self.d3.t.timeScale
        };

        /**
         * Apply a quick update of the object intervals
         *
         * @param {number} duration transition duration
         * @param {boolean} tagOld indicate if the object shall be tagged as "old data"
         */
        self.d3.o.intervals.quickUpdate = function (duration, tagOld) {

            let fillColor = self.d3.o.intervals.fillColor;
            let strokeColor = self.d3.o.intervals.strokeColor;
            if (tagOld) {
                fillColor = "grey";
                strokeColor = "darkgrey";
            }

            // UPDATE
            self.d3.o.intervals.o().each(function () {
                d3.select(this)
                    .attr("stroke", strokeColor)
                    .attr("fill", fillColor)
                    .transition()
                    .duration(duration)
                    .attr("x", function (d) {
                        return self.d3.o.intervals.translate(d[0]);
                    })
                    .attr("width", function (d) {
                        return self.d3.o.intervals.translate(d[1]) - self.d3.o.intervals.translate(d[0]);
                    });
            });
        };

        /**
         * Apply a full update of the object intervals
         * @param duration {number} transition duration
         * @param keepX {boolean} indicating if the scaling of X has to be updated
         * @param keepY {boolean} indicating if the scaling of Y has to be updated
         */
        self.d3.o.intervals.fullUpdate = function (duration, keepX, keepY) {
            // Draw intervals

            if (!keepX) {
                self.d3.o.intervals.translate.domain(d3.extent(self.d3.v.rawTimestamps));
            }

            if (!keepY) {
                self.d3.o.tsLine.valueScale.domain([self.d3.v.minVal, self.d3.v.maxVal]);
            }


            self.d3.o.intervals.o()
                .data(self.selection.intervals)
                .remove();

            if (self.selection.intervals.length > 0 && self.selection.intervals.length < self.d3.o.intervals.maxItems) {

                self.d3.o.intervals.quickUpdate(0, false);

                // UPDATE
                self.d3.o.intervals.o()
                    .data(self.selection.intervals)
                    .enter()
                    .append("rect")
                    .attr("class", "intervalsRect")
                    .attr("fill", self.d3.o.intervals.fillColor)
                    .attr("stroke", self.d3.o.intervals.strokeColor)
                    .attr("stroke-width", "1")
                    .attr("transform", "translate(-" + self.d3.c.marginSide + " -" + self.d3.c.marginTopBot + ")")
                    .attr("opacity", "0.7")
                    .attr("x", function (d) {
                        return self.d3.t.timeScale(d[0]);
                    })
                    .attr("y", 0)
                    .attr("width", function (d) {
                        return self.d3.t.timeScale(d[1]) - self.d3.t.timeScale(d[0]);
                    })
                    .attr("height", self.d3.c.height)
                    .on("mouseover", function () {
                        d3.select(this)
                            .attr("opacity", "1")
                            .attr("fill", self.d3.o.intervals.fillColorFocused)
                            .attr("stroke", self.d3.o.intervals.strokeColorFocused);
                    })

                    .on("mouseout", function () {
                        d3.select(this)
                            .attr("opacity", "0.7")
                            .attr("fill", self.d3.o.intervals.fillColor)
                            .attr("stroke", self.d3.o.intervals.strokeColor);
                    });
            }
        };
    }


    /**
     * Initialize D3 ClipPath component (highlight matched pattern in red)
     */

    initD3ClipPath() {

        const self = this;

        self.d3.o.clipPath = {
            strokeColor: "red",
            o: self.d3.o.graph
                .append("clipPath")
                .attr("id", "clip_path_pattern")
        };

        /**
         * Apply a quick update of the object clipPath
         *
         * @param {number} duration transition duration
         * @param {boolean} tagOld indicate if the object shall be tagged as "old data"
         */
        self.d3.o.clipPath.quickUpdate = function (duration, tagOld) {

            let color = self.d3.o.clipPath.strokeColor;
            if (tagOld) {
                color = "darkgrey";
            }

            // Redraw rectangles defining the mask
            self.d3.o.clipPath.o
                .selectAll(".clipPathRect")
                .attr("x", function (d) {
                    return self.d3.t.timeScale(d[0]);
                })
                .attr("y", 0)
                .attr("width", function (d) {
                    return self.d3.t.timeScale(d[1]) - self.d3.t.timeScale(d[0]);
                })
                .attr("height", self.d3.c.height);

            // Redraw the curve matching the clipping
            self.d3.o.graph.selectAll(".clipPathCurve")
                .attr("stroke", color)
                .attr("stroke-width", "2")
                .attr("fill", "none")
                .attr("transform", "translate(-" + self.d3.c.marginSide + " -" + self.d3.c.marginTopBot + ")")
                .attr("clip-path", "url(#clip_path_pattern)")
                .datum(self.selection.points)
                .transition().duration(duration)
                .attr("d", function () {
                    return self.d3.o.tsLine.line(self.d3.v.rawValues);
                });
        };

        /**
         * Apply a full update of the object clipPath
         * @param duration {number} transition duration
         * @param keepX {boolean} indicating if the scaling of X has to be updated
         * @param keepY {boolean} indicating if the scaling of Y has to be updated
         */
        self.d3.o.clipPath.fullUpdate = function (duration, keepX, keepY) {

            if (!keepX) {
                self.d3.t.timeScale.domain(d3.extent(self.d3.v.rawTimestamps));
            }

            if (!keepY) {
                self.d3.o.tsLine.valueScale.domain([self.d3.v.minVal, self.d3.v.maxVal]);
            }

            // Clear old clip path information
            $("#clip_path_pattern").empty();
            $(".clipPathRect").remove();
            $(".clipPathCurve").remove();

            // Sync with intervals component display
            if (self.selection.intervals.length > 0 && self.selection.intervals.length < self.d3.o.intervals.maxItems) {

                self.d3.o.clipPath.quickUpdate(0, false);

                // UPDATE
                self.d3.o.clipPath.o
                    .selectAll(".clipPathRect")
                    .data(self.selection.intervals)
                    .enter()
                    .append("rect")
                    .attr("class", "clipPathRect")
                    .attr("x", function (d) {
                        return self.d3.t.timeScale(d[0]);
                    })
                    .attr("y", 0)
                    .attr("width", function (d) {
                        return self.d3.t.timeScale(d[1]) - self.d3.t.timeScale(d[0]);
                    })
                    .attr("height", self.d3.c.height);

                self.d3.o.graph.append("path")
                    .attr("class", "clipPathCurve")
                    .attr("stroke", "red")
                    .attr("stroke-width", "2")
                    .attr("fill", "none")
                    .attr("transform", "translate(-" + self.d3.c.marginSide + " -" + self.d3.c.marginTopBot + ")")
                    .attr("clip-path", "url(#clip_path_pattern)")
                    .datum(self.selection.points)
                    .attr("d", function () {
                        return self.d3.o.tsLine.line(self.d3.v.rawValues);
                    });
            }
        };
    }

    /**
     * Initialize all D3 Objects
     * - SVG
     * - xAxis
     * - yAxis
     * - menuBar
     *  - ts_selector
     *  - TSOptions
     * - screen
     * - graph
     * - selectionBar
     * - tsLine
     * - intervals
     * - scores
     * - clipPath
     */
    initD3Objects() {
        const self = this;

        // Menu bar component for pattern selection
        self.d3.o.menuBarLinePattern = d3.select(`#${self.container}`)
            .append("div")
            .attr("class", "row");

        // Don't show combo box if only one pattern
        if (Object.keys(self.data.patterns).length > 1) {
            self.d3.o.menuBarLinePattern
                .append("div")
                .attr("class", "col-xs-2")
                .append("h6")
                .style("float", "right")
                .text("Pattern : ");

            self.d3.o.ts_selector = self.d3.o.menuBarLinePattern
                .append("div")
                .attr("class", "col-xs-10")
                .append("select")
                .attr("class", "form-control")
                .on("change", function () {
                    // Clear previous svg components
                    self.d3.o.svg.remove();
                    self.d3.o.menuBarLineTS.remove();
                    self.d3.o.menuBarLineRegex.remove();
                    self.d3.o.menuBarLinePattern.remove();

                    // Initialize the display
                    // this.value represents the selected value of the select box being changed
                    self.selection.index = parseInt(this.value, 10);
                    self.selection.pattern_index = 0;
                    self.getData(null, null, function () {
                        self.initD3();
                        self.fullRedraw(200, false);
                    });
                });

            // Select box options
            self.d3.o.ts_selector.selectAll("option")
                .data(self.data.pattern_names)
                .enter()
                .append("option")
                .attr("value", function (d, i) {
                    return i;
                })
                .text(function (d) {
                    return d;
                })
                .each(function (d, i) {
                    if (self.selection.index === i) {
                        d3.select(this).attr("selected", "");
                    }
                });
        } else {
            const p = self.data.patterns;
            self.d3.o.menuBarLinePattern
                .append("div")
                .attr("class", "col-xs-2")
                .append("h6")
                .style("float", "right")
                .text("Pattern : ");

            self.d3.o.menuBarLinePattern
                .append("div")
                .attr("class", "col-xs-10")
                .append("h6")
                .style("font-weight", "bold")
                .text(Object.keys(p)[0]);

            self.selection.index = 0;
        }

        // Menu bar component for TS selection
        self.d3.o.menuBarLineTS = d3.select(`#${self.container}`)
            .append("div")
            .attr("class", "row");

        // Don't show combo box if only one TS
        if (self.selection.all_fids.length > 1) {
            self.d3.o.menuBarLineTS
                .append("div")
                .attr("class", "col-xs-2")
                .append("h6")
                .style("float", "right")
                .text("Time series : ");

            self.d3.o.ts_selector2 = self.d3.o.menuBarLineTS
                .append("div")
                .attr("class", "col-xs-10")
                .append("select")
                .attr("class", "form-control")
                .on("change", function () {
                    // Clear previous svg components
                    self.d3.o.svg.remove();
                    self.d3.o.menuBarLineTS.remove();
                    self.d3.o.menuBarLineRegex.remove();
                    self.d3.o.menuBarLinePattern.remove();

                    // Initialize the display
                    // this.value represents the selected value of the select box being changed
                    self.selection.pattern_index = parseInt(this.value, 10);
                    self.getData(null, null, function () {
                        self.initD3();
                        self.fullRedraw(200, false);
                    });
                });

            self.d3.o.ts_selector2.selectAll("option")

                .data(self.selection.all_fids)
                .enter()
                .append("option")
                .attr("value", function (d, i) {
                    return i;
                })
                .text(function (d) {
                    return d;
                })
                .each(function (d, i) {
                    if (self.selection.pattern_index === i) {
                        d3.select(this).attr("selected", "");
                    }
                });
        } else {
            self.d3.o.menuBarLineTS
                .append("div")
                .attr("class", "col-xs-2")
                .append("h6")
                .style("float", "right")
                .text("Timeseries : ");
            self.d3.o.menuBarLineTS
                .append("div")
                .attr("class", "col-xs-10")
                .append("h6")
                .style("font-weight", "bold")
                .text(self.selection.all_fids[0]);
        }

        // Menu bar component (Selection of the TS to display)
        self.d3.o.menuBarLineRegex = d3.select(`#${self.container}`)
            .append("div")
            .attr("class", "row");
        self.d3.o.menuBarLineRegex.append("div")
            .attr("class", "col-xs-2")
            .append("h6")
            .style("float", "right")
            .text("Current pattern definition : ");
        self.d3.o.menuBarLineRegex.append("div")
            .attr("class", "col-xs-9")
            .append("h6")
            .style("font-weight", "bold")
            .text(function () {
                if (self.selection.regex.length > 100) {
                    return self.selection.regex.substr(0, 100) + "...";
                }
                return self.selection.regex;
            });

        const menuBarHeight = self.d3.o.menuBarLineRegex.node().getBoundingClientRect().bottom -
            self.d3.o.menuBarLineRegex.node().getBoundingClientRect().top +
            self.d3.o.menuBarLineTS.node().getBoundingClientRect().bottom -
            self.d3.o.menuBarLineTS.node().getBoundingClientRect().top +
            self.d3.o.menuBarLinePattern.node().getBoundingClientRect().bottom -
            self.d3.o.menuBarLinePattern.node().getBoundingClientRect().top;
        // SVG component
        self.d3.o.svg = d3.select(`#${self.container}`)
            .append("svg")
            .attr("width", "100%")
            .attr("height", "calc(100% - " + menuBarHeight + "px)")
            .attr("viewBox", `0 0 ${self.d3.c.width} ${self.d3.c.height}`);

        // Horizontal axis component
        self.d3.o.xAxis = d3.axisBottom(self.d3.t.timeScale)
            .ticks(Math.min(5, self.d3.v.rawTimestamps.length))
            .tickFormat(function (d) {
                const date = new Date(d);
                return date.toISOString();
            });

        // Vertical axis component
        self.d3.o.yAxis = d3.axisLeft(self.d3.t.valueScale)
            .ticks(10);

        // Container filling all available space inside draw area
        self.d3.o.screen = self.d3.o.svg.append("g")
            .attr("transform", `translate(${self.d3.c.marginSide} ${self.d3.c.marginTopBot})`);

        // Container of the chart
        self.d3.o.graph = self.d3.o.screen.append("svg")
            .attr("width", self.d3.c.width - self.d3.c.marginSide * 2)
            .attr("height", self.d3.c.height - self.d3.c.marginTopBot * 2)
            .on("dblclick", function () {
                if (d3.event.ctrlKey) {
                    // ctrl + dblClick -> zoom out
                    self.d3.a.zoom.out();
                }
                else {
                    // dblClick -> zoom reset
                    self.d3.a.zoom.reset();
                }
            })
            .call(self.d3.a.zoom.do);

        // Background for charts
        self.d3.o.graph.append("rect")
            .attr("width", self.d3.c.width)
            .attr("height", self.d3.c.height)
            .attr("fill", "#FFFFFF");

        // Drag selection highlights
        self.d3.o.selectionBar = self.d3.o.graph.append("rect")
            .attr("fill", "green")
            .attr("opacity", "0.3");

        self.initD3TsLine();

        self.initD3Intervals();

        self.initD3ClipPath();
    }


    /**
     * Initialize the Zoom behaviour
     */
    initZoom() {
        const self = this;

        // Zoom
        self.d3.a.zoom = {
            originSelectPoint: {x: 0, y: 0}
        };
        self.d3.a.zoom.do = d3.drag()
            .on("start", function () {
                // Keep trace of the origin of the drag
                self.d3.a.zoom.originSelectPoint.x = d3.event.x;
                self.d3.a.zoom.originSelectPoint.y = d3.event.y;
            })
            // Display a selection rectangle over graph while dragging
            .on("drag", function () {
                //check if the selection is vertical or horizontal
                const dx = d3.event.x - self.d3.a.zoom.originSelectPoint.x;
                const dy = d3.event.y - self.d3.a.zoom.originSelectPoint.y;
                if (Math.abs(dx) > Math.abs(dy)) { // Vertical selection
                    if (dx < 0) {
                        self.d3.o.selectionBar
                            .attr("x", self.d3.a.zoom.originSelectPoint.x + dx)
                            .attr("y", 0)
                            .attr("width", Math.abs(dx))
                            .attr("height", self.d3.c.height);
                    } else {
                        self.d3.o.selectionBar
                            .attr("x", self.d3.a.zoom.originSelectPoint.x)
                            .attr("y", 0)
                            .attr("width", dx)
                            .attr("height", self.d3.c.height);
                    }
                } else { // Horizontal selection
                    if (dy < 0) {
                        self.d3.o.selectionBar
                            .attr("y", self.d3.a.zoom.originSelectPoint.y + dy)
                            .attr("x", 0)
                            .attr("width", self.d3.c.width)
                            .attr("height", Math.abs(dy));
                    } else {
                        self.d3.o.selectionBar
                            .attr("y", self.d3.a.zoom.originSelectPoint.y)
                            .attr("x", 0)
                            .attr("width", self.d3.c.width)
                            .attr("height", dy);
                    }
                }
            })
            // If the drag was consistent (not a click), rescale the graph according to selection
            .on("end", function () {

                // Reset selection rectangle
                self.d3.o.selectionBar
                    .attr("width", 0)
                    .attr("height", 0);

                const dx = d3.event.x - self.d3.a.zoom.originSelectPoint.x;
                const dy = d3.event.y - self.d3.a.zoom.originSelectPoint.y;
                if (dx !== 0 || dy !== 0) {
                    if (Math.abs(dx) > Math.abs(dy)) {
                        // Time scale
                        self.d3.t.timeScale.domain([
                            self.d3.t.timeScale.invert(
                                Math.min(d3.event.x, self.d3.a.zoom.originSelectPoint.x) + self.d3.c.marginSide),
                            self.d3.t.timeScale.invert(
                                Math.max(d3.event.x, self.d3.a.zoom.originSelectPoint.x) + self.d3.c.marginSide)
                        ]);

                        const transitionEnd = self.quickRedraw(300, true);

                        transitionEnd.then(function () {
                            // Refresh points (to have accurate values)
                            self.getData(...self.d3.t.timeScale.domain(), function () {
                                self.initD3Variables();
                                self.fullRedraw(0, true, true);
                            });
                        });

                    } else {
                        // Value scale
                        self.d3.t.valueScale.domain([
                            self.d3.t.valueScale.invert(
                                Math.max(d3.event.y, self.d3.a.zoom.originSelectPoint.y) + self.d3.c.marginTopBot),
                            self.d3.t.valueScale.invert(
                                Math.min(d3.event.y, self.d3.a.zoom.originSelectPoint.y) + self.d3.c.marginTopBot)
                        ]);

                        self.quickRedraw(500, false);
                    }
                }
            });

        /**
         * Apply a zoom reset
         */
        self.d3.a.zoom.reset = function () {

            // Refresh points (to have accurate values)

            const transitionEnd = self.quickRedraw(300, true);

            transitionEnd.then(function () {
                self.getData(null, null, function () {
                    self.initD3Variables();
                    self.fullRedraw(0, false);
                });
            });

        };
        /**
         * Apply a zoom out
         */
        self.d3.a.zoom.out = function () {

            const delta = self.d3.t.timeScale.domain()[1] - self.d3.t.timeScale.domain()[0];

            const minWindow = self.d3.t.timeScale.domain()[0] - delta;
            const maxWindow = self.d3.t.timeScale.domain()[1] + delta;

            // Refresh points (to have accurate values)
            const transitionEnd = self.quickRedraw(200, true);

            transitionEnd.then(function () {
                self.getData(minWindow, maxWindow, function () {
                    self.initD3Variables();
                    self.fullRedraw(0, false);
                });
            });


        };
    }

    /**
     * Initialize the pan behaviour
     */
    initPan() {
        const self = this;

        // PAN
        self.d3.a.pan = {
            // Origin point of the drag (converted to timestamps)
            originPoint: null,
            // Current time shift during pan interaction (in timestamp)
            timeShift: null,
            // Instance of scale (permits avoiding side effect due to scale changing)
            keepX: null
        };

        // Handle pan action
        self.d3.a.pan.do = d3.drag()
            .on("start", function () {
                self.d3.a.pan.keepX = self.d3.t.timeScale.copy();
                self.d3.a.pan.originPoint = self.d3.a.pan.keepX.invert(d3.event.x);
            })
            .on("drag", function () {
                self.d3.a.pan.timeShift = self.d3.a.pan.originPoint - self.d3.a.pan.keepX.invert(d3.event.x);
                self.d3.t.timeScale.domain([
                    self.d3.a.pan.keepX.domain()[0] + self.d3.a.pan.timeShift,
                    self.d3.a.pan.keepX.domain()[1] + self.d3.a.pan.timeShift
                ]);
                self.quickRedraw(0, true);
            })
            .on("end", function () {
                // Refresh points
                self.getData(...self.d3.t.timeScale.domain(), function () {
                    self.initD3Variables();
                    self.fullRedraw(0, true);
                });
                self.d3.a.pan.originPoint = null;
                self.d3.a.pan.keepX = null;
            });
    }

    initD3Transformations() {
        const self = this;

        // Sets up a D3 scale for time (will be used as horizontal)
        self.d3.t.timeScale = d3.scaleLinear()
        // Timestamp range
            .domain(d3.extent(self.d3.v.rawTimestamps))
            // Display range
            .range([(self.d3.c.marginSide), (self.d3.c.width - self.d3.c.marginSide)]);

        // Sets up a D3 scale for values (will be used as vertical)
        self.d3.t.valueScale = d3.scaleLinear()
        // Timestamp range
            .domain([self.d3.v.minVal, self.d3.v.maxVal])
            // Display range
            .range([(self.d3.c.height - self.d3.c.marginTopBot), (self.d3.c.marginTopBot)]);

    }

    /**
     * Initialize all D3 Actions
     * - pan
     * - zoom
     */
    initD3Actions() {
        this.initPan();
        this.initZoom();
    }

    /**
     * Initialization of D3 Events handler
     */
    initD3Events() {

        const self = this;

        self.d3.e.shiftPressed = false;

        // Adds listener to update drag behavior according to SHIFT Key state
        d3.select("body")
            .on("keydown", function () {
                if (!self.d3.e.shiftPressed && d3.event.shiftKey) {
                    self.d3.e.shiftPressed = true;
                    self.d3.o.graph.call(self.d3.a.pan.do);
                }
            })
            .on("keyup", function () {
                if (self.d3.e.shiftPressed && !d3.event.shiftKey) {
                    self.d3.e.shiftPressed = false;
                    self.d3.o.graph.call(self.d3.a.zoom.do);
                }
            });
    }


    /**
     *  Update components translation and scale
     */
    quickRedraw(duration, tagOld = false) {

        const self = this;

        // The promise is used to wait for the animation ends before redrawing the graph
        return new Promise(function (resolve) {

            // Just quick-update objects
            self.d3.o.intervals.quickUpdate(duration, tagOld);
            self.d3.o.tsLine.quickUpdate(duration, tagOld);
            self.d3.o.clipPath.quickUpdate(duration, tagOld);

            self.d3.o.svg.select(".xaxis")
                .transition().duration(duration)
                .call(self.d3.o.xAxis);

            self.d3.o.svg.select(".yaxis")
                .transition().duration(duration)
                .on("end", function () {
                    resolve();
                })
                .call(self.d3.o.yAxis);
        });
    }

    /**
     *  Calculate all the graphical components with current environment configuration (zoom, move,..)
     */
    fullRedraw(commonDuration, keepX = false, keepY = false) {

        const self = this;

        if (!keepX) {
            self.d3.o.svg.select(".xaxis")
                .transition().duration(commonDuration)
                .call(self.d3.o.xAxis);
        }

        if (!keepY) {
            self.d3.o.svg.select(".yaxis")
                .transition().duration(commonDuration)
                .call(self.d3.o.yAxis);
        }

        // Redraw all objects
        self.d3.o.intervals.fullUpdate(commonDuration, keepX, keepY);
        self.d3.o.tsLine.fullUpdate(commonDuration, keepX, keepY);
        self.d3.o.clipPath.fullUpdate(commonDuration, keepX, keepY);
    }

    sleep() {
        this.pendingQueries.forEach(function (query) {
            query.abort();
            console.warn("aborting a query");
        });
        this.pendingQueries = [];
    }
}
