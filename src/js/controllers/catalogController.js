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
 * @file Defines Catalog controller
 */

/**
 * Controller handling catalog aspects : lists available operators.
 * @class IKATS_GUI.Controllers.CatalogController
 * @memberOf IKATS_GUI.Controllers
 */
angular.module("ikatsapp.controllers").controller("CatalogController", ["toastr", function (toastr) {

    const self = this;

    self.tree_search_pattern = "";
    self.tree_search_results = [];

    /**
     * Catalog of operators
     *
     * @alias library
     * @memberOf IKATS_GUI.Controllers.CatalogController
     * @type {Array}
     */
    self.library = [];

    /**
     * Find the operator matching the criteria
     *
     * @alias searchBoxFilter
     * @memberOf IKATS_GUI.Controllers.CatalogController
     * @param {Object=} from_cat entry point (sub category) to search into
     * @return {?OP_INFO[]}
     */
    self.searchBoxFilter = function (from_cat) {
        if (from_cat === undefined) {
            from_cat = self.library;
            self.tree_search_results = [];
            if (self.tree_search_pattern === "") {
                return null;
            }
        }
        else {
            from_cat = from_cat.nodes;
        }

        let ret = [];

        const criteria = self.tree_search_pattern.toLowerCase();
        for (let i = 0; i < from_cat.length; i++) {
            if (from_cat[i].category) {
                ret = ret.concat(self.searchBoxFilter(from_cat[i]));
            }
            else {
                if ((from_cat[i].label.toLowerCase().indexOf(criteria) >= 0) ||
                    (from_cat[i].desc.toLowerCase().indexOf(criteria) >= 0)) {
                    ret.push(from_cat[i]);
                }
            }
        }
        return ret;
    };

    /**
     * Find a category and return it
     * from_cat allow to specify an entry point (as complete category data)
     *
     * @alias libraryFindCat
     * @memberOf IKATS_GUI.Controllers.CatalogController
     * @param {String} cat_name the name of the category to find
     * @param {Object=} from_cat entry point (sub category) to search into
     * @return {Object} the added category
     */
    self.libraryFindCat = function (cat_name, from_cat) {
        // Capitalize first letter
        cat_name = capitalize(cat_name);

        const category_tree = cat_name.split("/");

        // Use the generic entry point if no specific category is defined
        if (from_cat === undefined) {
            from_cat = self.library;
        }
        let ret_cat = ObjFromArray(from_cat, "name", category_tree.shift())[0];


        if ((ret_cat !== undefined) && (category_tree.length > 0)) {
            ret_cat = self.libraryFindCat(category_tree.join("/"), ret_cat.nodes);
        }

        return ret_cat;

    };

    /**
     * Find Operator by its Id
     *
     * @alias libraryFindOp
     * @memberOf IKATS_GUI.Controllers.CatalogController
     *
     * @param {number} op_id Operator identifier (unique duet:[op_id,isAlgo])
     * @param {boolean} isAlgo determines if the operator is an algo or a core operator
     * @param {Object=} from_cat entry point (sub category) to search into
     *
     * @return {?OP_INFO} Operator
     */
    self.libraryFindOp = function (op_id, isAlgo, from_cat) {
        if (from_cat === undefined) {
            from_cat = self.library;
        }
        else {
            from_cat = from_cat.nodes;
        }

        for (let i = 0; i < from_cat.length; i++) {
            if (from_cat[i].category) {
                const r = self.libraryFindOp(op_id, isAlgo, from_cat[i]);
                if (r !== null) {
                    return r;
                }
            }
            else {
                if ((from_cat[i].op_id === op_id) && (from_cat[i].isAlgo === isAlgo)) {
                    return from_cat[i];
                }
            }
        }
        return null;
    };

    /**
     * Append a category to the catalog and return it
     * from_cat allow to specify an entry point (as complete category data)
     *
     * @alias libraryAddCat
     * @memberOf IKATS_GUI.Controllers.CatalogController
     *
     * @param {String} cat_name Name of the category to create
     * @param {?String=} desc Description of the category to create
     * @param {?Object=} from_cat insert category under self one (or under root level if not defined)
     * @return {Object} the added category
     */
    self.libraryAddCat = function (cat_name, desc, from_cat) {

        if (cat_name === null) {
            cat_name = "Others";
        }

        // Capitalize first letter
        const old_cat_name = cat_name;
        cat_name = capitalize(cat_name);
        if (cat_name !== old_cat_name) {
            console.warn("Category should be capitalized: " + old_cat_name + " --> " + cat_name);
        }

        // Split the input name to know the category depth
        const category_tree = cat_name.split("/");

        // Use the generic entry point if no specific category is defined
        if (from_cat === undefined) {
            from_cat = self.library;
        }
        else {
            from_cat = from_cat.nodes;
        }

        const cat_to_create = category_tree.shift();

        // Get if the category is created
        let created_category = self.libraryFindCat(cat_to_create, from_cat);

        // The category is not created, create it
        if (created_category === undefined) {
            from_cat.push({
                name: cat_to_create,
                desc: desc,
                category: true,
                nodes: []
            });

            // The created category is the very last one in the array (because of the push)
            created_category = from_cat[from_cat.length - 1];
        }
        else {
            // Category exists, update the description
            if (desc) {
                created_category.desc = desc;
            }
        }

        // Apply recursively
        if (category_tree.length > 0) {
            created_category = self.libraryAddCat(category_tree.join("/"), desc, created_category);
        }

        // Return the created category
        return created_category;
    };

    /**
     * Append an operator to the catalog
     *
     * @alias libraryAddOp
     * @memberOf IKATS_GUI.Controllers.CatalogController
     *
     * @param {Object} cat Category to append the operator to
     * @param {OP_INFO} op Object defining the minimum information to locate and display operator:
     *       - id: operator id
     *       - isAlgo: boolean indicating the origin of the entry
     *       - title: First title to display
     *       - subtitle: Second title to display
     *       - desc: description of the operator
     *       - family: string representing the family that this operator belongs to
     */
    self.libraryAddOp = function (cat, op) {

        if (cat === null) {
            cat = self.library;
        }
        else {
            cat = cat.nodes;
        }
        cat.push(op);
    };


    /**
     * Load and build the list of all available operators.
     * this method will merge both sources:
     * - Ikats algorithms (also known as catalog)
     * - op.coreOperators (all operators that are not algorithms)
     * - Customized operators (all operators modified by user)
     *
     * @alias loadOperators
     * @memberOf IKATS_GUI.Controllers.CatalogController
     * @param {function=} callback Optional callback function
     * @param {IKATS_GUI.Controllers.WorkflowController} wf Workflow controller reference
     */
    self.loadOperators = function (callback, wf) {
        // Create default categories
        $.getJSON("families.json", function (families) {
            families.forEach(function (cat) {
                self.libraryAddCat(cat.label, cat.description);
            });

            // Append Core operators summary
            BuildCoreOperatorsList();
            CORE_OPERATORS_LIB.forEach(function (raw_op) {
                // Limit each item to the minimum to display to catalog
                const op = new OP_INFO(null, raw_op.op_id, false);
                op.label = raw_op.label;
                op.algo = "Core operator";
                op.desc = raw_op.desc;
                op.family = raw_op.family;
                const cat = self.libraryAddCat(capitalize(op.family));
                self.libraryAddOp(cat, op);
            });

            // Append implementations to operators list
            const implementations = ikats.api.op.list().data;
            implementations.forEach(function (raw_op) {
                if (raw_op.visibility === true) {
                    const op = new OP_INFO(null, raw_op.id, true);
                    op.name = raw_op.name;
                    op.label = raw_op.label;
                    op.algo = raw_op.algo;
                    op.desc = raw_op.description;
                    op.family = $.grep(families, function (x) {
                        return capitalize(x.name) === capitalize(raw_op.family);
                    })[0].label;
                    const cat = self.libraryAddCat(op.family);
                    self.libraryAddOp(cat, op);
                }
            });

            // Call extra action in callback if defined
            if (typeof (callback) === "function") {
                callback();
            }

            wf.refresh();

        });
    };


}]);
