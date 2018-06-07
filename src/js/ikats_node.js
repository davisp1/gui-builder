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
 * @file This file describes the behaviour of a NODE
 */


/**
 * Node definition (static data)
 *
 * @constructor
 *
 * @param {number} id Id of the instantiated node to create (unique)
 * @param {OP_INFO=} op_info Operator information to bind to this node (if provided)
 *
 * @property {?OP_INFO} op_info Operator information bound to this node
 * @property {?string} name Node name to be displayed
 * @property {number} id Unique Id of the Node
 * @property {number} x X position on screen
 * @property {number} y Y position on screen
 * @property {?OP_INPUT[]} inputConnectors list of input connectors
 * @property {?OP_OUTPUT[]} outputConnectors list of output connectors
 * @property {?Object} wf Workflow object (to interact with other nodes)
 */
function NODE(id, op_info) {

    this.op_info = null;
    this.name = null;

    this.id = id;

    this.x = 0;
    this.y = 0;

    this.inputConnectors = null;
    this.outputConnectors = null;

    this.wf = null;

    if (op_info) {
        this.bindOperator(op_info);
    }
}

/**
 * Returns the nodes connected to any output of the from_node
 * @returns {NODE[]}
 */
NODE.prototype.getParentNodes = function () {

    const self = this;
    if (!self.wf) {
        console.error("Can't get parent nodes. the NODE is not connected");
    }

    const parentNodes = [];
    $scope.wf.chartViewModel.data.connections.forEach(function (conn) {
        if (conn.source.nodeID === self.id) {
            if (self.inputConnectors.length > conn.source.connectorIndex) {
                //TODO return the node content, not the node ID
                parentNodes.push(conn.dest.nodeID);
            }
        }
    });
    return parentNodes;
};
/**
 * Bind an operator to the node
 *
 * @param {OP_INFO} op
 */
NODE.prototype.bindOperator = function (op) {
    this.op_info = op.clone();

    // Get real definition
    this.op_info.read();

    // Update the name
    this.name = this.op_info.label;

    // Link inputs and outputs
    this.inputConnectors = this.op_info.inputs;
    this.outputConnectors = this.op_info.outputs;

    // Define the NODE as parent of the operator
    this.op_info.parent = this;

    // Initialize operator instance
    this.op_info.init();
};

NODE.prototype.toJson = function () {
    const self = this;

    const json = {};
    json.id = self.id;
    json.x = self.x;
    json.y = self.y;
    json.op_info = self.op_info.toJson();

    return json;
};
NODE.prototype.fromJson = function (json, wf) {
    const self = this;

    self.op_info = new OP_INFO(this, json.op_info.op_id, json.op_info.isAlgo);
    self.op_info.name = json.op_info.name;
    self.op_info.read();
    self.op_info.fromJson(json.op_info);

    self.id = json.id;
    self.x = json.x;
    self.y = json.y;

    self.name = self.op_info.label;
    self.inputConnectors = self.op_info.inputs;
    self.outputConnectors = self.op_info.outputs;

    self.wf = wf;
};
