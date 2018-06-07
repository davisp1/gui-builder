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
"use strict";
/**
 * Formatted Library of all core operators
 * @type {OP_INFO[]}
 */
const CORE_OPERATORS_LIB = [];

/** *
 * Create the core operator list as {@link OP_INFO} type using a generic raw object
 */
function BuildCoreOperatorsList() {
    let op_id = 1;
    _core_op_lib.forEach(function (ref_op) {

        const op = new OP_INFO(null, op_id++, false);

        op.name = ref_op.name || "No name";
        op.desc = ref_op.description || "No description";
        op.label = ref_op.label || ref_op.name || "No label";
        op.family = ref_op.family || "No family";

        if (!ref_op.inputs) {
            ref_op.inputs = [];
        }
        ref_op.inputs.forEach(function (input) {
            op.addInput(input.name, input.label, input.description, input.type);
        });

        if (!ref_op.parameters) {
            ref_op.parameters = [];
        }
        ref_op.parameters.forEach(function (param) {
            op.addParameter(param.name, param.label, param.description, param.type, param.default_value, param.dov, param.onEvent);
        });
        if (!ref_op.outputs) {
            ref_op.outputs = [];
        }
        ref_op.outputs.forEach(function (output) {
            op.addOutput(output.name, output.label, output.description, output.type);
        });

        // Bind existing methods to override default ones
        if (ref_op.init) {
            op.init = ref_op.init;
        }
        if (ref_op.run) {
            op.run = ref_op.run;
        }
        if (ref_op.poll) {
            op.poll = ref_op.poll;
        }
        if (ref_op.onConnUpdate) {
            op.onConnUpdate = ref_op.onConnUpdate;
        }


        CORE_OPERATORS_LIB.push(op);
    });
}

/**
 * Raw core operator library
 * @type {Array}
 * @private
 */
let _core_op_lib = [
    {
        name: "Dataset Selection",
        label: "Dataset Selection",
        description: "Get a TS list from a dataset name",
        family: "Dataset Preparation/Data Selection",
        outputs: [
            {
                name: "ts_list",
                label: "TS list",
                type: "ts_list"
            },
            {
                name: "Name",
                label: "Name",
                type: "ds_name"
            }
        ],
        parameters: [
            {
                name: "Source",
                label: "Source",
                description: "Select the source dataset for your Workflow",
                type: "ds_list",
                default_value: null,
                onEvent: function (node) {
                    node.run();
                }
            }
        ],
        init: function () {

            const self = this;
            self.progress(50, OP_STATES.idle);
            self.getParameter("Source").dov = null;

            ikats.api.ds.list({
                async: true,
                success: function (result) {
                    self.getParameter("Source").dov = result.data;
                    self.progress(100, OP_STATES.idle);
                },
                error: function (r) {
                    self.getParameter("Source").dov = [];
                    self.progress(100, OP_STATES.ko);
                    console.error("Can't connect to database ", r.status_msg);
                }
            });
        },
        run: function () {
            const self = this;
            this.progress(100, OP_STATES.run);

            const param = self.getParameter("Source");
            const out_ts_list = self.getOutput("ts_list");
            const out_ds_name = self.getOutput("Name");

            ikats.api.ds.read({
                ds_name: param.value.name,
                async: true,
                success: function (r) {
                    out_ts_list.value = r.data.ts_list;
                    out_ds_name.value = param.value.name;
                    self.progress(100, OP_STATES.ok);
                },
                error: function (r) {
                    self.progress(100, OP_STATES.ko);
                    console.error("Error occurred " + r.status_msg);
                }
            });
        }
    },
    {
        name: "Filter",
        label: "Filter",
        description: "Filter TS using metadata",
        family: "Dataset Preparation/Data Selection",
        op_id: 2,
        inputs: [
            {
                name: "TS",
                label: "TS list",
                type: "ts_list"
            }
        ],
        outputs: [
            {
                name: "TS",
                label: "TS list",
                type: "ts_list",
                value: null
            },
            {
                name: "Ratio",
                label: "Ratio",
                type: "percentage",
                value: null
            }
        ],
        parameters: [
            {
                name: "Criteria",
                label: "Criteria",
                type: "md_filter",
                description: "Filter the input data according to meta-data",
                default_value: [{}],
                dov: null,
                onEvent: function (node) {
                    node.run();
                }
            }
        ],
        init: function () {
            const param_criteria = this.getParameter("Criteria");
            ikats.api.md.types({
                async: true,
                success: function (r) {
                    param_criteria.dov = r.data;
                },
                error: function (r) {
                    this.progress(100, OP_STATES.ko);
                    console.error("Impossible to get metadata List", r);
                }
            });
        },
        onConnUpdate: function () {
            this.progress(100, OP_STATES.idle);
        },
        run: function () {
            this.progress(10, OP_STATES.run);

            let in_ts_list = this.getInput("TS").getValue();
            if ((in_ts_list === null) || (in_ts_list.length === 0)) {
                this.progress(100, OP_STATES.idle);
                return;
            }

            let dsName = "";
            if (typeof (in_ts_list) === "string") {
                dsName = in_ts_list;
                in_ts_list = [];
            }

            this.progress(100, OP_STATES.run);

            const param_criteria = this.getParameter("Criteria");
            const criteria_to_send = JSON.parse(angular.toJson(param_criteria.value));

            // Convert date into timestamp EPOCH milliseconds
            criteria_to_send.map(function (x) {
                if ((param_criteria.dov[x.meta_name] === "date") && (x.comparator.indexOf("like") === -1)) {
                    if (/^\d+$/.test(x.value)) {
                        // Timestamp provided
                        x.value = parseInt(x.value, 10);
                    }
                    else {
                        try {
                            x.value = Date.parse(x.value);
                        }
                        catch (e) {
                            console.error("Error while parsing the value of " + x.meta_name);
                        }
                    }
                }
            });

            const out_ts_list = this.getOutput("TS");
            const out_ratio = this.getOutput("Ratio");


            const self = this;

            ikats.api.ts.list({
                async: true,
                ds_name: dsName,
                ts_list: in_ts_list,
                criteria: criteria_to_send,
                success: function (r) {
                    out_ts_list.value = r.data;

                    // Ratio precision
                    let precision = 3;

                    out_ratio.value = parseInt(
                        Math.pow(10, precision) *
                        out_ts_list.value.length / in_ts_list.length, 10) *
                        Math.pow(10, -precision);
                    if (dsName === "") {
                        notify().info(out_ts_list.value.length + " TS filtered");
                        console.info(out_ts_list.value.length + " TS filtered out of " + in_ts_list.length + " (" + out_ratio.value + "%)");
                    }
                    else {
                        console.info(out_ts_list.value.length + " TS filtered");
                    }

                    self.progress(100, OP_STATES.ok);

                },
                error: function (r) {

                    if (r.debug.status === 404) {
                        out_ratio.value = 0;
                        out_ts_list.value = [];
                        self.progress(100, OP_STATES.ok);
                        notify().info("No results");
                        console.error("No results");
                    }
                    else {
                        self.progress(100, OP_STATES.ko);
                        notify().error(r.status_msg);
                        console.error(r.status_msg);
                    }
                }
            });
        }
    },
    {
        name: "Manual Selection",
        label: "Manual Selection",
        description: "Manually filter a TS list",
        family: "Dataset Preparation/Data Selection",
        op_id: 3,
        inputs: [
            {
                name: "TS",
                label: "TS list",
                type: "ts_list"
            }
        ],
        outputs: [
            {
                name: "ts_list",
                label: "TS list",
                type: "ts_list",
                value: null
            }
        ],
        parameters: [
            {
                name: "Selection",
                label: "Selection",
                type: "ts_selection",
                description: "List of Time series",
                default_value: null,
                dov: null,
                onEvent: function (node) {
                    node.run();
                }
            }
        ],
        init: function () {
            const in_ts_list = this.getInput("TS").getValue();
            const param_list = this.getParameter("Selection");
            param_list.dov = in_ts_list;
            this.progress(100, OP_STATES.idle);
        },
        onConnUpdate: function () {
            this.progress(100, OP_STATES.idle);
            this.init();
            const param_list = this.getParameter("Selection");
            let oldSelection = [];
            if (this.getParameter("Selection").value) {
                oldSelection = this.getParameter("Selection").value.slice();
            }
            if (param_list.value && this.getParameter("Selection").value) {
                this.getParameter("Selection").value = param_list.value.filter(function (param) {
                    if (param_list.dov) {
                        return param_list.dov.map(function (val) {
                                return val.tsuid;
                            }).includes(param.tsuid) &&
                            param_list.dov.map(function (val) {
                                return val.funcId;
                            }).includes(param.funcId);
                    } else {
                        return false;
                    }
                });
            }
            if (!this.getParameter("Selection").value || oldSelection.length !== this.getParameter("Selection").value.length) {
                if (this.getOutput("ts_list").value) {
                    this.getOutput("ts_list").value.length = 0;
                }
                this.progress(100, OP_STATES.idle);
            }
            if (this.getOutput("ts_list").value && this.getOutput("ts_list").value.length) {
                this.progress(100, OP_STATES.ok);
            }
        },
        run: function () {
            const param_list = this.getParameter("Selection").value;
            const out_ts_list = this.getOutput("ts_list");
            out_ts_list.value = param_list;
            if (out_ts_list.value) {
                this.progress(100, OP_STATES.ok);
            } else {
                this.progress(100, OP_STATES.idle);
            }
        }
    },
    {
        name: "Save as dataset",
        label: "Save as dataset",
        description: "Save a list of TS as a new Dataset",
        op_id: 4,
        family: "Dataset Preparation/Dataset Management",
        inputs: [
            {
                name: "ts_list",
                label: "TS list",
                type: "ts_list"
            }
        ],
        outputs: [
            {
                name: "ts_list",
                label: "TS list",
                type: "ts_list"
            },
            {
                name: "ds",
                label: "DS name",
                type: "ds_name"
            }
        ],
        parameters: [
            {
                name: "List",
                label: "TS List",
                type: "ts_selection",
                description: "Select the TS to save",
                default_value: null,
                value: null,
                dov: null
            },
            {
                name: "Name",
                label: "Dataset Name",
                type: "text",
                description: "Name of the dataset to create",
                default_value: "",
            },
            {
                name: "Description",
                label: "Description",
                type: "text",
                description: "Description of the dataset to create",
                default_value: "",
            }
        ],
        init: function () {
            const in_ts_list = this.getInput("ts_list").getValue();
            const param_list = this.getParameter("List");
            param_list.dov = in_ts_list;
            param_list.value = in_ts_list;
            this.progress(100, OP_STATES.idle);
        },
        onConnUpdate: function () {
            this.progress(10, OP_STATES.idle);
            this.init();
        },
        run: function (silent_mode) {
            this.progress(100, OP_STATES.run);

            const in_ts_list = this.getInput("ts_list").getValue();

            const param_name = this.getParameter("Name").value;
            const param_desc = this.getParameter("Description").value;

            const tsuid_list = in_ts_list.map(function (x) {
                return x.tsuid;
            });

            // TODO Handle async mode for DS creation
            const r = ikats.api.ds.create({
                name: param_name,
                desc: param_desc,
                ts_list: tsuid_list
            });

            if (r.status) {
                if (!silent_mode) {
                    console.info("Dataset " + param_name + " created");
                }

                this.progress(100, OP_STATES.ok);
                this.getOutput("ts_list").value = in_ts_list;
                this.getOutput("ds").value = param_name;
            }
            else {
                console.error(r.status_msg);
                this.progress(100, OP_STATES.ko);
            }
        }
    },
    {
        name: "Merge TS lists",
        label: "Merge TS lists",
        description: "Merge 2 TS lists into 1",
        op_id: 5,
        family: "Dataset Preparation/Dataset Management",
        inputs: [
            {
                name: "TS_1",
                label: "TS list 1",
                type: "ts_list"
            },
            {
                name: "TS_2",
                label: "TS list 2",
                type: "ts_list"
            }
        ],
        outputs: [
            {
                name: "Merged",
                label: "Merged TS list",
                type: "ts_list"
            }
        ],
        parameters: [],
        onConnUpdate: function () {
        },
        run: function () {
            this.progress(100, OP_STATES.run);

            const in_ts_1 = this.getInput("TS_1").getValue();
            const in_ts_2 = this.getInput("TS_2").getValue();

            const out_ts_list = this.getOutput("Merged");

            // Remove duplicates
            const dup_keys = {};
            let tmp_list = [];
            if (in_ts_1 !== null) {
                tmp_list = tmp_list.concat(in_ts_1);
            }
            if (in_ts_2 !== null) {
                tmp_list = tmp_list.concat(in_ts_2);
            }
            if (tmp_list.length > 0) {
                tmp_list.map(function (x) {
                    dup_keys[x.tsuid] = x.funcId;
                });
                out_ts_list.value = [];
                for (let k in dup_keys) {
                    out_ts_list.value.push({tsuid: k, funcId: dup_keys[k]});
                }
                this.progress(100, OP_STATES.ok);
            }
            else {
                out_ts_list.value = null;
                this.progress(100, OP_STATES.ko);
            }

        }
    },
    {
        name: "Population Selection",
        label: "Population Selection",
        description: "CSV file ingestion to create a population table",
        family: "Dataset Preparation/Data Selection",
        op_id: 7,
        parameters: [
            {
                name: "file",
                label: "Select a csv file",
                description: "Select the source csv file",
                type: "file",
                default_value: null,
            },
            {
                name: "pop_name",
                label: "Population name",
                description: "Name of the ingested population (must be a string composed by alphanumerical characters and/or hyphens and/or underscores)",
                type: "text",
                default_value: null,
            },
            {
                name: "row_name",
                label: "Table key (row name)",
                description: "CSV column header name used as unique id for records",
                type: "text",
                default_value: null,
            }
        ],
        outputs: [
            {
                name: "table",
                label: "table",
                type: "table"
            }
        ],
        init: function () {

            const self = this;
            self.progress(100, OP_STATES.idle);

        },
        run: function () {
            const self = this;
            this.progress(100, OP_STATES.run);

            const file = self.getParameter("file");
            const row_name = self.getParameter("row_name");
            const pop_name = self.getParameter("pop_name");
            const out_table = self.getOutput("table");

            if (file.filename === null || file.value === null || row_name.value === null || pop_name.value === null) {
                self.progress(100, OP_STATES.ko);
                const error = "Error occurred : at least one parameter is not filled";
                console.error(error);
                notify().error(error);
            }
            else {
                ikats.api.table.createFromCSV({
                    file_content: atob(file.value.split(",")[1]),
                    filename: file.filename,
                    row_name: row_name.value,
                    table_name: pop_name.value,
                    async: true,
                    success: function (r) {
                        if (is2xx(r.debug.status)) {
                            out_table.rid = null;
                            out_table.value = pop_name.value;
                            self.progress(100, OP_STATES.ok);
                        }
                        else {
                            self.progress(100, OP_STATES.ko);
                            console.error(r.status_msg);
                            notify().error(r.status_msg);
                        }
                    },
                    error: function (r) {
                        self.progress(100, OP_STATES.ko);
                        console.error(r.debug.responseText);
                        notify().error(r.debug.responseText);
                    }
                });
            }
        }
    },
    {
        name: "TSFinder",
        label: "TS Finder",
        description: "Find a TS by its TSUID/FID pattern",
        family: "Dataset Preparation/Data Selection",
        op_id: 9,
        inputs: [],
        outputs: [
            {
                name: "out",
                label: "TS list",
                type: "ts_list",
                value: null
            }
        ],
        parameters: [
            {
                name: "pattern",
                label: "Pattern to find",
                type: "text",
                description: "wildcards allowed",
                value: ""
            },
            {
                name: "case",
                label: "Case Sensitive",
                type: "bool",
                description: "Search case type",
                default_value: false
            }
        ],
        init: function () {
            this.progress(100, OP_STATES.idle);
        },
        onConnUpdate: function () {
            this.init();
        },
        run: function () {
            this.progress(100, OP_STATES.run);

            const pattern = this.getParameter("pattern").value || "*";
            const cs = this.getParameter("case").value;
            const output = this.getOutput("out");

            const self = this;
            ikats.api.ts.fid({
                async: true,
                success: function (results) {
                    output.value = $.grep(results.data, function (x) {
                        return isIn(pattern, x.funcId, cs);
                    });

                    console.debug(output.value.length + " matches");

                    self.getParameter("pattern").label = "Pattern to find (" + output.value.length + ")";
                    self.progress(100, OP_STATES.ok);
                },
                error: function () {
                    self.progress(100, OP_STATES.ko);
                }
            });

        }
    },
    {
        name: "Ts2Feature",
        label: "Ts2Feature",
        description: "Transforming table to feature",
        family: "Pre-Processing On Ts/Transforming",
        op_id: 12,
        inputs: [
            {
                name: "table",
                label: "Table",
                type: "table"
            }
        ],
        parameters: [
            {
                name: "pop_name",
                label: "Population label",
                description: "property used to identify rows in output table (table key)",
                type: "text",
                default_value: null,
            },
            {
                name: "aggregated_by",
                label: "Aggregated by",
                description: "used to aggregate input columns in order to create new features",
                type: "text",
                default_value: null,
            },
            {
                name: "output_table_name",
                label: "Output table name",
                description: "name of the output table",
                type: "text",
                default_value: null,
            }
        ],
        outputs: [
            {
                name: "table",
                label: "Table",
                type: "table"
            }
        ],
        init: function () {

            const self = this;
            self.progress(100, OP_STATES.idle);

        },
        run: function () {
            const self = this;
            this.progress(100, OP_STATES.run);

            const tableName = self.getInput("table").getValue();
            const aggregated_by = self.getParameter("aggregated_by");
            const population_id = self.getParameter("pop_name");
            const output_table_name = self.getParameter("output_table_name");
            const out_table = self.getOutput("table");

            if (aggregated_by.value === null || population_id.value === null || output_table_name.value === null) {
                self.progress(100, OP_STATES.ko);
                const error = "Error occurred : at least one parameter is not filled";
                console.error(error);
                notify().error(error);
            }
            else {
                ikats.api.table.ts2feature({
                    tableName: tableName,
                    meta_name: aggregated_by.value,
                    population_id: population_id.value,
                    output_table_name: output_table_name.value,
                    async: true,
                    success: function (r) {
                        if (is2xx(r.debug.status)) {
                            out_table.rid = null;
                            out_table.value = r.data;
                            self.progress(100, OP_STATES.ok);
                        }
                        else {
                            self.progress(100, OP_STATES.ko);
                            console.error(r.status_msg);
                            notify().error(r.status_msg);
                        }
                    },
                    error: function (r) {
                        self.progress(100, OP_STATES.ko);
                        console.error(r.debug.responseText);
                        notify().error(r.debug.responseText);
                    }
                });
            }
        }
    },
    {
        name: "AddTsColumn",
        label: "AddTsColumn",
        description: "Join a table with metrics values",
        family: "Processing On Tables",
        op_id: 13,
        inputs: [
            {
                name: "table",
                label: "Table",
                type: "table"
            },
            {
                name: "ds",
                label: "DS name",
                type: "ds_name"
            }
        ],
        parameters: [
            {
                name: "metrics",
                label: "Metrics",
                description: "list of selected metrics (separated by semicolons)",
                type: "text",
                default_value: null,
            },
            {
                name: "joinColName",
                label: "Join column name",
                description: "the name of the table column used by the join",
                type: "text",
                default_value: null,
            },
            {
                name: "joinMetaName",
                label: "Join meta name",
                description: "the name of the metadata used by the join, useful when the column and metadata names are different",
                type: "text",
                default_value: null,
            },
            {
                name: "targetColName",
                label: "Target column name",
                description: "name of the target column",
                type: "text",
                default_value: null,
            },
            {
                name: "outputTableName",
                label: "Output table name",
                description: "name of the output table",
                type: "text",
                default_value: null,
            }
        ],
        outputs: [
            {
                name: "table",
                label: "Table",
                type: "table"
            }
        ],
        init: function () {

            const self = this;
            self.progress(100, OP_STATES.idle);

        },
        run: function () {
            const self = this;
            this.progress(100, OP_STATES.run);

            const tableName = self.getInput("table").getValue();
            const dataset = self.getInput("ds").getValue();

            const metrics = self.getParameter("metrics");
            const joinColName = self.getParameter("joinColName");
            const joinMetaName = self.getParameter("joinMetaName");
            const targetColName = self.getParameter("targetColName");
            const outputTableName = self.getParameter("outputTableName");
            const outTable = self.getOutput("table");

            if (tableName === null || dataset === null || metrics.value === null || outputTableName.value === null) {
                self.progress(100, OP_STATES.ko);
                const error = "Error occurred : at least one required input or parameter is not filled";
                console.error(error);
                notify().error(error);
            }
            else {
                ikats.api.table.joinMetrics({
                    tableName: tableName,
                    metrics: metrics.value,
                    dataset: dataset,
                    joinColName: joinColName.value || "",
                    joinMetaName: joinMetaName.value || "",
                    targetColName: targetColName.value || "",
                    outputTableName: outputTableName.value || "",
                    async: true,
                    success: function (r) {
                        if (is2xx(r.debug.status)) {
                            outTable.rid = null;
                            outTable.value = r.data;
                            self.progress(100, OP_STATES.ok);
                        }
                        else {
                            self.progress(100, OP_STATES.ko);
                            console.error(r.status_msg);
                            notify().error(r.status_msg);
                        }
                    },
                    error: function (r) {
                        self.progress(100, OP_STATES.ko);
                        console.error(r.debug.responseText);
                        notify().error(r.debug.responseText);
                    }
                });
            }
        }
    },
    {
        name: "ReadTable",
        label: "Read Table",
        description: "Read a table from its identifier",
        family: "Processing On Tables",
        op_id: 14,
        inputs: [],
        parameters: [
            {
                name: "name",
                label: "name",
                description: "Table name: is its unique identifier",
                type: "text",
                default_value: null,
            }
        ],
        outputs: [
            {
                name: "table",
                label: "Table",
                type: "table"
            }
        ],
        init: function () {

            const self = this;
            self.progress(100, OP_STATES.idle);

        },
        run: function () {
            const self = this;
            this.progress(100, OP_STATES.run);


            const name = self.getParameter("name");
            const outTable = self.getOutput("table");

            if (name.value === null || name.value === "") {
                self.progress(100, OP_STATES.ko);
                const error = "Error occurred : parameter name is required";
                console.error(error);
                notify().error(error);
            }
            else {
                outTable.rid = null;
                ikats.api.table.read({
                    table_name: name.value,
                    async: true,
                    success: function (r) {
                        if (is2xx(r.debug.status)) {
                            outTable.value = name.value;
                            self.progress(100, OP_STATES.ok);
                        }
                        else {
                            self.progress(100, OP_STATES.ko);
                            console.error(r.status_msg);
                            notify().error(r.status_msg);
                        }
                    },
                    error: function (r) {
                        self.progress(100, OP_STATES.ko);
                        console.error(r.debug.responseText);
                        notify().error(r.debug.responseText);
                    }
                });
            }
        }
    },
    {
        name: "TrainTestSplit",
        label: "TrainTestSplit",
        description: "Split table into training and testing sets",
        family: "Processing On Tables",
        op_id: 15,
        inputs: [
            {
                name: "table",
                label: "Table",
                type: "table"
            }
        ],
        parameters: [
            {
                name: "targetColumnName",
                label: "Column target name",
                description: "Name of the column target in input table, if exists (not mandatory)",
                type: "text",
                default_value: null,
            },
            {
                name: "repartitionRate",
                label: "Repartition rate",
                description: "Repartition rate between training and test sets in output (ex: rate= 0.6 => 60% train, 40% test)",
                type: "number",
                default_value: null,
            },
            {
                name: "outputTableName",
                label: "Output tables basename",
                description: "Base name used for output tables (ex: basename='split' => output tables named 'split_Train' and 'split_Test')",
                type: "text",
                default_value: null,
            }
        ],
        outputs: [
            {
                name: "trainTable",
                label: "Train",
                type: "table"
            },
            {
                name: "testTable",
                label: "Test",
                type: "table"
            }
        ],
        init: function () {

            const self = this;
            self.progress(100, OP_STATES.idle);

        },
        run: function () {
            const self = this;
            this.progress(100, OP_STATES.run);

            const tableName = self.getInput("table").getValue();
            const targetColumnName = self.getParameter("targetColumnName");
            const repartitionRate = self.getParameter("repartitionRate");
            const outputTableName = self.getParameter("outputTableName");
            const trainTable = self.getOutput("trainTable");
            const testTable = self.getOutput("testTable");

            if (targetColumnName.value === null || repartitionRate.value === null || outputTableName.value === null) {
                self.progress(100, OP_STATES.ko);
                const error = "Error occurred : at least one parameter is not filled";
                console.error(error);
                notify().error(error);
            }
            else {
                ikats.api.table.trainTestSplit({
                    tableName: tableName,
                    targetColumnName: targetColumnName.value,
                    repartitionRate: repartitionRate.value,
                    outputTableName: outputTableName.value,
                    async: true,
                    success: function (r) {
                        if (is2xx(r.debug.status)) {
                            const TableNameList = r.data.split(",");
                            trainTable.value = TableNameList[0];
                            testTable.value = TableNameList[1];
                            self.progress(100, OP_STATES.ok);
                        }
                        else {
                            self.progress(100, OP_STATES.ko);
                            console.error(r.status_msg);
                            notify().error(r.status_msg);
                        }
                    },
                    error: function (r) {
                        self.progress(100, OP_STATES.ko);
                        console.error(r.debug.responseText);
                        notify().error(r.debug.responseText);
                    }
                });
            }
        }
    },
    {
        name: "MergeTables",
        label: "Merge Tables",
        description: "Merge 2 tables into one",
        family: "Processing On Tables",
        op_id: 16,
        inputs: [
            {
                name: "table1",
                label: "Table 1",
                type: "table"
            },
            {
                name: "table2",
                label: "Table 2",
                type: "table"
            }
        ],
        parameters: [
            {
                name: "joinOn",
                label: "Join on",
                description: "The column name to join on. In case of empty the operator will try to join on the first column of each table",
                type: "text",
                default_value: null,
            },
            {
                name: "outputTableName",
                label: "Merged table name",
                description: "Name of the merged table",
                type: "text",
                default_value: null,
            }
        ],
        outputs: [
            {
                name: "outputTable",
                label: "Table 3",
                type: "table"
            }
        ],
        init: function () {

            const self = this;
            self.progress(100, OP_STATES.idle);

        },
        run: function () {
            const self = this;
            this.progress(100, OP_STATES.run);

            const table1 = self.getInput("table1").getValue();
            const table2 = self.getInput("table2").getValue();
            const joinOn = self.getParameter("joinOn");
            const outputTableName = self.getParameter("outputTableName");
            const out_table = self.getOutput("outputTable");

            if (outputTableName.value === null) {
                self.progress(100, OP_STATES.ko);
                const errorMessage = "Output Table is not filled";
                console.error(errorMessage);
                notify().error(errorMessage);
            }
            else {
                ikats.api.table.merge({
                    table1: table1,
                    table2: table2,
                    joinOn: joinOn.value,
                    outputTableName: outputTableName.value,
                    async: true,
                    success: function (r) {
                        if (is2xx(r.debug.status)) {
                            out_table.value = r.data;
                            self.progress(100, OP_STATES.ok);
                        }
                        else {
                            self.progress(100, OP_STATES.ko);
                            console.error(r.status_msg);
                            notify().error(r.status_msg);
                        }
                    },
                    error: function (r) {
                        self.progress(100, OP_STATES.ko);
                        console.error(r.debug.responseText);
                        notify().error(r.debug.responseText);
                    }
                });
            }
        }
    },
    {
        name: "IngestTS",
        label: "Import TS",
        description: "Import new Timeseries",
        family: "Dataset Preparation/Import Export",
        op_id: 17,
        inputs: [],
        parameters: [
            {
                name: "dataset",
                label: "Dataset name",
                description: "The name of the created dataset",
                type: "text"
            },
            {
                name: "description",
                label: "Description",
                description: "A description of this dataset",
                type: "text"
            },
            {
                name: "rootPath",
                label: "Root Path",
                description: "The root path of the data files on server side",
                type: "text"
            },
            {
                name: "pathPattern",
                label: "Path mapping rule",
                description: "Regex pattern for defining metric over metadata (ex: /data/(?<metric>.*)\\.txt)",
                type: "text"
            },
            {
                name: "funcIdPattern",
                label: "FID name rule",
                description: "Pattern used to define name of each TS (ex: test_PORTFOLIO_${metric})",
                type: "text"
            }
        ],
        outputs: [
            {
                name: "ts_list",
                label: "TS list",
                type: "ts_list"
            },
            {
                name: "dataset",
                label: "Name",
                type: "ds_name"
            },
            {
                name: "summary",
                label: "Log",
                type: "text"
            }
        ],
        init: function () {

            const self = this;
            self.progress(100, OP_STATES.idle);

        },
        poll: function () {
            // This function handle the polling of the status while import is in progress

            const self = this;

            let out_ts_list = self.getOutput("ts_list");
            let out_dataset = self.getOutput("dataset");
            let out_summary = self.getOutput("summary");

            let formatSummary = function (data) {

                let summary = "";
                for (let k in data) {
                    if (data.hasOwnProperty(k)) {
                        summary += k + " = " + JSON.stringify(data[k]) + "\n";
                    }
                }
                return summary;
            };
            if (!isNumber(self.pid)) {
                notify().error("No ingestion session attached. Stopping polling");
                self.progress(100, OP_STATES.ko);
                self.pollStop();
            }
            else {

                ikats.api.ingest.status({
                    async: true,
                    id: self.pid,
                    success: function (r, txt_status, xhr) {
                        let progression = parseInt(r.data.rateOfImportedItems, 10);
                        switch (r.data.sessionStatus) {
                            case "CREATED":
                            case "ANALYSED":
                            case "DATASET_REGISTERED":
                            case "CLEANSING_PASSES":
                            case "RUNNING":
                            case "IMPORTED":
                                self.progress(progression, OP_STATES.run);
                                break;
                            case "COMPLETED":
                                // It is possible to have "COMPLETED" without 100% progress
                                // So need to refresh the progress field.
                                self.progress(progression, OP_STATES.ok);
                                console.debug(r.data);
                                out_dataset.value = self.getParameter("dataset").value;
                                out_ts_list.value = ikats.api.ds.read(out_dataset.value).data.ts_list;
                                out_summary.value = formatSummary(r.data);
                                self.pollStop();
                                break;
                            case "CANCELLED":
                                // Set progressbar to at least 10% to have a visible part for KO status
                                self.progress(Math.max(progression, 10), OP_STATES.ko);
                                console.error(r.data);
                                notify().error("Ingestion cancelled. See logs for details");
                                out_summary.value = formatSummary(r.data);
                                self.pollStop();
                                break;
                            case "ERROR":
                                // Set progressbar to at least 10% to have a visible part for KO status
                                self.progress(Math.max(progression, 10), OP_STATES.ko);
                                notify().error("Error occurred during ingestion");
                                console.error(r.data);
                                self.pollStop();
                                break;
                            default:
                                // Unhandled errors should not happen.
                                self.progress(100, OP_STATES.ko);
                                notify().error("Unhandled error occurred during ingestion");
                                console.error(r.data);
                                self.pollStop();
                        }
                    },
                    error: function (r) {
                        self.progress(100, OP_STATES.ko);
                        console.error(r.status_msg);
                        notify().error(r.status_msg);
                        self.pollStop();
                    }
                });
            }
        },
        run: function () {
            const self = this;
            this.progress(0, OP_STATES.run);

            const in_dataset = self.getParameter("dataset").value;
            const in_description = self.getParameter("description").value;
            const in_rootPath = self.getParameter("rootPath").value;
            const in_pathPattern = self.getParameter("pathPattern").value;
            const in_funcIdPattern = self.getParameter("funcIdPattern").value;

            // Factorized Success Callback (used by both start & restart api calls)
            let successCallback = function (r) {
                if (is2xx(r.debug.status)) {
                    self.progress(0, OP_STATES.run);
                    if (!isNumber(self.pid)) {
                        self.pid = parseInt(r.data, 10);
                    }

                    // Ingest session created/restarted successfully
                    // Now waiting for the end of ingestion
                    // Poll every 5s
                    self.checkResults(5000);

                }
                else {
                    self.progress(100, OP_STATES.ko);
                    console.error(r.status_msg);
                    notify().error(r.status_msg);
                }
            };

            if ([in_dataset, in_description, in_rootPath, in_pathPattern, in_funcIdPattern].some(x => x === null)) {
                self.progress(100, OP_STATES.ko);
                console.error("All parameters are mandatory");
                notify().error("All parameters are mandatory");
            }
            else {
                // importer and serializer are hard written because user doesn't need to set it for now
                // (only one value per field available)
                ikats.api.ingest.start({
                    dataset: in_dataset,
                    description: in_description,
                    rootPath: in_rootPath,
                    pathPattern: in_pathPattern,
                    funcIdPattern: in_funcIdPattern,
                    importer: "fr.cs.ikats.ingestion.process.opentsdb.OpenTsdbImportTaskFactory",
                    serializer: "fr.cs.ikats.datamanager.client.opentsdb.importer.CommonDataJsonIzer",
                    async: true,
                    success: successCallback,
                    error: function (r) {
                        self.progress(100, OP_STATES.ko);
                        let msg = "unhandled error with ingest module";
                        switch (r.xhr.status) {
                            case 409:
                                // Session already in progress
                                self.pid = parseInt(r.xhr.responseText, 10);
                                ikats.api.ingest.restart({
                                    id: self.pid,
                                    async: true,
                                    success: successCallback,
                                    error: function (r) {
                                        self.progress(100, OP_STATES.ko);
                                        let msg = "unhandled error with ingest module";
                                        switch (r.xhr.status) {
                                            case 409:
                                                // Session already in progress
                                                msg = "The same session has been already run";
                                                break;
                                            case 503:
                                                // Another import session is already in progress
                                                msg = r.xhr.responseText;
                                                break;
                                            case 0:
                                                msg = "Ingest restart module seems to be offline or not operational";
                                                break;
                                            default:
                                                msg = "unhandled error with ingest module (" + r.debug.status + ") : " + r.responseText;
                                                break;
                                        }
                                        console.error(msg);
                                        notify().error(msg);
                                    }
                                });
                                break;
                            case 503:
                                // Another import session is already in progress
                                msg = r.xhr.responseText;
                                console.error(msg);
                                notify().error(msg);
                                break;
                            case 0:
                                msg = "Ingest module seems to be offline or not operational";
                                console.error(msg);
                                notify().error(msg);
                                break;
                            default:
                                msg = "unhandled error with ingest module (" + r.debug.status + ") : " + r.responseText;
                                console.error(msg);
                                notify().error(msg);
                                break;
                        }
                    }
                });
            }
        }
    },
    {
        name: "import_md",
        label: "Import Metadata",
        description: "CSV file import to fill metadata",
        family: "Dataset Preparation/Import Export",
        op_id: 18,
        parameters: [
            {
                name: "file",
                label: "Select a CSV file",
                description: "Select the CSV file containing metadata",
                type: "file",
                default_value: null,
            },
            {
                name: "update",
                label: "Overwrite",
                description: "Overwrite existing metadata",
                type: "bool",
                default_value: false,
            }
        ],
        outputs: [
            {
                name: "summary",
                label: "Log",
                type: "text"
            }
        ],
        init: function () {

            const self = this;
            self.progress(100, OP_STATES.idle);

        },
        run: function () {
            const self = this;
            this.progress(100, OP_STATES.run);

            const file = self.getParameter("file");
            const update = self.getParameter("update");
            const log = self.getOutput("summary");

            if (file.filename === null || file.value === null) {
                self.progress(100, OP_STATES.ko);
                const error = "File must be provided";
                console.error(error);
                notify().error(error);
            }
            else {
                ikats.api.md.importFromFile({
                    fileContent: atob(file.value.split(",")[1]),
                    updateFlag: update.value,
                    details: true,
                    async: true,
                    success: function (r) {
                        if (is2xx(r.debug.status)) {
                            self.progress(100, OP_STATES.ok);
                            console.info(r.data);
                            log.value = r.data;
                            notify().info(r.data);
                        }
                        else {
                            self.progress(100, OP_STATES.ko);
                            log.value = r.debug.responseText;
                            console.error(r.debug.responseText);
                            notify().error(r.debug.responseText);
                        }
                    },
                    error: function (r) {
                        self.progress(100, OP_STATES.ko);
                        log.value = r.debug.responseText;
                        console.error(r.debug.responseText);
                        notify().error(r.debug.responseText);
                    }
                });
            }
        }
    },
    {
        name: "output_builder",
        label: "Output Builder",
        description: "Build a custom output data",
        family: window.DEVELOPER_FAMILY,
        outputs: [
            {
                name: "out",
                label: "out",
                type: 'ts_list'
            }
        ],
        parameters: [
            {
                name: "output_type",
                label: "Type",
                description: "Provide the functional type of the output",
                type: "text",
                default_value: null
            },
            {
                name: "content",
                label: "Content",
                description: "Give the content to provide in output",
                type: "textarea",
                default_value: null
            },
            {
                name: "jsonFlag",
                label: "JSON",
                description: "Set true to cast the content to json",
                type: "bool",
                default_value: true
            }
        ],
        init: function () {
            const self = this;
            self.progress(100, OP_STATES.idle);
        },
        run: function () {
            const self = this;
            this.progress(100, OP_STATES.run);

            // Update the type
            self.getOutput("out").type = self.getParameter("output_type").value;

            if (self.getParameter("jsonFlag").value) {
                try {
                    // Try to cast to JSON because it is requested
                    self.getOutput("out").value = JSON.parse(self.getParameter("content").value);
                    this.progress(100, OP_STATES.ok);
                }
                catch (e) {
                    // But maybe it won't work, fallback to direct output
                    console.error("Cast to JSON couldn't be performed.");
                    notify().error("Cast to JSON couldn't be performed.");
                    this.progress(100, OP_STATES.ko);
                }
            }
            else {
                // Don't cast to JSON
                self.getOutput("out").value = self.getParameter("content").value;
                this.progress(100, OP_STATES.ok);
            }
        }
    }
];
