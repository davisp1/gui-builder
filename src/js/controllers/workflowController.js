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
// N.B : Node is the term used by the library Angular-Flowchart for referencing the boxes, in Ikats,
// these boxes are called operators, so both terms are visible in code

/**
 * @file Defines Worfkflow controller
 */

/**
 * Main Controller :
 * Controller handling workflow purposes : CRUD operations over workflows, and interaction with other modules.
 * @class IKATS_GUI.Controllers.WorkflowController
 * @memberOf IKATS_GUI.Controllers
 */
angular.module("ikatsapp.controllers").controller("WorkflowController", [
  "$scope", "$interval", "toastr",
  function($scope, $interval, toastr) {

    const self = this;

    /**
     * toastr of the application
     *
     * @alias toastr
     * @memberOf IKATS_GUI.Controllers.WorkflowController
     * @type {*}
     */
    self.toastr = toastr;

    /**
     * Translation of the workspace induced by zoomIn & zoomOut
     *
     * @memberOf IKATS_GUI.Controllers.WorkflowController
     *
     * @alias translate
     * @type {Object}
     * @property {number} x distance (in pixels to the left side of the workflow area)
     * @property {number} y distance (in pixels to the top side of the workflow area)
     */
    self.translate = {
      x: 0,
      y: 0
    };
    /**
     * Scale of the workflow
     *
     * @alias scale
     * @memberOf IKATS_GUI.Controllers.WorkflowController
     * @type {number}
     */
    self.scale = 1;

    // Refresh the binds (used after async requests)
    $scope.refresh = function() {
      if ($scope.$$phase !== "$apply" && $scope.$$phase !== "$digest") {
        $scope.$apply();
      }
    };

    // Permits compatibility of refresh function outside of controller
    self.refresh = $scope.refresh;

    //
    // Code for the delete key.
    //
    const deleteKeyCode = 46;

    //
    // Code for control key.
    //
    const ctrlKeyCode = 17;

    //
    // Code for A key.
    //
    const aKeyCode = 65;

    //
    // Code for esc key.
    //
    const escKeyCode = 27;

    //
    // Setup the data-model for the chart.
    //
    const chartDataModel = {
      nodes: []
    };

    /**
     * Event handler for key-down on the flowchart.
     * - prevent default CTRL hotkeys
     * - activate demo mode with CTRL+SHIFT+D
     *
     * @alias keyDown
     * @memberOf IKATS_GUI.Controllers.WorkflowController
     * @param {event} evt javascript event firing function
     */
    self.keyDown = function(evt) {
      if (evt.keyCode === ctrlKeyCode) {
        evt.stopPropagation();
        evt.preventDefault();
      }
      if (evt.keyCode === 65 && evt.ctrlKey && document.activeElement.id ===
        "body") { //Handles CTRL+A : disable the all selection when out of textfields
        evt.stopPropagation();
        evt.preventDefault();
      }
      if (evt.keyCode === 68 && evt.shiftKey && evt.ctrlKey) {
        evt.stopPropagation();
        evt.preventDefault();
        toastr.info("Demo mode " + (self.demo.activated ? "de" : "") +
          "activated");
        self.demo.activated = !self.demo.activated;
      }
    };

    /**
     * Event handler for key-up on the flowchart.
     * - 'del' : delete selection
     * - 'CTRL+A' : select all
     * - 'escape' : deselect all
     *
     * @alias keyUp
     * @memberOf IKATS_GUI.Controllers.WorkflowController
     * @param {event} evt javascript event firing function
     */
    self.keyUp = function(evt) {
      //handle delete key only if the focus is on body (including flow-chart)
      if (document.activeElement.id === "body") {
        if (evt.keyCode === deleteKeyCode) {
          //
          // Delete key.
          //
          self.focusedNode = null;
          self.chartViewModel.deleteSelected();
        }

        if (evt.keyCode === aKeyCode && evt.ctrlKey) {
          //
          // Ctrl + A
          //
          self.chartViewModel.selectAll();
        }

        if (evt.keyCode === escKeyCode) {
          // Escape.
          self.chartViewModel.deselectAll();
        }
      }
    };

    /**
     * Delete selected nodes and connections.
     *
     * @alias deleteSelected
     * @memberOf IKATS_GUI.Controllers.WorkflowController
     */
    self.deleteSelected = function() {
      self.chartViewModel.deleteSelected();
    };

    /**
     * Check if a node is selected in the flowchart
     *
     * @alias checkSelected
     * @memberOf IKATS_GUI.Controllers.WorkflowController
     */
    self.checkSelected = function() {
      //remove focus of the eventual input when clicking the workflow
      document.activeElement.blur();
      self.focusedNode = self.chartViewModel.getSelectedNodes()[0];

      //if there is more than one node selected we assume that no one is focused.
      if (self.chartViewModel.getSelectedNodes()[1]) {
        self.focusedNode = null;
      }
    };

    /**
     * Don't tell anyone, but this is a special magic trick!
     */
    self.checkDoubleSelected = function(viz) {
      if (self.focusedNode && viz.isVizAvailable(self, self.focusedNode.data)) {
        viz.collectInputs(self, self.focusedNode.data);
        viz.expanded = true;
      }
    };

    /**
     * Create the view-model for the chart and attach to the scope.
     *
     * @alias chartViewModel
     * @memberOf IKATS_GUI.Controllers.WorkflowController
     * @type {flowchart.ChartViewModel}
     */
    self.chartViewModel = new flowchart.ChartViewModel(chartDataModel);
    self.focusedNode = self.chartViewModel.getSelectedNodes()[0];

    //
    //
    /**
     * Current information for workflow
     * with :
     * - id : Id of the workflow (if loaded)
     * - name : name of the workflow that will be saved (may be initialized when loading workflow)
     * - description : description of the workflow that will be saved (may be initialized when loading workflow)
     *
     * @alias current
     * @memberOf IKATS_GUI.Controllers.WorkflowController
     * @type {{id, name, description}}
     */
    self.current = {
      id: null,
      name: null,
      description: null
    };

    /**
     * Getter on current selection
     *
     * @alias getSelection
     * @memberOf IKATS_GUI.Controllers.WorkflowController
     * @returns {{}} model of the selection (contains :
     *      nodes - the list of nodes
     *      connections - the list of connections)
     */
    self.getSelection = function() {
      const model = {};
      model.nodes = [];
      model.connections = [];
      self.chartViewModel.getSelectedNodes().forEach(function(x) {
        model.nodes.push(x.data.toJson());
      });
      self.chartViewModel.getSelectedConnections().forEach(function(x) {
        model.connections.push(cloneObj(x.data));
      });
      return model;
    };

    /**
     * Checks if the selection is consistent :
     * @returns {boolean} true if the current selection contains at least 1 node, else, returns false
     * @alias isSelectionConsistent
     * @memberOf IKATS_GUI.Controllers.WorkflowController
     */
    self.isSelectionConsistent = function() {
      return self.getSelection().nodes.length > 0;
    };

    /**
     * Instantiate a new workflow with only 1 operator
     *
     * @alias new
     * @memberOf IKATS_GUI.Controllers.WorkflowController
     * @param {IKATS_GUI.Controllers.CatalogController} catalog controller reference
     */
    self.new = function(catalog) {
      // Remove pending queries
      window.opQueries.forEach(function(interval) {
        window.clearInterval(interval);
      });

      // Creating new wf
      self.current = {
        id: null,
        name: null,
        description: null
      };

      // Add the entry point referenced by op_id=1
      self.toAddToWorkflow = catalog.libraryFindOp(1, false);

      // Reset focused node
      self.focusedNode = null;
    };

    /**
     * Clear the workflow and starts a new one
     *
     * @alias clear
     * @memberOf IKATS_GUI.Controllers.WorkflowController
     */
    self.clear = function(catalog) {
      self.chartViewModel.selectAll();
      self.chartViewModel.deleteSelected();

      // Clear old workflow id
      self.current.id = null;

      self.new(catalog);
      toastr.info("Workflow Cleared");
    };

    /**
     * Saves a workflow
     *
     * @alias save
     * @memberOf IKATS_GUI.Controllers.WorkflowController
     * @param {boolean} update define if saving is over an existing workflow (true : delete old reference, false : don't)
     */
    self.save = function(update) {

      if (self.current.name === null || self.current.name === "") {
        toastr.error("Provide a name for the workflow");
        return;
      }
      let data = {
        nodes: [],
        connections: [],
        translate: self.translate,
        scale: self.scale
      };


      if (self.chartViewModel.data.nodes) {
        for (let i = 0; i < self.chartViewModel.data.nodes.length; i++) {
          const node = self.chartViewModel.data.nodes[i];
          data.nodes.push(node.toJson());
        }
      }
      if (self.chartViewModel.data.connections) {
        data.connections = cloneObj(self.chartViewModel.data.connections);
      }
      data = angular.toJson(data);

      // Handle Update mode
      let idToProvide = null;
      if (update) {
        idToProvide = self.current.id;
      }

      console.debug("DEBUG ID :", idToProvide);
      ikats.api.wf.save({
        async: true,
        name: self.current.name,
        description: self.current.description,
        data: data,
        id: idToProvide,
        success: function(data) {
          toastr.success("Workflow " + self.current.name +
            " successfully saved");

          console.debug("data : ", data);
          if (data.data !== null) {
            if (data.data.id) {
              self.current.id = data.data.id;
            }
          }
          self.list();

        },
        error: function() {
          toastr.error("Error occurred while saving workflow " +
            self.current.name);
        }
      });
    };

    /**
     * Workflow management information
     * @type {{}}
     * @memberOf IKATS_GUI.Controllers.WorkflowController
     */
    self.wf = {};

    /**
     * Current filter query
     * @memberOf IKATS_GUI.Controllers.WorkflowController
     */
    self.wf.query = "";

    /**
     * All data available since the last refresh
     * @memberOf IKATS_GUI.Controllers.WorkflowController
     */
    self.wf.originalData = null;

    /**
     * Data matching the current query
     * @memberOf IKATS_GUI.Controllers.WorkflowController
     */
    self.wf.data = null;

    /**
     * Filter function to reduce the number of displayed workflows to the ones that match the query.
     */
    self.wf.filter = function() {
      self.wf.data = [];
      let q = self.wf.query.toLowerCase();
      for (let item of self.wf.originalData) {
        if ((q === null) ||
          (item.description !== null && item.description.toLowerCase().indexOf(q) >= 0) ||
          (item.name !== null && item.name.toLowerCase().indexOf(q) >= 0)) {
          self.wf.data.push(item);
        }
      }
    };


    /**
     * List the available workflows
     *
     * @memberOf IKATS_GUI.Controllers.WorkflowController
     * @alias list
     */
    self.list = function() {
      self.wf.query = "";
      ikats.api.wf.list({
        async: true,
        success: function(data) {
          self.wf.originalData = data.data || [];
          self.wf.data = self.wf.originalData;
          self.refresh();
        },
        error: function() {
          self.wf.originalData = [];
          self.wf.data = self.wf.originalData;
          self.refresh();
        }
      });
    };

    /**
     * Method to load a workflow
     *
     * @alias load
     * @memberOf IKATS_GUI.Controllers.WorkflowController
     * @param {Number} id The Id of the workflow
     */
    self.load = function(id) {

      ikats.api.wf.load({
        async: true,
        id: id,
        success: function(result) {

          // Remove possible pending queries
          window.opQueries.forEach(function(interval) {
            window.clearInterval(interval);
          });

          // get a pseudo instance of the Workflow
          const local_wf = JSON.parse(result.data.raw);

          self.current = {
            id: result.data.id,
            name: result.data.name,
            description: result.data.description
          };

          //Clear the current workflow
          self.chartViewModel.selectAll();
          self.chartViewModel.deleteSelected();

          // Disable selection
          self.focusedNode = null;

          // Sets the translation and scale of the window
          if (local_wf.translate) {
            self.translate = cloneObj(local_wf.translate);
          }
          if (local_wf.scale) {
            self.scale = local_wf.scale;
          }

          self.chartViewModel.data.nodes = [];

          // Restore nodes
          for (let i = 0; i < local_wf.nodes.length; i++) {

            const node = new NODE(0);
            node.fromJson(local_wf.nodes[i], self);
            node.op_info.refresh_callback = self.refresh;
            node.op_info.parent = node;

            // Append to nodes
            if (!node.op_info.invalid) {
              self.chartViewModel.addNode(node);
            }
          }
          // Restore Connections
          local_wf.connections.forEach(function(connection) {
            let fromConn = $.grep(self.chartViewModel.nodes,
              function(x) {
                return x.data.id === connection.source.nodeID;
              })[0];
            if (fromConn) {
              fromConn = fromConn.outputConnectors[connection.source
                .connectorIndex];
            }
            let toConn = $.grep(self.chartViewModel.nodes,
              function(x) {
                return x.data.id === connection.dest.nodeID;
              })[0];
            if (toConn) {
              toConn = toConn.inputConnectors[connection.dest.connectorIndex];
            }
            if (toConn && fromConn) {
              self.chartViewModel.createNewConnection(fromConn,
                toConn);
            }
          });
          self.refresh();
          toastr.info("Workflow [" + result.data.name + "] loaded");
        },
        error: function() {
          toastr.error("Error occurred while loading workflow " +
            id);
        }
      });
    };

    /**
     * Append a macro OP or custom OP to wf instance
     *
     * @alias appendMacro
     * @memberOf IKATS_GUI.Controllers.WorkflowController
     * @param {Number} id the ID of the macro to append
     */
    self.appendMacro = function(id) {

      ikats.api.mo.load({
        async: true,
        id: id,
        success: function(result) {

          // Get a pseudo instance of the Workflow / Macro
          const local_wf = JSON.parse(result.data.raw);

          //Cleans selection
          self.chartViewModel.deselectAll();

          // Update node ids according to current wf index
          // Get max index :
          const curNodes = self.chartViewModel.nodes;
          if (curNodes.length > 0) {
            const shiftTable = {};
            const curIds = curNodes.map(function(d) {
              return d.data.id;
            });
            let maxId = Math.max(...curIds);
            local_wf.nodes.forEach(function(node) {
              // keep trace of the transformation
              shiftTable[node.id] = maxId + 1;
              // Sets up new index
              node.id = ++maxId;
            });

            // Apply ID shift to connections
            local_wf.connections.forEach(function(connection) {
              connection.source.nodeID = shiftTable[connection.source
                .nodeID];
              connection.dest.nodeID = shiftTable[connection.dest
                .nodeID];
            });
          }

          // Restore nodes
          for (let i = 0; i < local_wf.nodes.length; i++) {

            const node = new NODE(0);
            node.fromJson(local_wf.nodes[i], self);
            node.op_info.refresh_callback = self.refresh;
            node.op_info.parent = node;
            // Place the macro operator at mouse cursor position
            node.x += ((self.relativePosition.x - self.translate.x) /
              self.scale);
            node.y += ((self.relativePosition.y - self.translate.y) /
              self.scale);
            // Append to nodes
            self.chartViewModel.addNode(node);
            self.chartViewModel.nodes[self.chartViewModel.nodes.length -
              1].select();
          }
          // Restore Connections
          local_wf.connections.forEach(function(connection) {
            const fromConn = $.grep(self.chartViewModel.nodes,
              function(x) {
                return x.data.id === connection.source.nodeID;
              })[0].outputConnectors[connection.source.connectorIndex];
            const toConn = $.grep(self.chartViewModel.nodes,
              function(x) {
                return x.data.id === connection.dest.nodeID;
              })[0].inputConnectors[connection.dest.connectorIndex];

            self.chartViewModel.createNewConnection(fromConn,
              toConn);
          });
          self.refresh();
          toastr.info("Loaded [" + result.data.name +
            "] into workflow");
        },
        error: function() {
          toastr.error("Error occurred while loading workflow " +
            id);
        }
      });
    };

    /**
     * Method to prepare workflow deletion
     *
     * @alias confirmDelete
     * @memberOf IKATS_GUI.Controllers.WorkflowController
     * @param {{}} workflow the workflow object to delete
     */
    self.confirmDelete = function(workflow) {
      self.wfToDelete = workflow;
    };

    /**
     * Method to delete a workflow
     * NB : use of confirmDelete is required before calling this function
     *
     * @alias del
     * @memberOf IKATS_GUI.Controllers.WorkflowController
     */
    self.del = function() {
      ikats.api.wf.del({
        async: true,
        id: self.wfToDelete.id,
        success: function() {
          toastr.info("Workflow deleted");

          if (self.current.id === self.wfToDelete.id) {
            self.current.id = null;
          }

          self.list();
        },
        error: function() {
          toastr.error("Impossible to delete workflow");
        }
      });

    };

    /**
     * Toggle opening of an ui tree component
     *
     * @alias toggle
     * @memberOf IKATS_GUI.Controllers.WorkflowController
     * @param item a ui tree component reference
     */
    self.toggle = function(item) {
      item.toggle();
    };

    /**
     * Run selected operator
     *
     * @alias runOnce
     * @memberOf IKATS_GUI.Controllers.WorkflowController
     */
    self.runOnce = function() {
      const nodeToRun = self.focusedNode;
      if (nodeToRun) {
        nodeToRun.data.op_info.run();
        self.refresh();
      }
    };

    // Temporary operator data to add to the workflow.
    self.toAddToWorkflow = null;

    /**
     * Append an operator (can also be a macro operator or a custom operator)
     *
     * @alias appendToWorkflow
     * @memberOf IKATS_GUI.Controllers.WorkflowController
     * @param {{}} thing the object representing (macro/custom/normal) operator to add to workflow
     */
    self.appendToWorkflow = function(thing) {
      if (!thing && !self.toAddToWorkflow) {
        // self case happen after clearing the toAddToWorkflow variable.
        return;
      }
      if (!thing.op_id) { // If the thing to append is a custom OP or a Macro
        // Append the macro
        self.appendMacro(thing.id);
        // Cleans the variable toAddToWorkflow
        self.toAddToWorkflow = null;
        return;
      }
      // else the thing should be a simple OP
      let op_info = thing;
      // Input to handle

      if (!op_info) {
        op_info = self.toAddToWorkflow;
      }

      // Build a Node object to drop into workflow

      // Get appropriate ID
      const curNodes = self.chartViewModel.nodes;
      let newID;
      if (curNodes.length > 0) {
        const curIds = curNodes.map(function(d) {
          return d.data.id;
        });
        newID = Math.max(...curIds) + 1;
      } else {
        newID = 1;
      }
      const newNodeDataModel = new NODE(newID);

      // complete with drop location
      newNodeDataModel.x = (self.relativePosition.x - self.translate.x) /
        self.scale;
      newNodeDataModel.y = (self.relativePosition.y - self.translate.y) /
        self.scale;

      // Add the chart view model for interaction
      newNodeDataModel.wf = self;

      // Define the refresh callback to handle async updates
      newNodeDataModel.bindOperator(op_info);
      newNodeDataModel.op_info.refresh_callback = self.refresh;
      newNodeDataModel.op_info.parent = newNodeDataModel;

      // Append to nodes
      self.chartViewModel.addNode(newNodeDataModel);

      // At the end of the process, we flush the temporary data
      delete self.toAddToWorkflow;

      // Model has been updated with external information. Need to force the refresh
      self.refresh();
    };

    /**
     * When Angular detects changes over toAddToWorkflow variable, propagate them to the workflow Model
     */
    $scope.$watch(function() {
      return self.toAddToWorkflow;
    }, self.appendToWorkflow);

    /**
     * The position of the mouse in the flowchart component
     *
     * @alias relativePosition
     * @memberOf IKATS_GUI.Controllers.WorkflowController
     * @type {{x: number, y: number}}
     */
    self.relativePosition = {
      x: 350,
      y: 20
    };

    /**
     * Update the relativePosition Variable
     *
     * @alias updateCoordinates
     * @memberOf IKATS_GUI.Controllers.WorkflowController
     * @param {event} $event the javascript event firing function
     */
    self.updateCoordinates = function($event) {
      //get the position of the flowchart
      const offsets = document.getElementById("dropArea").getBoundingClientRect();
      // the position of the cursor relatively to the flowchart element
      self.relativePosition = {
        x: $event.clientX - offsets.left,
        y: $event.clientY - offsets.top
      };
    };

    /**
     * Remove the given element from the md_filter template
     *
     * @alias delItem
     * @memberOf IKATS_GUI.Controllers.WorkflowController
     * @param {Array} list a list of md_params
     * @param {String} elem the value of a md_param
     */
    self.delItem = function(list, elem) {
      const index = list.value.indexOf(elem);
      if (index > -1) {
        list.value.splice(index, 1);
      }
    };

    /**
     * Global page initialization, will call initiation of a new workflow
     *
     * @alias init
     * @memberOf IKATS_GUI.Controllers.WorkflowController
     * @param {IKATS_GUI.Controllers.CatalogController} catalog a Catalog controller reference
     */
    self.init = function(catalog) {
      // Init a new workflow
      catalog.loadOperators(function() {
        self.new(catalog);
      }, self);
    };

    /**
     * Returns the value of the previous node linked to the input
     *
     * @alias getSourceData
     * @memberOf IKATS_GUI.Controllers.WorkflowController
     *
     * @param {number} node_id Id of the node to retrieve data from
     * @param {string} input_name name of the input to get data from
     * @return {*}
     */
    self.getSourceData = function(node_id, input_name) {
      // Get connector index from input name
      const input_conn_index = self.chartViewModel
        .findNode(node_id)
        .data
        .inputConnectors
        .map(function(x) {
          return x.name;
        })
        .indexOf(input_name);

      // Get the parent connector linked to the input
      const parent_connector = self.chartViewModel.getSourceConnector(
        node_id, input_conn_index);

      if (parent_connector !== -1) {
        // Get the parent node to define if node is an algo or a core operator
        if (parent_connector.data.rid !== null) {
          // The node is an algorithm, we get the data from the server
          return self.getDataFromRID(parent_connector.data.rid);
        } else {
          // The node is a core operator, we directly get the data from the model
          return parent_connector.data.value;
        }
      } else {
        return null;
      }
    };

    /**
     * Get the result corresponding to a resource Id
     *
     * @alias getDataFromRID
     * @memberOf IKATS_GUI.Controllers.WorkflowController
     * @param {Number} rid the resource Id of the result of a backend computation
     */
    self.getDataFromRID = function(rid) {
      return ikats.api.op.result(rid).data;
    };


    /**
     * Zoom into workflow (max 3 times the initial size)
     *
     * @alias zoomIn
     * @memberOf IKATS_GUI.Controllers.WorkflowController
     */
    self.zoomIn = function() {
      const factor = 1.25;
      if (self.scale < 3) {
        self.scale *= factor;
        self.translate.x -= (self.relativePosition.x - self.translate.x) *
          (factor - 1);
        self.translate.y -= (self.relativePosition.y - self.translate.y) *
          (factor - 1);
        self.refresh();
      }
    };

    /**
     * Zoom out workflow (min 0.4 time the initial size)
     *
     * @alias zoomOut
     * @memberOf IKATS_GUI.Controllers.WorkflowController
     */
    self.zoomOut = function() {
      const factor = 0.8; // =1/1.25
      if (self.scale > 0.4) {
        self.scale *= factor;
        self.translate.x -= (self.relativePosition.x - self.translate.x) *
          (factor - 1);
        self.translate.y -= (self.relativePosition.y - self.translate.y) *
          (factor - 1);
        self.refresh();
      }
    };

    /**
     * Compute the style of an object that should be disabled when workflow contains no selection
     *
     * @alias isDisabledStyle
     * @memberOf IKATS_GUI.Controllers.WorkflowController
     * @returns {*} a CSS styling object
     */
    self.isDisabledStyle = function() {
      if (self.chartViewModel.getSelectedNodes().length < 1) {
        return {
          color: "#B6B2AE"
        };
      }
      return {};
    };

    /**
     * Helpers part of the scope, used by template calls
     *
     * @alias helpers
     * @class IKATS_GUI.Controllers.WorkflowController.helpers
     * @memberOf IKATS_GUI.Controllers.WorkflowController
     * @type {{}}
     */
    self.helpers = {};

    /**
     * Wrapper for the math min function
     *
     * @alias min
     * @memberOf IKATS_GUI.Controllers.WorkflowController.helpers
     * @param {number} x first value
     * @param {number} y second value
     * @returns {number} the lowest value
     */
    self.helpers.min = function(x, y) {
      return Math.min(x, y);
    };

    // Administration page actions
    self.admin = {};
    // Dataset management
    self.admin.visiblePanel = "";
    self.admin.dataset = {};
    // List of existing dataset
    self.admin.dataset.originalData = [];
    // List of filtered dataset
    self.admin.dataset.data = [];
    // Filter query
    self.admin.dataset.query = "";
    /**
     * Filter
     */
    self.admin.dataset.filter = function() {
      let q = self.admin.dataset.query.toLowerCase();
      self.admin.dataset.data = [];
      for (let item of self.admin.dataset.originalData) {
        if ((q === null) ||
          (item.desc !== null && item.desc.toLowerCase().indexOf(q) >= 0) ||
          (item.name !== null && item.name.toLowerCase().indexOf(q) >= 0)) {
          self.admin.dataset.data.push(item);
        }
      }
    };


    /**
     * Loads the dataset list for administration panel
     */
    self.admin.dataset.init = function() {
      self.admin.visiblePanel = "dataset";
      self.admin.dataset.query = "";
      self.admin.dataset.originalData = ikats.api.ds.list({
        "sort": true
      }).data;
      self.admin.dataset.data = self.admin.dataset.originalData;
    };
    /**
     * Delete the dataset
     * @param ds_name Name of the dataset to delete
     * @param delete_tsuid flag indicating if the associated timeseries shall be also deleted
     */
    self.admin.dataset.del = function(ds_name, delete_tsuid) {
      ikats.api.ds.del({
        "ds_name": ds_name,
        "deep": delete_tsuid,
        success: function() {
          toastr.info(`Dataset ${ds_name} deleted`);
          self.admin.dataset.init();
        },
        error: function() {
          toastr.error(`Impossible to delete dataset ${ds_name}`);
        },
      });
    };

    self.admin.table = {};
    // List of existing table
    self.admin.table.originalData = [];
    // List of filtered table
    self.admin.table.data = [];
    // Filter query
    self.admin.table.query = "";
    /**
     * Filter
     */
    self.admin.table.filter = function() {
      self.admin.table.data = [];
      for (let item of self.admin.table.originalData) {
        if (
          (self.admin.table.query === "") ||
          (item.name !== null && item.name.toLowerCase().indexOf(self.admin.table.query.toLowerCase()) >= 0)) {
          self.admin.table.data.push(item);
        }
      }
    };
    /**
     * Loads the table list for administration panel
     */
    self.admin.table.init = function() {
      self.admin.visiblePanel = "table";
      self.admin.table.query = "";
      self.admin.table.originalData = ikats.api.table.list().data;
      self.admin.table.data = self.admin.table.originalData;
    };
    /**
     * Delete the table
     * @param name Name of the table to delete
     */
    self.admin.table.del = function(name) {
      ikats.api.table.del({
        "table_name": name,
        success: function() {
          toastr.info(`Table ${name} deleted`);
          self.admin.table.init();
        },
        error: function() {
          toastr.error(`Impossible to delete table ${name}`);
        },
      });
    };
  }
]);
