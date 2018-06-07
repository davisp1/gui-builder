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
 * Edit Metadata for a TS in a TS list.
 *
 * @constructor
 * @param {string} container - the ID of the injected div
 * @param {Object} data - the data used in the visualization
 *                 Contains : a list of couples {"tsuid":"XX","funcId":"XX"}
 * @param {Array} callbacks - the list of the callbacks used by Viz
 */
class MDEditViz extends VizTool {

    constructor(container, data, callbacks) {
        // Call super-class constructor
        super(container, data, callbacks);
        this.name = "MD Edit";

        // Variable containing table markup of the DOM
        this.table = null;

        // Variable containing the select markup used to choose the TS to display
        this.selectTS = null;
    }

    /**
     * Display the VizTool : collect and format the data (if necessary) then render the VizTool
     */
    display() {

        const self = this;

        // Clear former display
        const container = $("#" + self.container);
        container.empty();

        // TS Select box
        self.selectTS = $("<select />").addClass("form-control");
        self.data.forEach(function (tsItem) {
            // Append all TS as option fo the select
            // Show the functional name instead of the TSUID
            $("<option />", {value: tsItem.tsuid, text: tsItem.funcId}).appendTo(self.selectTS);
        });
        self.selectTS.change(function () {
            // Upon a change in the list, call the update of the table
            self.updateTable();
        });

        // Build structure, bootstrap helps a lot here
        const responsive_area = $("<div>").addClass("table-responsive");
        self.table = $(`<table id="md_listViz_table">`)
            .addClass("table table-bordered table-hover table-condensed table-responsive");

        // Add the table inside the responsive div
        responsive_area.append(self.table);

        // Add all components in the container defined by VizEngine
        container
            .append(self.selectTS)
            .append(responsive_area);

        // Update Table content
        self.updateTable();
    }

    /**
     * Wake up (Restore) the VizTool.
     */
    wakeUp() {
        // Just call again the display
        this.display();
    }

    /**
     * Format the content of the table (showing the metadata) by using the TS selected in select box
     */
    updateTable() {

        const self = this;

        // TSUID to use
        const tsuid = self.selectTS.val();

        // Read all Metadata of this TS
        ikats.api.md.read({
            async: true,
            // ts_list is a list of TS, so we use a list of 1 TS, the one to choose
            // this way allows to avoid keeping in memory to many useless information
            ts_list: [tsuid],

            error: function () {
                // Something went wrong

                //Notify the user by using the toaster callback
                self.callbacks.toastr.error(`Impossible to get Metadata for ${tsuid}`);
            },

            success: function (result) {
                // We have the metadata

                //Clear the table
                self.table.html("");

                // Set the Title line
                const title_line = $("<tr>");
                $("<th>").html("Meta Data").appendTo(title_line);
                $("<th>").html("Value").appendTo(title_line);
                $("<th>").html("Actions").appendTo(title_line);
                title_line.appendTo(self.table);

                /**
                 * Builder for HTML Update button
                 * @param {Object} md_info Object containing information about the metadata
                 * @param {Object} edit_box Edit box object
                 * @returns {jQuery} the button to insert as Jquery
                 */
                function update_btn_builder(md_info, edit_box) {
                    return $("<button>")
                    // Use bootstrap for the look & feel
                        .addClass("btn")
                        .addClass("btn-link")
                        .html(`<span class="glyphicon glyphicon-save"></span> Update`)
                        .click(function () {
                            // Handling click event to trigger the save
                            ikats.api.md.update({
                                tsuid: md_info.tsuid,
                                name: md_info.name,
                                value: edit_box.val(),
                                async: true,
                                success: function () {
                                    // Notify user
                                    self.callbacks.toastr.success("MD Updated");
                                    // Refresh the table
                                    self.updateTable();
                                },
                                error: function () {
                                    // Notify user
                                    self.callbacks.toastr.error("MD Not Updated something went wrong");
                                }
                            });
                        });
                }

                /**
                 * Builder for HTML Delete button
                 * @param {Object} md_info Object containing information about the metadata
                 * @returns {jQuery} the button to insert as Jquery
                 */
                function del_btn_builder(md_info) {
                    return $("<button>")
                    // Use bootstrap for the look & feel
                        .addClass("btn")
                        .addClass("btn-link")
                        .html(`<span class="glyphicon glyphicon-trash"></span> Delete`)
                        .click(function () {
                            // Handling click event to trigger the save
                            ikats.api.md.del({
                                tsuid: md_info.tsuid,
                                name: md_info.name,
                                async: true,
                                success: function () {
                                    // Notify user
                                    self.callbacks.toastr.success("MD deleted");
                                    // Refresh the table
                                    self.updateTable();
                                },
                                error: function () {
                                    // Notify user
                                    self.callbacks.toastr.error("MD not deleted something went wrong");
                                }
                            });
                        });
                }

                /**
                 * Builder for HTML Create new metadata button
                 * @param {string} tsuid TSUID to attach the metadata to
                 * @param {Object} name Object containing the name of the metadata
                 * @param {Object} value Object containing the value of the metadata
                 * @param {string} dtype type of the metadata
                 * @returns {jQuery} the button to insert as Jquery
                 */
                function save_new_btn_builder(tsuid, name, value, dtype) {
                    return $("<button>")
                    // Use bootstrap for the look & feel
                        .addClass("btn")
                        .addClass("btn-link")
                        .html("New")
                        .click(function () {
                            // Handling click event to trigger the save
                            ikats.api.md.create({
                                tsuid: tsuid,
                                name: name.val(),
                                value: value.val(),
                                dtype: dtype,
                                async: true,
                                success: function () {
                                    // Notify user
                                    self.callbacks.toastr.success("MD created");
                                    // Refresh the table
                                    self.updateTable();
                                },
                                error: function () {
                                    // Notify user
                                    self.callbacks.toastr.error("MD not created something went wrong");
                                }
                            });
                        });
                }


                // Body
                // Each line
                result.data.forEach(function (md_info) {
                    const table_line = $("<tr>");

                    // First column : the metadata name
                    $(`<th class="col-md-3">`).html(md_info.name).appendTo(table_line);

                    // Prepare the edit box (for now, only textbox)
                    const edit_box = $("<input>");
                    switch (md_info.type) {
                        // case "date":
                        // case "complex":
                        // case "bool":
                        // case "text":
                        default:
                            edit_box
                                .addClass("form-control input-sm")
                                .attr("type", "text")
                                .val(md_info.value);
                    }

                    // Append the box to the 2nd column
                    table_line.append($(`<td class="col-md-6">`).append(edit_box));

                    // The last column is filled with action buttons
                    table_line.append(
                        $("<td>")
                            .append(update_btn_builder(md_info, edit_box))
                            .append(del_btn_builder(md_info))
                    );

                    // Append the line to the table
                    table_line.appendTo(self.table);
                });

                // Build the last line used to create a new Metadata
                const last_line = $("<tr>");
                const name = $("<input>")
                    .addClass("form-control")
                    .attr("type", "text");
                const value = $("<input>")
                    .addClass("form-control")
                    .attr("type", "text");
                last_line.append($("<td>").append(name));
                last_line.append($("<td>").append(value));
                last_line.append($("<td>").append(save_new_btn_builder(tsuid, name, value, "string")));
                last_line.appendTo(self.table);
            }
        });
    }
}
