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
 * @file This file describes the behaviour of an operator
 */


/**
 * Enumerate listing the different state values
 * @constant
 * @enum {string}
 *
 */
const OP_STATES = {
    /** Operator is waiting for user action */
    idle: "#cccccc",
    /** Operator is running on cluster */
    run: "#FF8A10",
    /** Operator is completed with success status */
    ok: "#5cb85c",
    /** Operator is completed with fail status */
    ko: "#ff0000"
};

window.opQueries = [];

/**
 * Define an operator input
 *
 * @constructor
 * @type {OP_INPUT}
 *
 * @param {OP_INFO} op represents the object of the operator linked to this input
 * @param {string} name represents the functional name of the input (unique)
 * @param {string} label represents the displayed name of the input
 * @param {string} desc represents the description of the input
 * @param {?string} type represents the data type of the input
 *
 * @property {OP_INFO} parent parent object
 * @property {string} name functional name of the input
 * @property {string} label displayed name of the input
 * @property {string} desc description of the input
 * @property {?string} type data type of the input
 *
 */
function OP_INPUT(op, name, label, desc, type) {
    this.parent = op;
    this.name = name || "No name";
    this.label = label || "No label";
    this.desc = desc || "No description";
    this.type = type || null;
}

/**
 * Provide connected (node/connector)
 * @return {{info: OP_INFO, index: int}} the connected node and connector index
 */
OP_INPUT.prototype.isConnectedTo = function () {
    const nodeId = this.parent.parent.id;
    return $.grep(connections(), function (x) {
        return x.dest.nodeID === nodeId;
    }).map(function (x) {
        return {info: nodeById(x.source.nodeID), index: x.source.connectorIndex};
    });
};

/**
 * Get the value of the input no matter the kind of operator it is.
 * Returns undefined if no results are available
 * @type {OP_INPUT}
 * @return {*}
 */
OP_INPUT.prototype.getValue = function () {
    const self = this;
    try {
        return self.parent.parent.wf.getSourceData(self.parent.parent.id, self.name);
    }
    catch (e) {
        return undefined;
    }
};

/**
 * Define an operator parameter
 *
 * @constructor
 *
 * @type {OP_PARAMETER}
 *
 * @param {OP_INFO} op represents the object of the operator linked to this parameter
 * @param {string} name represents the functional name of the parameter (unique)
 * @param {string} label represents the displayed name of the parameter
 * @param {string} desc represents the description of the parameter
 * @param {?string} type represents the data type of the parameter

 * @param {*} default_value contain the default value to be used for this parameter
 * @param {?Array} dov represents the domain of values of the parameter
 * @param {?function} evt is the action to trigger when bound to a DOM event
 *
 * @property {string} name functional name of the parameter
 * @property {string} label displayed name of the parameter
 * @property {string} desc description of the parameter
 * @property {string} type data type of the parameter
 * @property {String|Array} dov domain of values of the parameter
 * @property {*} value contain the value to be used for this parameter
 * @property {*} default_value contain the default value to be used for this parameter
 * @property {OP_INFO} parent parent object
 * @property {function} evt action to trigger when bound to a DOM event
 *
 * @return {OP_PARAMETER}
 */
function OP_PARAMETER(op, name, label, desc, type, default_value, dov, evt) {
    this.name = name || "No name";
    this.label = label || "No label";
    this.desc = desc || "No description";
    this.type = type || null;
    this.dov = dov || null; // Domain of Values
    this.value = cloneObj(default_value);
    this.default_value = cloneObj(default_value);

    if ((this.type === "list" || this.type === "list_multiple") && (isObject(dov) || typeof(dov) === "string")) {
        this.dov = JSON.parse(this.dov);
    }
    this.parent = op;

    if (isFunction(evt)) {
        // Override event
        this.onEvent = evt;
    }
    return this;
}

/**
 * Action to perform when an event occurs on the parameter
 * This event has to be bound to any HTML event
 */
OP_PARAMETER.prototype.onEvent = function () {
    return null;
};

OP_PARAMETER.prototype.toJson = function () {
    const self = this;

    const json = {};

    json.name = self.name;
    json.label = self.label;
    json.desc = self.desc;
    json.type = self.type;
    json.dov = self.dov;
    json.value = cloneObj(self.value);
    json.default_value = cloneObj(self.default_value);

    return json;
};

/**
 * Define an operator output
 *
 * Intrinsic fields {@link value} and {@link rid} will be set in operator depending on their type (core/algo)
 *
 * @constructor
 *
 * @type {OP_OUTPUT}
 * @param {OP_INFO} op represents the object of the operator linked to this output
 * @param {string} name represents the functional name of the output (unique)
 * @param {string} label represents the displayed name of the output
 * @param {string} desc represents the description of the output
 * @param {?string} type represents the data type of the output
 *
 *
 * @property {OP_INFO} parent parent object
 * @property {string} name functional name of the output
 * @property {string} label displayed name of the output
 * @property {string} desc description of the output
 * @property {?string} type data type of the output
 *
 * @property {?number} rid result Id (for algo only)
 * @property {?*} value result content (not used for algo)
 *
 * @returns {OP_OUTPUT}
 *
 */
function OP_OUTPUT(op, name, label, desc, type) {
    this.name = name || "No name";
    this.label = label || "No label";
    this.desc = desc || "No description";
    this.type = type || null;
    this.parent = op;

    // Possibles outputs access
    // Through resource id (process data identifier)
    this.rid = null;
    // Through direct value
    this.value = null;

    return this;
}

/**
 * Provide connected (node/connector)
 * @return {{info: OP_INFO, index: int}} the connected node and connector index
 */
OP_OUTPUT.prototype.isConnectedTo = function () {
    const nodeId = this.parent.parent.id;
    return $.grep(connections(), function (x) {
        return x.source.nodeID === nodeId;
    }).map(function (x) {
        return {info: nodeById(x.dest.nodeID), index: x.dest.connectorIndex};
    });
};

/**
 * Debug information for this output
 */
OP_OUTPUT.prototype.debug = function () {
    const self = this;
    const json = {};
    json.name = self.name;
    json.label = self.label;
    json.desc = self.desc;
    json.type = self.type;
    json.rid = self.rid;
    json.value = self.value;
    return json;
};

/**
 * Get the value of the output no matter the kind of operator it is.
 * Returns undefined if no results are available
 *
 * @type {OP_OUTPUT}
 * @return {*}
 */
OP_OUTPUT.prototype.getValue = function () {
    const self = this;

    if (self.parent._state !== OP_STATES.ok) {
        // No results available
        console.error("Results are not available for now");
        return undefined;
    }

    if (self.rid !== null) {
        // RID is defined
        return ikats.api.op.result(self.rid).data;
    }
    else {
        // Read from value
        return self.value;
    }
};


/**
 * Describe the functional information of an operator bound to a Node
 *
 * @constructor
 *
 * @type {OP_INFO}
 *
 * @param {?NODE} node node containing the operator
 * @param {number} id operator unique Id
 * @param {boolean} isAlgo indicate the origin of the operator (true:Algo, false:core Operator)
 *
 * @property {number} op_id operator unique Id
 * @property {string} label displayed name of the operator
 * @property {string} name functional name of the operator
 * @property {string} desc description of the operator
 * @property {string} algo subtitle to use for this operator
 * @property {string} family category of the operator
 * @property {OP_INPUT[]} inputs list of inputs
 * @property {OP_PARAMETER[]} parameters list of parameters
 * @property {OP_OUTPUT[]} outputs list of outputs
 * @property {boolean} isAlgo indicate the origin of the operator (true:Algo, false:core Operator)
 * @property {?NODE} parent parent NODE
 * @property {number} _progress progress value. Range is [0,100]
 * @property {OP_STATES} _state Run status of the operator
 *
 * @returns {OP_INFO}
 */
function OP_INFO(node, id, isAlgo) {
    this.op_id = id; //Operator ID
    this.label = "No label"; //Name to display
    this.name = "No name"; //Functional name
    this.desc = "No description";
    this.algo = "No algo";
    this.family = "No Family";
    this.inputs = [];
    this.parameters = [];
    this.outputs = [];

    // Start date provided by server
    this.lastStart = null;
    // Local start date (to compute a temporary duration while running)
    this.lastStartLocal = null;
    // Duration (local value while running using lastStartLocal, remote value after)
    this.duration = null;

    this.isAlgo = isAlgo;
    this.parent = node;

    this._progress = 0;
    this._state = OP_STATES.idle;

    // Id of the setInterval function used for polling
    this.pollIntervalId = null;

    return this;
}

/**
 * Indicate if the operator is idle or not
 * @return {boolean}
 */
OP_INFO.prototype.isIdle = function () {
    return this._state === OP_STATES.idle;
};
/**
 * Indicate if the operator is running or not
 * @return {boolean}
 */
OP_INFO.prototype.isRunning = function () {
    return this._state === OP_STATES.run;
};
/**
 * Indicate if the operator is success or not
 * @return {boolean}
 */
OP_INFO.prototype.isSuccess = function () {
    return this._state === OP_STATES.ok;
};
/**
 * Indicate if the operator is success or not
 * @return {boolean}
 */
OP_INFO.prototype.isFailure = function () {
    return this._state === OP_STATES.ko;
};
/**
 * Indicate if the operator has ended (no matter the status)
 * @return {boolean}
 */
OP_INFO.prototype.isCompleted = function () {
    return this._state === OP_STATES.ko || this._state === OP_STATES.ok;
};
/**
 * Callback to be called after an async update on an element the OP_INFO
 * To be defined by the object that instantiate the OP_INFO
 * @method
 */
OP_INFO.prototype.refresh_callback = function () {
};
/**
 * Set the progress bar and the state to the defined values
 *
 * @param {number} progress_value New progress value
 * @param {OP_STATES} new_state New state
 */
OP_INFO.prototype.progress = function (progress_value, new_state) {

    if (typeof(progress_value) === "number") {
        // Force value to be within [0,100]
        this._progress = Math.min(Math.max(progress_value, 0), 100);
    }
    if (new_state !== undefined) {
        this._state = new_state;
    }

    // Clear outputs once running
    if (new_state === OP_STATES.run) {
        this.outputs.forEach(function (output) {
            output.rid = null;
            output.value = null;
        });
    }


    // Trigger the next onConnUpdate()
    if (new_state === OP_STATES.ok) {
        this.outputs.forEach(function (output) {
            output.isConnectedTo().forEach(function (item) {
                item.info.forEach(function (n) {
                    if (n.data.op_info.onConnUpdate) {
                        n.data.op_info.onConnUpdate();
                    }
                });
            });
        });
    }

    // Force the refresh of the model through the dedicated callback
    this.refresh_callback();
};

/**
 * Allows to add new input to the Operator
 *
 * @param {string} name Name of the input to add
 * @param {string} label Label of the input to add
 * @param {string} desc Description of the input to add
 * @param {string} type Type of the input to add
 */
OP_INFO.prototype.addInput = function (name, label, desc, type) {
    this.inputs.push(new OP_INPUT(this, name, label, desc, type));
};
/**
 * Allows to add new output to the Operator
 *
 * @param {string} name Name of the output to add
 * @param {string} label Label of the output to add
 * @param {string} desc Description of the output to add
 * @param {string} type Type of the output to add
 */
OP_INFO.prototype.addOutput = function (name, label, desc, type) {
    this.outputs.push(new OP_OUTPUT(this, name, label, desc, type));
};
/**
 * Allows to add new parameter to the Operator
 *
 * @param {string} name Name of the parameter to add
 * @param {string} label Label of the parameter to add
 * @param {string} desc Description of the parameter to add
 * @param {string} type Type of the parameter to add
 * @param {?*} value Default value of the parameter to add
 * @param {?*} dov Domain of values of the parameter to add
 * @param {?function=} evt Event to bind to the parameter to add
 */
OP_INFO.prototype.addParameter = function (name, label, desc, type, value, dov, evt) {
    this.parameters.push(new OP_PARAMETER(this, name, label, desc, type, value, dov, evt));
};

/**
 * Get the input/parameter/output (defined by <type>) having its field <name> equal to <value>
 *
 * @param {string} type Type of the item to get (Inputs, Outputs, Parameters)
 * @param {string} name Name of the item to get
 * @param {*} value Value of the item to get
 *
 * @return {*}
 */
OP_INFO.prototype._getItem = function (type, name, value) {
    const results = this[type].filter(function (x) {
        return x[name] === value;
    });
    if (results.length > 1) {
        // This case should not happen
        console.error("Several " + type + " having name ", name, " for ", this.name);
    }
    if (results.length === 0) {
        return null;
    }
    return results[0];

};
/**
 * Get input <name>
 *
 * @param {string} name Name of the input to get
 * @return {*}
 */
OP_INFO.prototype.getInput = function (name) {
    return this._getItem("inputs", "name", name);
};
/**
 * Get parameter <name>
 *
 * @param {string} name Name of the parameter to get
 * @return {*}
 */
OP_INFO.prototype.getParameter = function (name) {
    return this._getItem("parameters", "name", name);
};
/**
 * Get output <name>
 *
 * @param {string} name Name of the output to get
 * @return {*}
 */
OP_INFO.prototype.getOutput = function (name) {
    return this._getItem("outputs", "name", name);
};

/**
 * Get the full information about the operator.
 * The location of the full information depends on the type of operator (Algo , core operator)
 */
OP_INFO.prototype.read = function () {

    if (this.isAlgo) {
        this.readFromCatalog();
    }
    else {
        this.readCore();
    }
};

/**
 * Read full information about an implementation in catalog
 * Update the internal information
 */
OP_INFO.prototype.readFromCatalog = function () {
    const self = this;

    if (self.isAlgo === false) {
        console.error("Trying to get information from Core while Algo is selected", self);
        return;
    }

    // Get full object
    const results = ikats.api.op.read(self.name);
    if (results.status) {
        self.op_id = results.data.id || null;
        self.name = results.data.name || "";
        self.desc = results.data.description || "";
        self.label = results.data.label || "";
        self.family = results.data.family || "";
        self.algo = results.data.algo || "";

        console.debug("results : ", results);
        if (results.data.length || results.data.id !== null) {
            results.data.inputs.forEach(function (input) {
                self.addInput(input.name, input.label, input.description, input.type);
            });
            results.data.parameters.forEach(function (param) {
                self.addParameter(param.name, param.label, param.description, param.type, param.default_value, param.domain);
            });
            results.data.outputs.forEach(function (output) {
                self.addOutput(output.name, output.label, output.description, output.type);
            });
        } else {
            self.invalid = true;
            console.warn("Invalidated operator detected, it will not be loaded");
        }

        self.pid = null;
    }
    else {
        console.error("Error while gathering information for " + self.op_id);
    }
};
/**
 * Read full information about a core operator
 * Update the internal information
 */
OP_INFO.prototype.readCore = function () {
    const self = this;

    if (self.isAlgo === true) {
        console.error("Trying to get information from Algo while Core is selected", self);
        return;
    }

    // Get full object
    const raw_list = CORE_OPERATORS_LIB.filter(function (x) {
        return x.op_id === self.op_id;
    });
    if (raw_list.length === 0) {
        throw Error("Operator looks to have been removed or modified in catalog, operator will not be loaded");
    }
    const op_info_full = raw_list[0];

    // Standard information
    if (op_info_full.name) {
        self.name = op_info_full.name;
    }
    if (op_info_full.label) {
        self.label = op_info_full.label;
    }
    if (op_info_full.desc) {
        self.desc = op_info_full.desc;
    }

    // Functions bindings
    self.run = op_info_full.run;
    self.poll = op_info_full.poll;
    self.init = op_info_full.init;
    self.onConnUpdate = op_info_full.onConnUpdate;

    // Filling inputs
    if (op_info_full.inputs) {
        op_info_full.inputs.forEach(function (input) {
            self.addInput(input.name, input.label, input.desc, input.type);
        });
    }

    // Filling outputs
    if (op_info_full.outputs) {
        op_info_full.outputs.forEach(function (output) {
            self.addOutput(output.name, output.label, output.desc, output.type);
        });
    }

    // Filling parameters
    if (op_info_full.parameters) {
        op_info_full.parameters.forEach(function (param) {
            self.addParameter(param.name, param.label, param.desc, param.type, param.default_value, param.dov, param.evt);
        });
    }

};
/**
 * Execute the algorithm (default behaviour of an operator.
 * Override the function to implement Core operators
 */
OP_INFO.prototype.run = function () {
    const self = this;

    if (!self.isAlgo) {
        console.error("No Javascript code implemented for Core Operator");
        self.progress(100, OP_STATES.ko);
        return;
    }

    self.progress(100, OP_STATES.run);

    // Building arguments list
    const arguments_to_send = {};
    const arguments_list = [];
    self.parameters.forEach(function (parameter_item) {
        arguments_list.push({
            name: parameter_item.name,
            type: parameter_item.type,
            value: parameter_item.value,
            getValue: function () {
                return parameter_item.value;
            }
        });
    });
    self.inputs.forEach(function (input_item) {
        arguments_list.push({
            name: input_item.name,
            type: input_item.type,
            value: null,
            getValue: function () {
                return input_item.getValue();
            }
        });
    });

    arguments_list.forEach(function (parameter_item) {
        const value = parameter_item.getValue();
        switch (parameter_item.type) {
            case "date":
                try {
                    if (value !== undefined && value !== null && value !== "") {
                        // Converts to milliseconds
                        const filt_int = filterInt(value);
                        if (filt_int) {
                            arguments_to_send[parameter_item.name] = filt_int;
                        }
                        else {
                            let decomposedValues = value.split(" ");
                            if (decomposedValues.length === 2) {
                                const date = decomposedValues[0];
                                const hour = decomposedValues[1];
                                const ISODate = date + "T" + hour + "Z";
                                arguments_to_send[parameter_item.name] = new Date(ISODate).getTime();
                            } else {
                                console.error("Value is in a bad format (" + value + ")");
                            }
                        }
                    } else {
                        arguments_to_send[parameter_item.name] = null;
                    }
                }
                catch (e) {
                    console.error("Error while parsing date " + value);
                    ikats.common.callback(p.error, result);
                    return result;
                }
                break;
            case "md_filter":
                if (typeof(arguments_to_send[parameter_item.name]) === "undefined") {
                    // First encounter,init array
                    arguments_to_send[parameter_item.name] = [];
                }
                // Fill array with new criteria
                for (let i = 0; i < value.length; i++) {
                    arguments_to_send[parameter_item.name].push({
                        metadataName: value[i].meta,
                        comparator: value[i].comparator,
                        value: value[i].value
                    });
                }
                break;
            default:
                arguments_to_send[parameter_item.name] = value;
        }
    });


    ikats.api.op.run({
            async: true,
            op_id: self.op_id,
            args: arguments_to_send,
            async_run: true,
            success: function (result) {
                self.pid = result.data.pid;
                self.progress(100, OP_STATES.run);

                self.lastStartLocal = parseInt(new Date().getTime() / 1000, 10);

                //Trigger the auto check
                self.checkResults(1000);
            },
            error: function (result) {
                self.progress(100, OP_STATES.ko);
                console.error("An error occurred during execution of " + self.name, result);
            }
        }
    );
};
/**
 * Stops the polling function for core operators
 * Called inside the specific functions of core operators to stop interval
 */
OP_INFO.prototype.pollStop = function () {
    const self = this;
    clearInterval(self.pollIntervalId);
};

/**
 * Polling function specific for core operators
 */
OP_INFO.prototype.poll = function () {
    console.error("poll() function not set by core operator");
    this.pollStop();
    this.progress(100, OP_STATES.ko);
    return true;
};

/**
 * Trigger a loop that will check the results of the algorithm
 *
 * @param {number=} check_interval Number of milliseconds between checks (default : 1000)
 */
OP_INFO.prototype.checkResults = function (check_interval) {
    const self = this;

    check_interval = check_interval || 1000;

    if (!self.isAlgo) {
        self.pollIntervalId = setInterval(function () {
            self.poll();
        }, check_interval);

        return;
    }

    const timer = setInterval(function () {
        const r = ikats.api.op.status(self.pid);
        if (r.status) {

            // Handle timings information
            self.lastStart = r.data.start_date;

            if (r.data.duration) {
                self.duration = r.data.duration;
            }
            else {
                // Duration not found, applying current delta
                self.duration = parseInt(new Date().getTime() / 1000, 10) - self.lastStartLocal;
            }

            switch (r.data.status) {
                case "INIT":
                    self.progress(10, OP_STATES.run);
                    break;
                case "RUN":
                    self.progress(100, OP_STATES.run);
                    break;
                case "ALGO_OK":
                    // Filling results
                    const results = ikats.api.op.results(self.pid).data;
                    for (let i = 0; i < results.length; i++) {
                        if (self.outputs[i]) {
                            self.outputs[i].rid = results[i].rid;
                        }
                        self.outputs[i].value = null;
                    }

                    clearInterval(timer);
                    self.progress(100, OP_STATES.ok);
                    break;
                // case "ALGO_KO":
                // case "ENGINE_KO":
                default:
                    clearInterval(timer);
                    self.progress(100, OP_STATES.ko);
                    break;
            }
        }
        else {
            console.error("Impossible to get status for " + self.name);
            clearInterval(timer);
        }
    }, check_interval);
    window.opQueries.push(timer);
};
/**
 * Actions to perform if a connected node has been updated
 * @returns {null}
 */
OP_INFO.prototype.onConnUpdate = function () {
    return null;
};
/**
 * Initialization part of the operator.
 * Called during the instantiation.
 *
 * @returns {null}
 */
OP_INFO.prototype.init = function () {
    return null;
};
/**
 * Return a clone of the OP_INFO (cut down all the references to make a real instance)
 *
 * @type {OP_INFO}
 *
 * @returns {OP_INFO} Clone of the current operator
 */
OP_INFO.prototype.clone = function () {
    const original = this;

    const clone = new OP_INFO(original.parent, original.op_id, original.isAlgo);

    clone.label = original.label;
    clone.name = original.name;
    clone.desc = original.desc;
    clone.algo = original.algo;
    clone.family = original.family;

    original.inputs.forEach(function (input) {
        clone.inputs.push(cloneObj(input));
    });
    original.parameters.forEach(function (param) {
        clone.parameters.push(cloneObj(param));
    });
    original.outputs.forEach(function (output) {
        clone.outputs.push(cloneObj(output));
    });

    return clone;

};
/**
 * Export all information of this operator to JSON format
 *
 * @return {{}} the built JSON
 */
OP_INFO.prototype.toJson = function () {
    const self = this;

    const json = {};

    json.op_id = self.op_id;
    json.name = self.name;
    json.isAlgo = self.isAlgo;
    json._progress = self._progress;
    json._state = self._state;

    json.lastStartLocal = self.lastStartLocal;
    json.lastStart = self.lastStart;
    json.duration = self.duration;
    json.pid = self.pid;

    json.parameters = {};
    self.parameters.forEach(function (param) {
        json.parameters[param.name] = {
            dov: param.dov,
            value: param.value
        };
    });

    json.outputs = {};
    self.outputs.forEach(function (output) {
        json.outputs[output.name] = {
            rid: output.rid,
            value: output.value
        };
    });

    return json;
};
/**
 * Attach the defined PID to the current operator.
 *
 * @param {string} pid pid to attach
 */
OP_INFO.prototype.attachPID = function (pid) {
    const self = this;
    console.debug("Attaching PID " + pid + " to Node " + self.name);
    self.pid = pid;
    self.checkResults(1000);
};
/**
 * Fill in the operator from the information provided in JSON
 *
 * @param {string} json container of all the information
 */
OP_INFO.prototype.fromJson = function (json) {
    const self = this;

    self.op_id = json.op_id;
    self.isAlgo = json.isAlgo;

    self._progress = json._progress;
    self._state = json._state;

    self.lastStartLocal = json.lastStartLocal;
    self.lastStart = json.lastStart;
    self.duration = json.duration;


    self.outputs.forEach(function (output) {
        if (json.outputs[output.name].value) {
            output.value = json.outputs[output.name].value;
        }
        if (json.outputs[output.name].rid) {
            output.rid = json.outputs[output.name].rid;
        }
    });

    self.parameters.forEach(function (parameter) {
        if (json.parameters[parameter.name].dov) {
            parameter.dov = cloneObj(json.parameters[parameter.name].dov);
        }

        if (json.parameters[parameter.name].value !== null && json.parameters[parameter.name].value !== undefined) {
            if (parameter.type === "ds_list") {
                parameter.value = $.grep(parameter.dov, x => x.name === json.parameters[parameter.name].value.name)[0];
            }
            else {
                parameter.value = cloneObj(json.parameters[parameter.name].value);
            }
        }

    });

    if (json.pid) {
        self.attachPID(json.pid);
    }

};
