//
// Define the 'app' module.
//
angular.module('app', ['toastr', 'flowChart',])

//
// Simple service to create a prompt.
//
    .factory('prompt', function () {

        /* Uncomment the following to test that the prompt service is working as expected.
         return function () {
         return "Test!";
         }
         */

        // Return the browsers prompt function.
        return prompt;
    })

    //
    // Application controller.
    //
    .controller('AppCtrl', ['$scope', 'prompt', function AppCtrl($scope, prompt) {

        //
        // Code for the delete key.
        //
        const deleteKeyCode = 46;

        //
        // Code for control key.
        //
        const ctrlKeyCode = 17;

        //
        // Set to true when the ctrl key is down.
        //
        let ctrlDown = false;

        //
        // Code for A key.
        //
        const aKeyCode = 65;

        //
        // Code for esc key.
        //
        const escKeyCode = 27;

        //
        // Selects the next node id.
        //
        let nextNodeID = 10;

        //
        // Setup the data-model for the chart.
        //
        const chartDataModel = {

            nodes: [
                {
                    name: "Example Node 1",
                    id: 0,
                    x: 0,
                    y: 0,
                    width: 350,
                    inputConnectors: [
                        {
                            name: "A",
                        },
                        {
                            name: "B",
                        },
                        {
                            name: "C",
                        },
                    ],
                    outputConnectors: [
                        {
                            name: "A",
                        },
                        {
                            name: "B",
                        },
                        {
                            name: "C",
                        },
                    ],
                },

                {
                    name: "Example Node 2",
                    id: 1,
                    x: 400,
                    y: 200,
                    inputConnectors: [
                        {
                            name: "A",
                        },
                        {
                            name: "B",
                        },
                        {
                            name: "C",
                        },
                    ],
                    outputConnectors: [
                        {
                            name: "A",
                        },
                        {
                            name: "B",
                        },
                        {
                            name: "C",
                        },
                    ],
                },

            ],

            connections: [
                {
                    source: {
                        nodeID: 0,
                        connectorIndex: 1,
                    },

                    dest: {
                        nodeID: 1,
                        connectorIndex: 2,
                    },
                },
                {
                    source: {
                        nodeID: 0,
                        connectorIndex: 0,
                    },

                    dest: {
                        nodeID: 1,
                        connectorIndex: 0,
                    },
                },

            ]
        };

        //
        // Event handler for key-down on the flowchart.
        //
        $scope.keyDown = function (evt) {

            if (evt.keyCode === ctrlKeyCode) {

                ctrlDown = true;
                evt.stopPropagation();
                evt.preventDefault();
            }
        };

        //
        // Event handler for key-up on the flowchart.
        //
        $scope.keyUp = function (evt) {


            if (evt.keyCode === deleteKeyCode) {
                //
                // Delete key.
                //
                $scope.chartViewModel.deleteSelected();
            }

            if (evt.keyCode === aKeyCode && ctrlDown) {
                //
                // Ctrl + A
                //
                $scope.chartViewModel.selectAll();
            }

            if (evt.keyCode === escKeyCode) {
                // Escape.
                $scope.chartViewModel.deselectAll();
            }

            if (evt.keyCode === ctrlKeyCode) {
                ctrlDown = false;

                evt.stopPropagation();
                evt.preventDefault();
            }
        };

        //
        // Add a new node to the chart.
        //
        $scope.addNewNode = function () {

            let nodeName = prompt("Enter a node name:", "New node");
            if (!nodeName) {
                return;
            }

            //
            // Template for a new node.
            //
            const newNodeDataModel = {
                name: nodeName,
                id: nextNodeID++,
                x: 0,
                y: 0,
                inputConnectors: [
                    {
                        name: "X"
                    },
                    {
                        name: "Y"
                    },
                    {
                        name: "Z"
                    }
                ],
                outputConnectors: [
                    {
                        name: "1"
                    },
                    {
                        name: "2"
                    },
                    {
                        name: "3"
                    }
                ],
            };

            $scope.chartViewModel.addNode(newNodeDataModel);
        };

        //
        // Add an input connector to selected nodes.
        //
        $scope.addNewInputConnector = function () {
            let connectorName = prompt("Enter a connector name:", "New connector");
            if (!connectorName) {
                return;
            }

            const selectedNodes = $scope.chartViewModel.getSelectedNodes();
            for (let i = 0; i < selectedNodes.length; ++i) {
                const node = selectedNodes[i];
                node.addInputConnector({
                    name: connectorName,
                });
            }
        };

        //
        // Add an output connector to selected nodes.
        //
        $scope.addNewOutputConnector = function () {
            let connectorName = prompt("Enter a connector name:", "New connector");
            if (!connectorName) {
                return;
            }

            const selectedNodes = $scope.chartViewModel.getSelectedNodes();
            for (let i = 0; i < selectedNodes.length; ++i) {
                const node = selectedNodes[i];
                node.addOutputConnector({
                    name: connectorName,
                });
            }
        };

        //
        // Delete selected nodes and connections.
        //
        $scope.deleteSelected = function () {

            $scope.chartViewModel.deleteSelected();
        };

        //
        // Create the view-model for the chart and attach to the scope.
        //
        $scope.chartViewModel = new flowchart.ChartViewModel(chartDataModel);
    }])
;