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
 * @file Library to connect to Ikats REST API
 */

/**
 * The XHR Object returns all the information about a request
 *
 * @typedef {Object} xhr
 * @property {number} status The HTTP Status code
 * @property {string} statusText Generally the Human readable version of the HTTP Status Code
 * @property {Object} responseJSON body of the response as JSON format
 * @property {string} responseText body of the response as raw text format
 */


/**
 * Ikats root level object
 * @namespace ikats
 */
const ikats = {

  /**
   * Constants part
   * @type {Object}
   * @namespace ikats.constants
   */
  constants: {},

  /**
   * Common functions
   * @type {Object}
   * @namespace ikats.common
   */
  common: {},

  /**
   * API endpoints
   * @type {Object}
   * @namespace ikats.api
   */
  api: {
    /**
     * API endpoints specific to dataset
     * @type {Object}
     * @namespace ikats.api.ds
     */
    ds: {},
    /**
     * API endpoints specific to timeseries
     * @type {Object}
     * @namespace ikats.api.ts
     */
    ts: {},
    /**
     * API endpoints specific to metadata
     * @type {Object}
     * @namespace ikats.api.md
     */
    md: {},
    /**
     * API endpoints specific to workflow
     * @type {Object}
     * @namespace ikats.api.wf
     */
    wf: {},
    /**
     * API endpoints specific to macro operators
     * @type {Object}
     * @namespace ikats.api.mo
     */
    mo: {},
    /**
     * API endpoints specific to families
     * @type {Object}
     * @namespace ikats.api.families
     */
    families: {},
    /**
     * API endpoints specific to algorithms
     * @type {Object}
     * @namespace ikats.api.algorithm
     */
    algorithm: {},
    /**
     * API endpoints specific to operator (implementation)
     * @type {Object}
     * @namespace ikats.api.op
     */
    op: {},
    /**
     * API endpoints specific to tables
     * @type {Object}
     * @namespace ikats.api.table
     */
    table: {},
    /**
     * API endpoints specific to ingestions
     * @type {Object}
     * @namespace ikats.api.ingest
     */
    ingest: {}
  }
};

/**
 * Ikats global constants
 **********************************************************************************************************************/
// Root address of the common Ikats API to connect to
ikats.constants.tomee_addr = "127.0.0.1:8081";
ikats.constants.gunicorn_addr = "127.0.0.1:8000";
ikats.constants.tomcat_addr = "127.0.0.1:8080";
ikats.constants.opentsdb_addr = "127.0.0.1:4242";

ikats.constants.URL_Ingestion = "http://" + ikats.constants.tomee_addr + "/ikats-ingestion/api";
ikats.constants.URL_TDM = "http://" + ikats.constants.tomcat_addr + "/TemporalDataManagerWebApp/webapi";
ikats.constants.URL_OpenTSDB = "http://" + ikats.constants.opentsdb_addr;
ikats.constants.URL_Algo = "http://" + ikats.constants.gunicorn_addr + "/ikats/algo";

// Simulations of results instead of using the real call
ikats.constants.simulate_family = false;
ikats.constants.simulate_smartconnectors = true;
ikats.constants.simulate_implementations = false;
ikats.constants.simulate_implementation = false;
ikats.constants.simulate_algorithms = false;


/**
 * Ikats common functions
 */

/**
 * Results template with default values
 * @constructor
 *
 * @typedef {ikats.common.results}
 *
 * @property {boolean} status true to indicate success, false otherwise
 * @property {string} status_msg short message associated to this status
 * @property {?*} debug debug information (free field)
 * @property {?*} data functional result if the endpoint shall return something
 */
ikats.common.results = function() {
  this.status = false;
  this.status_msg = "Internal Error, see log for details";
  this.debug = null;
  this.data = null;
  this.xhr = this.debug;
};
/**
 * Return results only if in sync mode.
 * If async mode, return the promise if defined.
 *
 * @param {*} result result to return
 * @param {boolean} async define what to return depending on the sync mode
 * @param {?Object=} promise promise to return (if defined)
 * @return {*}
 */
ikats.common.async_results_builder = function(result, async, promise) {

  if (!async) {
    return result;
  }
  if (promise) {
    return promise;
  }
  return null;
};
/**
 * Merge fields of object <p_from> to <p_to>
 *
 * @param {Object} p_from Original object
 * @param {Object} p_to Merged Object
 *
 * @return {Object} Merged Object
 */
ikats.common.merge_params = function(p_from, p_to) {

  if (p_from !== undefined) {

    // Backup the count of parameters to be compared after merge
    const p_to_org_keys = Object.keys(p_to);

    if (typeof(p_from) === "object") {
      for (let property_name in p_from) {
        if (p_from.hasOwnProperty(property_name)) {
          p_to[property_name] = p_from[property_name];
        }
      }
    } else {
      console.group();
      console.error("Expecting object instead of:");
      console.error(p_from);
      console.groupEnd();
    }

    // Keys after merge
    const p_to_final_keys = Object.keys(p_to);
    if (p_to_final_keys.length !== p_to_org_keys.length) {
      const useless_params = [];
      for (let i = 0; i < p_to_final_keys.length; i++) {
        if (p_to_org_keys.indexOf(p_to_final_keys[i]) === -1) {
          useless_params.push(p_to_final_keys[i]);
        }
      }
      console.error("Expecting object instead of:", p_to);
      console.warn("Unexpected extra key(s) during merge: " + useless_params.sort()
        .join(", "));
    }
  }
  return p_to;
};
/**
 * Call the callback <f> (if defined) with <data> as parameter
 *
 * @param {?function} f Function to call
 * @param {*} data Result to provide to function
 */
ikats.common.callback = function(f, data) {
  if (typeof(f) === "function") {
    f(data);
  }
};
/**
 * Generic "error" case management to call the callback after setting the result
 *
 * @param {*} result Result to check
 * @param {xhr} xhr XHR to use for debug
 * @param {Object} param Parameters containing the callbacks to select
 *
 * @return {ikats.common.results} returned result
 */
ikats.common.trigger_error_callback = function(result, xhr, param) {

  // Set xhr request as debug information
  result.debug = xhr;
  result.xhr = xhr;

  switch (xhr.status) {
    case 400:
      result.status = false;
      result.status_msg = "Error in parameters";
      result.data = [];
      break;
    case 404:
      result.status = true;
      result.status_msg = "No result";
      result.data = [];
      ikats.common.callback(param.success, result);
      return result;
    default:
      // Set the results to false (error occurred)
      result.status = false;

      // The HTTP message will be enough explicit to be understood
      result.status_msg = xhr.statusText;

      // If any message appear in body, use it as data (and test if its JSON can be parsed)
      try {
        result.data = xhr.responseJSON;
      } catch (e) {
        result.data = xhr.responseText;
      }
  }


  // Trigger the callback if defined
  ikats.common.callback(param.error, result);
  return result;
};
/**
 * Generic "complete" case management to call the callback after setting the result
 *
 * @param {*} result Result to check
 * @param {xhr} xhr XHR to use for debug
 * @param {Object} param Parameters containing the callbacks to select
 *
 * @return {ikats.common.results} returned result
 */
ikats.common.trigger_complete_callback = function(result, xhr, param) {

  // Set xhr request as debug information
  result.debug = xhr;
  result.xhr = xhr;

  // Trigger the callback if defined
  ikats.common.callback(param.complete, result);

  return result;
};
/**
 * Check at least one callback is set if async mode is enabled
 * returns true if check is OK, false otherwise
 *
 * @param {Object} param Parameters containing the callbacks to select
 * @return {boolean} False if an error occurred
 */
ikats.common.async_check = function(param) {
  if (param.async === true && (param.success === null && param.error === null &&
      param.complete === null)) {
    console.error("At least one callback must be defined");
    return false;
  }

  if (param.async === false && (param.success !== null || param.error !==
      null || param.complete !== null)) {
    console.warn(
      "Callbacks are defined but async mode is not enabled. This is useless"
    );
  }

  return true;
};
/**
 * Create the minimum default parameters for all ikats api endpoint
 * There can be any other field in this structure (specific to the need)
 *
 * @typedef {} ikats.common.default_params
 *
 * @property {boolean} async Asynchronous request if true, synchronous otherwise
 * @property {?function} success Callback for successful operation (2XX HTTP statuses)
 * @property {?function} error Callback for error operation (4XX or 5XX  HTTP statuses)
 * @property {?function} complete Callback for any operation (called after success and error)
 *
 * @return {ikats.common.results} returned result
 */
ikats.common.default_params = function() {
  this.async = false;
  this.success = null;
  this.error = null;
  this.complete = null;
};

/**
 * Ikats API
 * =========
 *
 * Common parameters:
 * ~~~~~~~~~~~~~~~~~~
 *    For some end points, there is common parameters. Here is a description about them
 *    - async: The call to the API can be blocking (synchronous) or not (asynchronous). The async mode allow the user to
 *             do other actions while this one is running.
 *             Once this action is done, the method will call the corresponding callbacks (success, error, complete)
 *    - success: Only in async mode. This callback is called when Ikats REST API returns a HTTP status code 2XX
 *               The parameters of the callback are:
 *               - The HTTP xhr object
 *               - The result (body)
 *    - error: Only in async mode. This callback is called when Ikats REST API returns a HTTP status code 4XX or 5XX
 *             The parameters of the callback is:
 *             - The HTTP xhr object
 *    - complete: Only in async mode. This optional callback is called every time after success or error.
 *                The parameters of the callback is:
 *                - The HTTP xhr object
 *
 *
 * Returned value:
 * ~~~~~~~~~~~~~~~
 *    All end points provide a generic returned object composed of:
 *    - status: boolean indicating if the method has failed (false) or not (true)
 *    - status_msg: message associated to the status
 *    - debug: debug information (ex: the complete HTTP xhr object)
 *    - data: the functional data to be used by caller (specific to each method)
 *
 *
 * End points breakdown:
 * ~~~~~~~~~~~~~~~~~~~~~
 *
 *    ikats.api
 *    +--> ds             Dataset management
 *    |    +--> list          List all dataset
 *    |    +--> create        Create a dataset
 *    |    +--> read          Get details about dataset
 *    |    +--> del           Delete a dataset
 *    +--> md             MetaData management
 *    |    +--> create        Create a metadata for a tsuid
 *    |    +--> read          Get all metadata for a tsuid
 *    |    +--> update        Update a metadata for a tsuid
 *    |    +--> del           Delete a metadata for a tsuid
 *    |    +--> types         List all metadata name and types
 *    +--> ts             Timeseries management
 *    |    +--> filter        Filter a tsuid list using criteria based on the metadata
 *    |    +--> fid           Get functional id for a tsuid list
 *    |    +--> read          Get the content (data points) of a TSUID
 *    +--> wf             Workflow management
 *    |    +--> list          List all saved workflow
 *    |    +--> save          Save a new workflow
 *    |    +--> load          Load a saved workflow
 *    |    +--> del           Delete a saved workflow
 *    |    +--> smartconn     Get the list of smart connectors
 *    +--> families       Family management
 *    |    +--> list          List all available families (categories)
 *    +--> algorithm      Algorithm management
 *    |    +--> list          List all available algorithms (categories)
 *    +--> op             Operators management
 *    |    +--> list          List all operators implementation (catalog)
 *    |    +--> read          Read details about an operator
 *    |    +--> status        Get execution status of an operator
 *    |    +--> run           Run an operator
 *    +--> table          Tables management
 *         +--> create        create a table
 *         +--> read          Read a saved table
 *
 */

/**
 * DATASET
 */
/**
 * Get the list of all existing dataset names and their corresponding description
 *
 * @param {ikats.common.default_params=} p_args Complex object (see ikats.common.default_params for common parameters)
 *                          * sort: set to true to sort dataset alphabetically
 * @return {ikats.common.results}
 *       results.data is an array of object containing
 *       - name: name of the dataset
 *       - desc: description of the dataset
 *       - count: number of TS in dataset
 */

ikats.api.ds.list = function(p_args) {
  // Default returned result
  const result = new ikats.common.results();

  // Default parameters
  let p = new ikats.common.default_params();
  p.sort = true; // Sort data

  // Merging with p_args
  p = ikats.common.merge_params(p_args, p);

  // Check missing mandatory parameters
  if (ikats.common.async_check(p) === false) {
    return result;
  }

  // Fire request
  // (STUB) Dataset with size -> change path (after demo) to not have size=true
  const promise = $.ajax({
    type: "GET",
    url: ikats.constants.URL_TDM + "/dataset?size=true",
    async: p.async,

    /**
     * Summary information about a dataset
     *
     * @typedef {Object} dataset_summary_item
     * @property {string} name name of the dataset
     * @property {string} description description of the dataset
     * @property {number} nb_ts Number of TS composing the dataset
     */

    /**
     * @callback ikats_api_ds_list_callback
     *
     * @param {dataset_summary_item[]} data
     * @param {string} txt_status
     * @param {xhr} xhr
     *
     * @return {ikats.common.results|ikats.api.op.results} returned result
     */
    success: function(data, txt_status, xhr) {
      result.status = true;
      result.status_msg = xhr.statusText;
      result.debug = xhr;
      result.data = [];
      let i;
      for (i = 0; i < data.length; i++) {
        result.data.push({
          name: data[i].name,
          desc: data[i].description,
          count: data[i].nb_ts
        });
      }
      if (p.sort) {
        result.data.sort(function(a, b) {
          return a.name.localeCompare(b.name);
        });
      }
      // Trigger the callback if defined
      ikats.common.callback(p.success, result);
      return result;
    },
    error: function(xhr) {
      return ikats.common.trigger_error_callback(result, xhr, p);
    },
    complete: function(xhr) {
      return ikats.common.trigger_complete_callback(result, xhr, p);
    }
  });

  return ikats.common.async_results_builder(result, p.async, promise);

};
/**
 * Create a new dataset
 *
 *   @param {ikats.common.default_params=} p_args (see ikats.common.default_params for common parameters)
 *       * name: Dataset name (mandatory)
 *       * desc: Dataset Description (mandatory)
 *       * ts_list: TS to link to the dataset (mandatory)
 *
 *   @return {ikats.common.results=} (see ikats.common.results for common results)
 *       results.data indicates "Import successful : dataset stored with id <name of the DS created>"
 */
ikats.api.ds.create = function(p_args) {

  // Default returned result
  const result = new ikats.common.results();

  // Default parameters
  let p = new ikats.common.default_params();
  p.name = null; // Dataset Name (mandatory)
  p.desc = null; // Dataset Description (mandatory)
  p.ts_list = []; // TS to link to the dataset (mandatory)

  // Merging with p_args
  p = ikats.common.merge_params(p_args, p);

  // Check missing mandatory parameters
  if (p.name === null) {
    console.error("ds_name must be filled");
    // Trigger the callback if defined
    ikats.common.callback(p.error, result);
    return result;
  }
  if (p.desc === null) {
    console.error("ds_desc must be filled");
    // Trigger the callback if defined
    ikats.common.callback(p.error, result);
    return result;
  }
  if (p.ts_list === []) {
    console.error("ts_list must be filled");
    // Trigger the callback if defined
    ikats.common.callback(p.error, result);
    return result;
  }
  if (ikats.common.async_check(p) === false) {
    return result;
  }

  const data = {
    "name": p.name,
    "description": p.desc,
    "tsuidList": p.ts_list.join(",")
  };

  // Fire request
  const promise = $.ajax({
    type: "POST",
    url: ikats.constants.URL_TDM + "/dataset/import/" + p.name,
    data: data,
    async: p.async,
    dataType: "text",
    success: function(data, txt_status, xhr) {
      /**
       * Argument data is a string containing:
       * "Import successful : dataset stored with id <ds_name>"
       */
      result.status = true;
      result.status_msg = xhr.statusText;
      result.debug = xhr;
      result.data = data;
      // Trigger the callback if defined
      ikats.common.callback(p.success, result);
      return result;
    },
    error: function(xhr) {
      return ikats.common.trigger_error_callback(result, xhr, p);
    },
    complete: function(xhr) {
      return ikats.common.trigger_complete_callback(result, xhr, p);
    }
  });

  return ikats.common.async_results_builder(result, p.async, promise);
};
/**
 * Get the content of a dataset
 * If string is entered instead of complex object,
 * the method will assume this is the name of the dataset to read
 *
 *   @param {(ikats.common.default_params|string)} p_args (see ikats.common.default_params for common parameters)
 *   @param {string} p_args.ds_name Dataset Name (mandatory)
 *   @param {string} p_args.prefix Prefix to use for unknown FID
 *
 *
 *   @return {ikats.common.results}
 *       results.data is an object composed of
 *       - name: name of the dataset
 *       - desc: description of the dataset
 *       - ts_list: an array of objects:
 *            - tsuid: name of the TSUID
 *            - funcId: functional identifier of the TSUID
 *
 */
ikats.api.ds.read = function(p_args) {

  // Default returned result
  const result = new ikats.common.results();

  // Default parameters
  let p = new ikats.common.default_params();
  p.ds_name = null; // Dataset Name (mandatory)
  p.prefix = "NOFID_"; // Prefix to use for unknown FID

  // Simple mode, if string is entered instead of complex object,
  // assume this is the name of the dataset to read
  if (typeof(p_args) === "string") {
    const temp_args = new ikats.common.default_params();
    temp_args.ds_name = p_args;
    p_args = temp_args;
  }

  // Merging with p_args
  p = ikats.common.merge_params(p_args, p);


  // Check missing mandatory parameters
  if (p.ds_name === null) {
    console.error("ds_name must be filled");
    // Trigger the callback if defined
    ikats.common.callback(p.error, result);
    return result;
  }
  if (ikats.common.async_check(p) === false) {
    return result;
  }


  /**
   * TS_List
   *
   * @typedef {Array} ts_list
   * @property {string} funcId Functional Id
   * @property {string} tsuid TSUID,
   */
  const promise = $.ajax({
    type: "GET",
    url: ikats.constants.URL_TDM + "/dataset/" + p.ds_name,
    async: p.async,

    /**
     * Complete information about a dataset
     *
     * @callback ikats_api_ds_read_callback
     *
     * @typedef {Object} dataset_complete_item
     * @property {string} name name of the dataset
     * @property {string} description description of the dataset
     * @property {ts_list} fids not used
     */
    success: function(data, txt_status, xhr) {
      /**
       * Argument data is an object containing:
       * - name: name of the dataset
       * - description: description of the dataset
       * - fids: array of objects where each object contains:
       *    - funcId: Functional identifier
       *    - tsuid: TS unique identifier
       * - tsuidsAsString: array of tsuids
       */
      result.status = true;
      result.status_msg = xhr.statusText;
      result.debug = xhr;
      result.data = {
        name: p.ds_name,
        desc: data.description,
        ts_list: data.fids
      };
      // Trigger the callback if defined
      ikats.common.callback(p.success, result);
      return result;
    },
    error: function(xhr) {
      return ikats.common.trigger_error_callback(result, xhr, p);
    },
    complete: function(xhr) {
      return ikats.common.trigger_complete_callback(result, xhr, p);
    }
  });

  return ikats.common.async_results_builder(result, p.async, promise);
};
/**
 * Delete a dataset (WITHOUT CONFIRMATION)
 * If string is entered instead of complex object,
 * the method will assume this is the name of the dataset name to remove
 *
 *   @param {ikats.common.default_params|string=} p_args (see ikats.common.default_params for common parameters)
 *   @param {string} p_args.ds_name Dataset Name (mandatory)
 *   @param {?string=} p_args.deep Dataset deep deletion mode (optional: default is false)
 *               note: when true: once the dataset is deleted, the server will find ever
 *               TS+metadata previously under this dataset, and having no other parent dataset:
 *               each TS and associated metadata are then deleted
 *
 *   @return {ikats.common.results}
 *       results.data contains nothing
 */
ikats.api.ds.del = function(p_args) {

  // Default returned result
  const result = new ikats.common.results();

  // Default parameters
  let p = new ikats.common.default_params();
  p.ds_name = null; // Dataset Name (mandatory)
  p.deep = false; // Dataset deep deletion mode (optional: default is false)
  // note: when true: once the dataset is deleted, the server will find ever
  // TS+metadata previously under this dataset, and having no other parent dataset:
  // each TS and associated metadata are then deleted

  // Simple mode, if string is entered instead of complex object,
  // assume this is the name of the dataset name to remove
  if (typeof(p_args) === "string") {
    const temp_args = new ikats.common.default_params();
    temp_args.ds_name = p_args;
    p_args = temp_args;
  }

  // Merging with p_args
  p = ikats.common.merge_params(p_args, p);

  // Check missing mandatory parameters
  if (p.ds_name === null) {
    console.error("ds_name must be filled");
    // Trigger the callback if defined
    ikats.common.callback(p.error, result);
    return result;
  }
  if (ikats.common.async_check(p) === false) {
    return result;
  }

  // Fire request
  const promise = $.ajax({
    type: "DELETE",
    url: ikats.constants.URL_TDM + "/dataset/" + p.ds_name + "/?deep=" + p.deep,
    async: p.async,
    success: function(data, txt_status, xhr) {
      /**
       * Argument data is an empty string
       */

      result.status = true;
      result.status_msg = xhr.statusText;
      result.debug = xhr;
      result.data = data;
      // Trigger the callback if defined
      ikats.common.callback(p.success, result);
      return result;
    },
    error: function(xhr) {
      return ikats.common.trigger_error_callback(result, xhr, p);
    },
    complete: function(xhr) {
      return ikats.common.trigger_complete_callback(result, xhr, p);
    }
  });

  return ikats.common.async_results_builder(result, p.async, promise);
};

/**
 * METADATA
 */
/**
 * Create a metadata for a TSUID
 *
 *   @param {ikats.common.default_params} p_args (see ikats.common.default_params for common parameters)
 *       * tsuid: TS Id (mandatory)
 *       * name: Metadata Name (mandatory)
 *       * value: Metadata value (mandatory)
 *       * dtype: Metadata type (mandatory). Must be one one of 'number', 'string', 'bool', 'complex'
 *
 *   @return {ikats.common.results}
 *       results.data is the unique id corresponding to the created metadata
 */
ikats.api.md.create = function(p_args) {

  //Type of the metadata
  const allowed_dtype = ["number", "string", "bool", "complex"];

  // Default returned result
  const result = new ikats.common.results();

  // Default parameters
  let p = new ikats.common.default_params();
  p.tsuid = null; // TS Id (mandatory)
  p.name = null; // Metadata Name (mandatory)
  p.value = null; // Metadata value (mandatory)
  p.dtype = null; // Metadata type (mandatory). Must be one one of 'number', 'string', 'bool', 'complex'

  // Merging with p_args
  p = ikats.common.merge_params(p_args, p);

  // Check missing mandatory parameters
  if (p.tsuid === null) {
    console.error("tsuid must be filled");
    // Trigger the callback if defined
    ikats.common.callback(p.error, result);
    return result;
  }
  if (p.name === null) {
    console.error("name must be filled");
    // Trigger the callback if defined
    ikats.common.callback(p.error, result);
    return result;
  }
  if (p.value === null) {
    console.error("name must be filled");
    // Trigger the callback if defined
    ikats.common.callback(p.error, result);
    return result;
  }
  if (p.dtype === null) {
    console.error("dtype must be filled");
    // Trigger the callback if defined
    ikats.common.callback(p.error, result);
    return result;
  }
  if (allowed_dtype.indexOf(p.dtype) === -1) {
    console.error(
      "dtype must be one one of 'number', 'string', 'bool', 'complex'");
    console.error("got " + p.dtype);
    // Trigger the callback if defined
    ikats.common.callback(p.error, result);
    return result;
  }
  if (ikats.common.async_check(p) === false) {
    return result;
  }

  // Fire request
  const promise = $.ajax({
    type: "POST",
    url: ikats.constants.URL_TDM + "/metadata/import/" + p.tsuid + "/" + p.name + "/" + p.value,
    async: p.async,
    contentType: 'application/json',
    success: function(data, txt_status, xhr) {
      /**
       * Argument data contains the id of the created metadata as raw text
       */

      result.status = true;
      result.status_msg = xhr.statusText;
      result.debug = xhr;
      result.data = data;
      // Trigger the callback if defined
      ikats.common.callback(p.success, result);
      return result;
    },
    error: function(xhr) {
      return ikats.common.trigger_error_callback(result, xhr, p);
    },
    complete: function(xhr) {
      return ikats.common.trigger_complete_callback(result, xhr, p);
    }
  });

  return ikats.common.async_results_builder(result, p.async, promise);
};
/**
 * Get the metadata of a TS
 * If array is entered instead of complex object,
 * the method will assume this is the name of the tsuids to get metadata from
 * If omitted, get all the metadata for all referenced TS
 *
 *   @param {ikats.common.default_params|Array=} p_args (see ikats.common.default_params for common parameters)
 *   @param {string[]} p_args.ts_list array of TSUID to get MD from
 *
 *
 *   @return {ikats.common.results}
 *       results.data is an array of metadata. Each item is an object containing:
 *       - dtype: type of the metadata
 *       - id: unique id of the metadata
 *       - name: name of the metadata
 *       - tsuid: tsuid that metadata belongs to
 *       - value: value of the metadata
 */
ikats.api.md.read = function(p_args) {

  // Default returned result
  const result = new ikats.common.results();

  // Default parameters
  let p = new ikats.common.default_params();
  p.ts_list = null; // TS to get MD from (mandatory)

  // Simple mode, if array is entered instead of complex object,
  // assume this is the name of the tsuid list to get metadata from
  if (isArray(p_args)) {
    const temp_args = new ikats.common.default_params();
    temp_args.ts_list = p_args;
    p_args = temp_args;
  }

  // Merging with p_args
  p = ikats.common.merge_params(p_args, p);

  // Check missing mandatory parameters
  if (!isArray(p.ts_list) || p.ts_list.length === 0) {
    console.error("ts_list must be an array composed of at least 1 TS");
    // Trigger the callback if defined
    ikats.common.callback(p.error, result);
    return result;
  }
  if (ikats.common.async_check(p) === false) {
    return result;
  }

  // Try to remove extra fields in case of array of objects
  if (p.ts_list[0].tsuid !== undefined) {
    try {
      p.ts_list = p.ts_list.map(function(x) {
        return x.tsuid;
      });
    } catch (e) {
      // No action, the ts_list is probably well formatted
      console.debug(p.ts_list);
    }
  }

  // Fire request
  const promise = $.ajax({
    type: "POST",
    url: ikats.constants.URL_TDM + "/metadata/list/json",
    data: JSON.stringify({
      tsuids: p.ts_list
    }),
    contentType: "application/json",
    async: p.async,
    success: function(data, txt_status, xhr) {
      /**
       * Argument data is an array of metadata. Each item is an object containing:
       * - dtype: type of the metadata
       * - id: unique id of the metadata
       * - name: name of the metadata
       * - tsuid: tsuid that metadata belongs to
       * - value: value of the metadata
       */
      result.status = true;
      result.status_msg = xhr.statusText;
      result.debug = xhr;
      result.data = data;
      // Trigger the callback if defined
      ikats.common.callback(p.success, result);
      return result;
    },
    error: function(xhr) {
      return ikats.common.trigger_error_callback(result, xhr, p);
    },
    complete: function(xhr) {
      return ikats.common.trigger_complete_callback(result, xhr, p);
    }
  });
  return ikats.common.async_results_builder(result, p.async, promise);
};
/**
 * Update a metadata (NO CONFIRMATION)
 *
 *   @param {ikats.common.default_params} p_args (see ikats.common.default_params for common parameters)
 *       * tsuid: TS Id (mandatory)
 *       * name: Metadata Name (mandatory)
 *       * value: Metadata value (mandatory)
 *       * prefix: Prefix to use for unknown FID
 *
 *   @return {ikats.common.results}
 *       results.data is the unique id corresponding to the updated metadata
 */
ikats.api.md.update = function(p_args) {

  // Default returned result
  const result = new ikats.common.results();

  // Default parameters
  let p = new ikats.common.default_params();
  p.tsuid = null; // TS Id (mandatory)
  p.name = null; // Metadata Name (mandatory)
  p.value = null; // Metadata value (mandatory)
  p.prefix = "NOFID_"; // Prefix to use for unknown FID

  // Merging with p_args
  p = ikats.common.merge_params(p_args, p);

  // Check missing mandatory parameters
  if (p.tsuid === null) {
    console.error("tsuid must be filled");
    // Trigger the callback if defined
    ikats.common.callback(p.error, result);
    return result;
  }
  if (p.name === null) {
    console.error("name must be filled");
    // Trigger the callback if defined
    ikats.common.callback(p.error, result);
    return result;
  }
  if (p.value === null) {
    console.error("name must be filled");
    // Trigger the callback if defined
    ikats.common.callback(p.error, result);
    return result;
  }
  if (ikats.common.async_check(p) === false) {
    return result;
  }

  // Fire request
  const promise = $.ajax({
    type: "PUT",
    url: ikats.constants.URL_TDM + "/metadata/" + p.tsuid + "/" + p.name + "/" + p.value,
    async: p.async,
    success: function(data, txt_status, xhr) {
      /**
       * Argument data contains the id of the updated metadata as raw text
       */
      result.status = true;
      result.status_msg = xhr.statusText;
      result.debug = xhr;
      result.data = data;
      // Trigger the callback if defined
      ikats.common.callback(p.success, result);
      return result;
    },
    error: function(xhr) {
      return ikats.common.trigger_error_callback(result, xhr, p);
    },
    complete: function(xhr) {
      return ikats.common.trigger_complete_callback(result, xhr, p);
    }
  });

  return ikats.common.async_results_builder(result, p.async, promise);
};
/**
 * Delete a metadata (WITHOUT CONFIRMATION)
 *
 *   @param {ikats.common.default_params} p_args (see ikats.common.default_params for common parameters)
 *       * tsuid: TS Id (mandatory)
 *       * name: Metadata Name (mandatory)
 *
 *
 *   @return {ikats.common.results}
 *       results.data is the msg "X metadata removed for tsuid <TSUID>"
 */
ikats.api.md.del = function(p_args) {
  // Default returned result
  const result = new ikats.common.results();

  // Default parameters
  let p = new ikats.common.default_params();
  p.tsuid = null; // TS Id (mandatory)
  p.name = null; // Metadata Name (mandatory)

  // Merging with p_args
  p = ikats.common.merge_params(p_args, p);


  // Check missing mandatory parameters
  if (p.tsuid === null) {
    console.error("tsuid must be filled");
    // Trigger the callback if defined
    ikats.common.callback(p.error, result);
    return result;
  }
  if (p.name === null) {
    console.error("name must be filled");
    // Trigger the callback if defined
    ikats.common.callback(p.error, result);

    return result;
  }
  if (ikats.common.async_check(p) === false) {
    return result;
  }

  // Fire request
  const promise = $.ajax({
    type: "DELETE",
    url: ikats.constants.URL_TDM + "/metadata/" + p.tsuid + "/" + p.name,
    async: p.async,
    success: function(data, txt_status, xhr) {
      /**
       * Argument data returns a JSON containing:
       * - endDate : 0
       * - errors: {}
       * - funcId: null
       * - numberOfSuccess: 1
       * - startDate: 0
       * - summary: ""
       * - tsuid: ""
       */
      result.status = true;
      result.status_msg = xhr.statusText;
      result.debug = xhr;
      result.data = data.summary;
      // Trigger the callback if defined
      ikats.common.callback(p.success, result);
      return result;
    },
    error: function(xhr) {
      return ikats.common.trigger_error_callback(result, xhr, p);
    },
    complete: function(xhr) {
      return ikats.common.trigger_complete_callback(result, xhr, p);
    }
  });

  return ikats.common.async_results_builder(result, p.async, promise);
};
/**
 * Lists all couples name|type of metadata
 *
 *   @return {ikats.common.results}
 *       results.data is an array composed by key/value couples as key="name of the metadata" and value="type of the metadata"
 */
ikats.api.md.types = function(p_args) {
  // Default returned result
  const result = new ikats.common.results();

  // Default parameters
  let p = new ikats.common.default_params();

  // Merging with p_args
  p = ikats.common.merge_params(p_args, p);

  if (ikats.common.async_check(p) === false) {
    return result;
  }

  // Fire request
  const promise = $.ajax({
    type: "GET",
    url: ikats.constants.URL_TDM + "/metadata/types",
    async: p.async,
    success: function(data, txt_status, xhr) {
      /**
       * Argument data returns a JSON array containing a list of:
       * {'metadataname':'metadatatype'}
       */
      result.status = true;
      result.status_msg = xhr.statusText;
      result.debug = xhr;
      result.data = data;
      // Trigger the callback if defined
      ikats.common.callback(p.success, result);
      return result;
    },
    error: function(xhr) {
      return ikats.common.trigger_error_callback(result, xhr, p);
    },
    complete: function(xhr) {
      return ikats.common.trigger_complete_callback(result, xhr, p);
    }
  });
  return ikats.common.async_results_builder(result, p.async, promise);
};

/**
 * Import metadata from file being uploaded
 *
 *   @param {ikats.common.default_params} p_args (see ikats.common.default_params for common parameters)
 *       * fileContent: CSV file to import (mandatory)
 *       * update: Update existing metadata or not
 *       * details: Provide details on result
 *
 *   @return {ikats.common.results}
 *       results.data is the unique id corresponding to the created metadata
 */
ikats.api.md.importFromFile = function(p_args) {

  // Default returned result
  const result = new ikats.common.results();

  // Default parameters
  let p = new ikats.common.default_params();
  p.fileContent = null; // CSV file to import (mandatory)
  p.updateFlag = false; // Update existing metadata or not
  p.details = false; // Provide details on result

  // Merging with p_args
  p = ikats.common.merge_params(p_args, p);

  // Appending file content
  const formData = new FormData();
  formData.append("file", new File([p.fileContent], "MD_content.csv"));

  // Fire request
  const promise = $.ajax({
    type: "POST",
    url: ikats.constants.URL_TDM + "/metadata/import/file?update=" + p.updateFlag + "&details=" + p.details,
    data: formData,
    contentType: false, // Prevent jQuery from using "multipart/form-data" without boundary
    processData: false, // Tell JQuery to not convert formData to string
    async: p.async,
    success: function(data, txt_status, xhr) {
      /**
       * Argument data contains the id of the created metadata as raw text
       */

      result.status = true;
      result.status_msg = xhr.statusText;
      result.debug = xhr;
      result.xhr = xhr;
      result.data = data;
      // Trigger the callback if defined
      ikats.common.callback(p.success, result);
      return result;
    },
    error: function(xhr) {
      return ikats.common.trigger_error_callback(result, xhr, p);
    },
    complete: function(xhr) {
      return ikats.common.trigger_complete_callback(result, xhr, p);
    }
  });

  return ikats.common.async_results_builder(result, p.async, promise);
};


/**
 * TIMESERIES
 */
/**
 * Filter a TS list based on criteria
 * If no criteria are provided, return the complete list of TS in database
 *
 *   @param {ikats.common.default_params} p_args (see ikats.common.default_params for common parameters)
 *       * ts_list: TS list to apply filter on (mandatory if criteria provided)
 *            Each element is an object composed of:
 *            - tsuid: TS identifier
 *            - funcId: Functional identifier of the TS
 *       * criteria: Criteria array to use (boolean AND operator between all items in array)
 *            Each item is composed of:
 *            - meta_name: name of the metadata
 *            - comparator: comparator
 *            - value: reference value used for comparison
 *
 *   @return {ikats.common.results}
 *       results.data is an array of object containing the TS matching the criteria
 *            - tsuid: TS identifier
 *            - funcId: Functional identifier of the TS
 */
ikats.api.ts.list = function(p_args) {
  // Default returned result
  const result = new ikats.common.results();

  // Default parameters
  let p = new ikats.common.default_params();
  p.ts_list = null; // TS list to apply filter on (mandatory if criteria provided)
  p.ds_name = null; // dataset name (exclusive with TS list)
  p.criteria = null; // Criteria array to use

  // Merging with p_args
  p = ikats.common.merge_params(p_args, p);

  // Check missing mandatory parameters
  if (ikats.common.async_check(p) === false) {
    return result;
  }

  // Handle bad criteria
  for (let i = p.criteria.length - 1; i >= 0; i--) {
    if (JSON.stringify(p.criteria[i]) === "{}") {
      // Empty criterion
      p.criteria.splice(i, 1);
    } else {
      if ((p.criteria[i].meta_name === "") ||
        (p.criteria[i].comparator === "") ||
        (p.criteria[i].value === "") ||
        (p.criteria[i].meta_name === null) ||
        (p.criteria[i].comparator === null) ||
        (p.criteria[i].value === null)) {
        // Criterion not completed
        p.criteria.splice(i, 1);
      }
    }
  }

  // If there is at least one criteria, use the filter method
  if (p.criteria.length > 0) {
    // Prepare data to send
    p.ts_list = p.ts_list.map(function(x) {
      return {
        tsuid: x.tsuid,
        funcId: x.funcId
      };
    });
    p.criteria = p.criteria.map(function(x) {
      x.metadataName = x.meta_name;
      delete x.meta_name;
      return x;
    });
    const data = {
      datasetName: p.ds_name,
      tsList: p.ts_list,
      criteria: p.criteria
    };
    // Check missing mandatory parameters
    if (p.ts_list === null) {
      console.error("ts_list must be filled");
      // Trigger the callback if defined
      ikats.common.callback(p.error, result);
      return result;
    }

    // Fire request
    let promise = $.ajax({
      type: "POST",
      url: ikats.constants.URL_TDM + "/ts/",
      async: p.async,
      data: JSON.stringify(data),
      contentType: "application/json",
      success: function(data, txt_status, xhr) {
        /**
         * Argument data is an array of object containing the TS matching the criteria
         * - tsuid: TS identifier
         * - funcId: Functional identifier of the TS
         */
        result.status = true;
        result.status_msg = xhr.statusText;
        result.debug = xhr;
        result.data = data;
        // Trigger the callback if defined
        ikats.common.callback(p.success, result);
        return result;
      },
      error: function(xhr) {
        return ikats.common.trigger_error_callback(result, xhr, p);
      },
      complete: function(xhr) {
        return ikats.common.trigger_complete_callback(result, xhr, p);
      }
    });
  } else {
    // No criteria found, return all TS
    result.status = true;
    result.status_msg = "No criteria, returning inputs TS";
    result.data = {
      tsList: p.ts_list,
      criteria: p.criteria
    };
    // Trigger the callback if defined
    ikats.common.callback(p.success, result);
  }
  return ikats.common.async_results_builder(result, p.async, promise);
};
/**
 * Read points from a TS based on its TSUID and optional range
 *
 *   @param {ikats.common.default_params} p_args (see ikats.common.default_params for common parameters)
 *       * tsuid: TSUID to get (string)
 *       * sd: (optional) Start date (EPOCH ms format)
 *       * ed: (optional) End date (EPOCH ms format)
 *       * ag: (optional) aggregation method ('avg','min','max,'sd', 'avg' is default)
 *       * dp: (optional) downsampling period (in ms)
 *       * da: (optional) downsampling aggregation method (same as 'ag' parameter)
 *       * timeout: (optional) timeout for the request (in ms), 5 minutes by default
 *       * md: (optional) Metadata result (to not get it again)
 *
 *   @return {ikats.common.results}
 *       results.data is an object where
 *       - the key is timestamp (ms since EPOCH)
 *       - the value is the point value for every point
 */
ikats.api.ts.read = function(p_args) {

  // Default returned result
  const result = new ikats.common.results();

  // Default parameters
  let p = new ikats.common.default_params();
  p.tsuid = null; // TSUID to get points from (mandatory if criteria provided)
  p.ag = "avg";
  p.dp = null;
  p.da = null;
  p.sd = null;
  p.ed = null;
  p.timeout = 5 * 60 * 1000; // 5 minutes
  p.md = null;

  // Simple mode, if list is entered instead of complex object,
  // assume this is the tsuid_list to use
  if (typeof(p_args) === "string") {
    let temp_args = new ikats.common.default_params();
    temp_args.tsuid = p_args;
    p_args = temp_args;
  }

  // Merging with p_args
  p = ikats.common.merge_params(p_args, p);

  // Check missing mandatory parameters
  if (ikats.common.async_check(p) === false) {
    return result;
  }

  // Check missing mandatory parameters
  if (p.tsuid === null) {
    console.error("tsuid must be filled");
    // Trigger the callback if defined
    ikats.common.callback(p.error, result);
    return result;
  }

  // Read the meta data
  let md = p.md;
  if (md === null) {
    md = ikats.api.md.read([p.tsuid]).data;
  }

  let data = {
    // Set timestamps format to milliseconds
    ms: true,
    // Define start date
    start: $.grep(md, function(x) {
      return x.name === "ikats_start_date" && x.tsuid === p.tsuid;
    })[0].value,
    // Define end date
    end: $.grep(md, function(x) {
      return x.name === "ikats_end_date" && x.tsuid === p.tsuid;
    })[0].value
  };

  // Check if start date is overwritten
  if (p.sd) {
    try {
      data.start = parseInt(p.sd, 10);
      if (parseInt(p.sd, 10) < 0) {
        console.error("Wrong Start date value");
        return result;
      }
    } catch (e) {
      console.error("Wrong Start date format");
      return result;
    }
  }

  // Check if end date is overwritten
  if (p.ed) {
    try {
      data.end = parseInt(p.ed, 10);
      if (parseInt(p.ed, 10) < 0) {
        console.error("Wrong End date value");
        return result;
      }
    } catch (e) {
      console.error("Wrong End date format");
      return result;
    }

  }

  // Check that data has a time range (not equal to 0) [OpenTSDB constraint]
  if (data.start === data.end) {
    data.start = parseInt(data.start) - 1000;
    data.end = parseInt(data.start) + 1000;
  }

  // Downsampling information
  if (p.dp) {
    let ds = "avg";
    if (p.da) {
      ds = p.da;
    }
    data.dp = p.dp + "ms";
    data.tsuid = `${p.ag}:${p.dp}ms-${ds}:${p.tsuid}`;

  } else {
    data.tsuid = p.ag + ":" + p.tsuid;
  }

  // Building Query String
  const qs = "?" + jQuery.param(data);


  // Fire request
  let promise = $.ajax({
    type: "GET",
    url: ikats.constants.URL_OpenTSDB + "/api/query" + qs,
    async: p.async,
    contentType: "application/json",
    timeout: p.timeout,
    success: function(data, txt_status, xhr) {
      /**
       * Argument data is an array of object containing the TS matching the criteria
       * - tsuid: TS identifier
       * - funcId: Functional identifier of the TS
       */
      result.status = true;
      result.status_msg = xhr.statusText;
      result.debug = xhr;
      if (data[0]) {
        result.data = data[0].dps;
      } else {
        result.data = [];
      }
      // Trigger the callback if defined
      ikats.common.callback(p.success, result);

      return result;
    },
    error: function(xhr) {
      return ikats.common.trigger_error_callback(result, xhr, p);
    },
    complete: function(xhr) {
      return ikats.common.trigger_complete_callback(result, xhr, p);
    }
  });


  return ikats.common.async_results_builder(result, p.async, promise);
};

/**
 * Read points count from a TS based on its TSUID and range
 *
 *   @param {ikats.common.default_params} p_args (see ikats.common.default_params for common parameters)
 *       * tsuid: TSUID to get (string)
 *       * sd: Start date (EPOCH ms format)
 *       * ed: End date (EPOCH ms format)
 *       * timeout: (optional) timeout for the request (in ms), 5 minutes by default
 *
 *   @return {ikats.common.results}
 *       results.data contains the number of points in the range
 */
ikats.api.ts.nbPoints = function(p_args) {

  // Default returned result
  const result = new ikats.common.results();

  // Default parameters
  let p = new ikats.common.default_params();
  p.tsuid = null; // TSUID to get points from (mandatory if criteria provided)
  p.ag = "avg";
  p.sd = null;
  p.ed = null;
  p.timeout = 5 * 60 * 1000; // 5 minutes

  // Merging with p_args
  p = ikats.common.merge_params(p_args, p);

  // Check consistency mandatory parameters
  if (ikats.common.async_check(p) === false) {
    return result;
  }

  // Check missing mandatory parameters
  if (p.tsuid === null) {
    console.error("tsuid must be filled");
    // Trigger the callback if defined
    ikats.common.callback(p.error, result);
    return result;
  }

  // Prepare the parameters that will be sent as query parameters
  const data = {
    ms: true,
    start: 0
  };

  // Get the points between 0 and End date
  data.end = parseInt(p.ed, 10);
  data.tsuid = `sum:${data.end}ms-count:${p.tsuid}`;

  // Building Query String
  let qs = "?" + jQuery.param(data);

  // Fire request
  const promise = $.ajax({
    type: "GET",
    url: ikats.constants.URL_OpenTSDB + "/api/query" + qs,
    async: p.async,
    contentType: "application/json",
    timeout: p.timeout,
    success: function(d1) {

      // Now get the points between 0 and Start date
      const ed = parseInt(p.sd, 10);
      data.tsuid = `sum:${ed}ms-count:${p.tsuid}`;
      data.end = parseInt(p.sd, 10) - 1;

      // Building Query String
      let qs = "?" + jQuery.param(data);
      $.ajax({
        type: "GET",
        url: ikats.constants.URL_OpenTSDB + "/api/query" + qs,
        async: p.async,
        contentType: "application/json",
        timeout: p.timeout,
        success: function(d2, txt_status, xhr) {

          let delta = 0;
          if (d2.length) {
            for (let key in d2[0].dps) {
              delta -= parseInt(d2[0].dps[key], 10);
            }
          }
          if (d1.length) {
            for (let key in d1[0].dps) {
              delta += parseInt(d1[0].dps[key], 10);
            }
          }

          result.status = true;
          result.status_msg = xhr.statusText;
          result.debug = xhr;
          result.data = delta;
          return result;
        },
        error: function(xhr) {
          return ikats.common.trigger_error_callback(result, xhr,
            p);
        },
        complete: function(xhr) {
          return ikats.common.trigger_complete_callback(result,
            xhr, p);
        }
      });
    },
    error: function(xhr) {
      return ikats.common.trigger_error_callback(result, xhr, p);
    },
    complete: function(xhr) {
      return ikats.common.trigger_complete_callback(result, xhr, p);
    }
  });

  return ikats.common.async_results_builder(result, p.async, promise);


};
/**
 * Get the list of functional identifier for the tsuid_list
 * If array is entered instead of complex object,
 * the method will assume this is the tsuid_list to use
 *
 *   @param {ikats.common.default_params|Array=} p_args (see ikats.common.default_params for common parameters)
 *   @param {string[]} p_args.tsuid_listList of TSUID to get FID from (mandatory)
 *   @param {string} p_args.prefix Prefix to use for unknown FID
 *
 *   @return {ikats.common.results}
 *       results.data is an array of object containing the TS matching the criteria
 *            - tsuid: TS identifier
 *            - funcId: Functional identifier of the TS
 */
ikats.api.ts.fid = function(p_args) {

  // Default returned result
  const result = new ikats.common.results();

  // Default parameters
  let p = new ikats.common.default_params();
  p.tsuid_list = []; // List of TSUID to get FID from (mandatory)
  p.prefix = "NOFID_"; // Prefix to use for unknown FID

  // Simple mode, if list is entered instead of complex object,
  // assume this is the tsuid_list to use
  if (isArray(p_args)) {
    const temp_args = new ikats.common.default_params();
    temp_args.tsuid_list = p_args;
    p_args = temp_args;
  }

  // Merging with p_args
  p = ikats.common.merge_params(p_args, p);

  // Check missing mandatory parameters
  if (ikats.common.async_check(p) === false) {
    return result;
  }

  // Init of result with default values
  // The indexes match between p.tsuid_list[i] and result[i]
  // This will be used to get the fid field once we get result for a tsuid
  result.data = [];
  for (let i = 0; i < p.tsuid_list.length; i++) {
    result.data.push({
      tsuid: p.tsuid_list[i],
      funcId: p.prefix + p.tsuid_list[i]
    });
  }

  // Fire request
  const data = JSON.stringify({
    tsuids: p.tsuid_list
  });
  const promise = $.ajax({
    type: "POST",
    url: ikats.constants.URL_TDM + "/metadata/funcId/",
    data: data,
    async: p.async,
    contentType: "application/json",
    success: function(data, txt_status, xhr) {
      /**
       * Argument data is an array of object containing the TS information:
       * - tsuid: TS identifier
       * - funcId: Functional identifier of the TS
       */
      result.status = true;
      result.status_msg = xhr.statusText;
      result.debug = xhr;
      // nominal case
      if (p.tsuid_list.length > 0) {
        for (let i = 0; i < data.length; i++) {
          result.data[p.tsuid_list.indexOf(data[i].tsuid)].funcId = data[i].funcId;
        }
      } else {
        // used by TSfinder
        for (let i = 0; i < data.length; i++) {
          result.data.push({
            tsuid: data[i].tsuid,
            funcId: data[i].funcId
          });
        }
      }
      // Trigger the callback if defined
      ikats.common.callback(p.success, result);
      return result;
    },
    error: function(xhr) {
      return ikats.common.trigger_error_callback(result, xhr, p);
    },
    complete: function(xhr) {
      return ikats.common.trigger_complete_callback(result, xhr, p);
    }
  });

  return ikats.common.async_results_builder(result, p.async, promise);
};

/**
 * WORKFLOW
 */
/**
 * Get the smart connectors compatibility grid
 * returns an Object of valid connections
 *
 *   @param {ikats.common.default_params=} p_args (see ikats.common.default_params for common parameters)
 *
 *   @return {ikats.common.results}
 *       results.data is an object where each key (being the "from_type") contains
 *       a list of matching destination types
 *
 *       result.data = {
 *          from_type: [
 *              to_type_1,
 *              to_type_2,
 *              ...
 *          ]
 *       }
 */
ikats.api.wf.smartconn = function(p_args) {

  // Default returned result
  const result = new ikats.common.results();

  // Default parameters
  let p = new ikats.common.default_params();

  // Merging with p_args
  p = ikats.common.merge_params(p_args, p);

  // Check missing mandatory parameters
  if (ikats.common.async_check(p) === false) {
    return result;
  }

  // Handling Result Simulation while waiting for real call
  if (ikats.constants.simulate_smartconnectors) {
    const grid = {
      "ts_list": ["tsuid_list", "list", "number", "bool", "ts_selection"],
      "ds_name": ["ts_list", "text", "tsuid_list", "list", "number", "bool"],
      "ds_list": ["ts_list", "tsuid_list", "list", "number", "bool"],
      "tsuid_list": ["list", "number", "bool"],
      "list": ["number", "bool"],
      "percentage": ["number", "bool"],
      "number": ["bool"],
      "md_filter": ["ts_list", "tsuid_list", "list", "number", "bool"],
      "correlation_matrix": ["bool"],
      "ts_selection": ["ts_list"]
    };

    result.status = true;
    result.status_msg = "OK";
    result.debug = "Simulated Call";
    result.data = cloneObj(grid);

    // Trigger the callback if defined
    ikats.common.callback(p.success, result);
    return ikats.common.async_results_builder(result, p.async);
  }


  // Fire request
  const promise = $.ajax({
    type: "GET",
    url: ikats.constants.URL_Algo + "/smart_connectors",
    async: p.async,
    contentType: "application/json",
    success: function(data, txt_status, xhr) {
      /**
       * Argument data contains an array composed of objects:
       * - name: name of the family to display
       * - description: description of the family to display
       */
      //TODO Confirm returned content for smart connectors REST API

      result.status = true;
      result.status_msg = xhr.statusText;
      result.debug = xhr;
      result.data = data.map(function(x) {
        // Translate names
        x.desc = x.description;
        delete x.description;
        return x;
      });

      // Trigger the callback if defined
      ikats.common.callback(p.success, result);
      return result;
    },
    error: function(xhr) {
      return ikats.common.trigger_error_callback(result, xhr, p);
    },
    complete: function(xhr) {
      return ikats.common.trigger_complete_callback(result, xhr, p);
    }
  });

  return ikats.common.async_results_builder(result, p.async, promise);


};

/**
 * Workflow Description
 *
 * rawContent field may be absent from the data if retrieved as summarized list
 *
 * @typedef {{}} workflow
 * @property {number} id id of the workflow
 * @property {string} name Functional Name of the workflow
 * @property {string} description Description of the workflow
 * @property {string} rawContent content of the workflow
 */


/**
 * Get the list of workflow
 * returns a list of workflow id, name and description
 *
 *   @param {ikats.common.default_params=} p_args (see ikats.common.default_params for common parameters)
 *       * full: Boolean indicating if the full raw content must be pull or not (default: false)

 *   @return {ikats.common.results} Array of {@link workflow} for data field
 *
 */
ikats.api.wf.list = function(p_args) {

  // Default returned result
  const result = new ikats.common.results();

  // Default parameters
  let p = new ikats.common.default_params();
  p.full = false; // do not pull by default

  // Merging with p_args
  p = ikats.common.merge_params(p_args, p);

  // Check missing mandatory parameters
  if (ikats.common.async_check(p) === false) {
    return result;
  }

  // Setting full flag
  let full = "";
  if (p.full) {
    full = "&full=true";
  }

  // Fire request
  $.ajax({
    type: "GET",
    url: ikats.constants.URL_TDM + "/wf/" + full,
    async: p.async,
    contentType: "application/json",
    success: function(data, txt_status, xhr) {
      /**
       * Argument data is written using an array of {@link workflow}
       */
      result.status = true;
      result.status_msg = xhr.statusText;
      result.debug = xhr;
      result.data = data;
      // Trigger the callback if defined
      ikats.common.callback(p.success, result);

      return result;
    },
    error: function(xhr) {
      return ikats.common.trigger_error_callback(result, xhr, p);
    },
    complete: function(xhr) {
      return ikats.common.trigger_complete_callback(result, xhr, p);
    }
  });


  return ikats.common.async_results_builder(result, p.async);
};

/**
 * Get the list of macro operators
 * returns a list of macro operators id, name and description
 *
 *   @param {ikats.common.default_params=} p_args (see ikats.common.default_params for common parameters)
 *       * full: Boolean indicating if the full raw content must be pull or not (default: false)

 *   @return {ikats.common.results} Array of {@link workflow} for data field
 *
 */
ikats.api.mo.list = function(p_args) {

  // Default returned result
  const result = new ikats.common.results();

  // Default parameters
  let p = new ikats.common.default_params();
  p.full = false; // do not pull by default

  // Merging with p_args
  p = ikats.common.merge_params(p_args, p);

  // Check missing mandatory parameters
  if (ikats.common.async_check(p) === false) {
    return result;
  }

  // Setting full flag
  let full = "";
  if (p.full) {
    full = "&full=true";
  }

  // Fire request
  $.ajax({
    type: "GET",
    url: ikats.constants.URL_TDM + "/mo/" + full,
    async: p.async,
    contentType: "application/json",
    success: function(data, txt_status, xhr) {
      /**
       * Argument data is written using an array of {@link workflow}
       */
      result.status = true;
      result.status_msg = xhr.statusText;
      result.debug = xhr;
      result.data = data;
      // Trigger the callback if defined
      ikats.common.callback(p.success, result);

      return result;
    },
    error: function(xhr) {
      return ikats.common.trigger_error_callback(result, xhr, p);
    },
    complete: function(xhr) {
      return ikats.common.trigger_complete_callback(result, xhr, p);
    }
  });


  return ikats.common.async_results_builder(result, p.async);
};

/**
 * Save a workflow
 *
 *   @param {ikats.common.default_params} p_args (see ikats.common.default_params for common parameters)
 *       * name: Name of the workflow (mandatory)
 *       * desc: Text describing the workflow (mandatory)
 *       * data: object containing workflow details (mandatory)
 *       * id: (optional) Id of the workflow (for updating purposes)
 *
 *   @return {ikats.common.results}
 *       results.data has 2 fields:
 *       id: identifier of the workflow
 *       link: complete link to get the workflow content
 *
 */
ikats.api.wf.save = function(p_args) {

  // Default returned result
  const result = new ikats.common.results();

  // Default parameters
  let p = new ikats.common.default_params();
  p.name = null; // Name of the workflow (mandatory)
  p.description = null; // Text describing the workflow (mandatory)
  p.data = null; // object containing workflow details (mandatory)
  p.id = null; // Id of the workflow (if provided, an update will be performed)

  // Merging with p_args
  p = ikats.common.merge_params(p_args, p);

  // Check missing mandatory parameters
  if (p.name === null) {
    console.error("wf_name must be filled");
    // Trigger the callback if defined
    ikats.common.callback(p.error, result);
    return result;
  }
  if (p.id !== null && !isNumber(p.id)) {
    console.error("ID must be a number");
    // Trigger the callback if defined
    ikats.common.callback(p.error, result);
    return result;
  }
  if (ikats.common.async_check(p) === false) {
    return result;
  }

  const data = {
    name: p.name,
    description: p.description,
    raw: p.data
  };

  // Handle update mode
  let verb = "POST";
  let urlId = "";
  if (p.id) {
    verb = "PUT";
    data.id = p.id;
    urlId = p.id;
  }

  // Fire request
  $.ajax({
    type: verb,
    url: ikats.constants.URL_TDM + "/wf/" + urlId,
    async: p.async,
    data: JSON.stringify(data),
    contentType: "application/json",
    success: function(data, txt_status, xhr) {
      /**
       * Argument data contains nothing
       */

      result.status = true;
      result.status_msg = xhr.statusText;
      result.debug = xhr;
      const link = xhr.getResponseHeader("Location");
      if (!p.id) {
        result.data = {
          link: link,
          id: parseInt(link.split("/").pop(), 10)
        };
      }
      // Trigger the callback if defined
      ikats.common.callback(p.success, result);
      return result;
    },
    error: function(xhr) {
      return ikats.common.trigger_error_callback(result, xhr, p);
    },
    complete: function(xhr) {
      return ikats.common.trigger_complete_callback(result, xhr, p);
    }
  });

  return ikats.common.async_results_builder(result, p.async);
};

/**
 * Save a macro operator or custom operator
 *
 *   @param {ikats.common.default_params} p_args (see ikats.common.default_params for common parameters)
 *       * name: Name of the macro operator (mandatory)
 *       * desc: Text describing the macro operator (mandatory)
 *       * data: object containing macro operator details (mandatory)
 *       * id: (optional) Id of the macro operator (for updating purposes)
 *
 *   @return {ikats.common.results}
 *       results.data has 2 fields:
 *       id: identifier of the macro operator
 *       link: complete link to get the macro operator content
 *
 */
ikats.api.mo.save = function(p_args) {

  // Default returned result
  const result = new ikats.common.results();

  // Default parameters
  let p = new ikats.common.default_params();
  p.name = null; // Name of the macro operator (mandatory)
  p.description = null; // Text describing the macro operator (mandatory)
  p.data = null; // object containing macro operator details (mandatory)
  p.id = null; // Id of the macro operator (if provided, an update will be performed)

  // Merging with p_args
  p = ikats.common.merge_params(p_args, p);

  // Check missing mandatory parameters
  if (p.name === null) {
    console.error("wf_name must be filled");
    // Trigger the callback if defined
    ikats.common.callback(p.error, result);
    return result;
  }
  if (p.id !== null && !isNumber(p.id)) {
    console.error("ID must be a number");
    // Trigger the callback if defined
    ikats.common.callback(p.error, result);
    return result;
  }
  if (ikats.common.async_check(p) === false) {
    return result;
  }

  const data = {
    name: p.name,
    description: p.description,
    raw: p.data
  };

  // Handle update mode
  let verb = "POST";
  let urlId = "";
  if (p.id) {
    verb = "PUT";
    data.id = p.id;
    urlId = p.id;
  }

  // Fire request
  $.ajax({
    type: verb,
    url: ikats.constants.URL_TDM + "/mo/" + urlId,
    async: p.async,
    data: JSON.stringify(data),
    contentType: "application/json",
    success: function(data, txt_status, xhr) {
      /**
       * Argument data contains nothing
       */

      result.status = true;
      result.status_msg = xhr.statusText;
      result.debug = xhr;
      const link = xhr.getResponseHeader("Location");
      if (!p.id) {
        result.data = {
          link: link,
          id: parseInt(link.split("/").pop(), 10)
        };
      }
      // Trigger the callback if defined
      ikats.common.callback(p.success, result);
      return result;
    },
    error: function(xhr) {
      return ikats.common.trigger_error_callback(result, xhr, p);
    },
    complete: function(xhr) {
      return ikats.common.trigger_complete_callback(result, xhr, p);
    }
  });

  return ikats.common.async_results_builder(result, p.async);
};

/**
 * Load a workflow
 * If number is entered instead of complex object,
 * the method will assume this is the workflow id to use
 *
 *   @param {ikats.common.default_params=|number=} p_args (see ikats.common.default_params for common parameters)
 *      * id: Id of the workflow (mandatory)
 *
 *   @return {ikats.common.results}
 *       results.data is a {@link workflow}
 */
ikats.api.wf.load = function(p_args) {

  // Default returned result
  const result = new ikats.common.results();

  // Default parameters
  let p = new ikats.common.default_params();
  p.id = null; // Id of the workflow (mandatory)

  // Simple mode, if string is entered instead of complex object,
  // assume this is the workflow name to use
  if (isNumber(p_args)) {
    const temp_args = new ikats.common.default_params();
    temp_args.id = p_args;
    p_args = temp_args;
  }

  // Merging with p_args
  p = ikats.common.merge_params(p_args, p);

  // Check missing mandatory parameters
  if (p.name === null) {
    console.error("name must be filled");
    // Trigger the callback if defined
    ikats.common.callback(p.error, result);
    return result;
  }
  if (ikats.common.async_check(p) === false) {
    return result;
  }


  // Fire request
  $.ajax({
    type: "GET",
    url: ikats.constants.URL_TDM + "/wf/" + p.id,
    async: p.async,
    contentType: "application/json",
    success: function(data, txt_status, xhr) {
      /**
       * Argument data contains a {@link workflow}
       */

      result.status = true;
      result.status_msg = xhr.statusText;
      result.debug = xhr;
      result.data = data;
      // Trigger the callback if defined
      ikats.common.callback(p.success, result);
      return result;
    },
    error: function(xhr) {
      return ikats.common.trigger_error_callback(result, xhr, p);
    },
    complete: function(xhr) {
      return ikats.common.trigger_complete_callback(result, xhr, p);
    }
  });

  return ikats.common.async_results_builder(result, p.async);
};

/**
 * Load a macro or custom operator
 * If number is entered instead of complex object,
 * the method will assume this is the macro id to use
 *
 *   @param {ikats.common.default_params=|number=} p_args (see ikats.common.default_params for common parameters)
 *      * id: Id of the macro operator (mandatory)
 *
 *   @return {ikats.common.results}
 *       results.data is a {@link workflow}
 */
ikats.api.mo.load = function(p_args) {

  // Default returned result
  const result = new ikats.common.results();

  // Default parameters
  let p = new ikats.common.default_params();
  p.id = null; // Id of the workflow (mandatory)

  // Simple mode, if string is entered instead of complex object,
  // assume this is the workflow name to use
  if (isNumber(p_args)) {
    const temp_args = new ikats.common.default_params();
    temp_args.id = p_args;
    p_args = temp_args;
  }

  // Merging with p_args
  p = ikats.common.merge_params(p_args, p);

  // Check missing mandatory parameters
  if (p.name === null) {
    console.error("name must be filled");
    // Trigger the callback if defined
    ikats.common.callback(p.error, result);
    return result;
  }
  if (ikats.common.async_check(p) === false) {
    return result;
  }


  // Fire request
  $.ajax({
    type: "GET",
    url: ikats.constants.URL_TDM + "/mo/" + p.id,
    async: p.async,
    contentType: "application/json",
    success: function(data, txt_status, xhr) {
      /**
       * Argument data contains a {@link workflow}
       */

      result.status = true;
      result.status_msg = xhr.statusText;
      result.debug = xhr;
      result.data = data;
      // Trigger the callback if defined
      ikats.common.callback(p.success, result);
      return result;
    },
    error: function(xhr) {
      return ikats.common.trigger_error_callback(result, xhr, p);
    },
    complete: function(xhr) {
      return ikats.common.trigger_complete_callback(result, xhr, p);
    }
  });

  return ikats.common.async_results_builder(result, p.async);
};

/**
 * Delete a workflow
 * If number is entered instead of complex object,
 * the method will assume this is the workflow id to remove
 *
 *   @param {ikats.common.default_params|number=} p_args (see ikats.common.default_params for common parameters)
 *   @param {number} p_args.id id of the workflow (mandatory)
 *
 *   @return {ikats.common.results}
 *       results.data contains the deleted workflow content
 */
ikats.api.wf.del = function(p_args) {

  // Default returned result
  const result = new ikats.common.results();

  // Default parameters
  let p = new ikats.common.default_params();
  p.id = null; // Id of the workflow
  p.all = false; // Flag protecting the removal of all workflow

  // Simple mode, if number is entered instead of complex object,
  // assume this is the workflow id to remove
  if (isNumber(p_args)) {
    const temp_args = new ikats.common.default_params();
    temp_args.id = p_args;
    p_args = temp_args;
  }

  // Merging with p_args
  p = ikats.common.merge_params(p_args, p);

  // Check missing mandatory parameters
  if ((p.id === null) && (p.all === false)) {
    console.error("id must be filled");
    // Trigger the callback if defined
    ikats.common.callback(p.error, result);
    return result;
  }
  if (ikats.common.async_check(p) === false) {
    return result;
  }

  // Conditions met to delete all workflow
  if ((p.id === null) && (p.all === true)) {
    p.id = "";
  }

  // Fire request
  $.ajax({
    type: "DELETE",
    url: ikats.constants.URL_TDM + "/wf/" + p.id,
    async: p.async,
    contentType: "application/json",
    success: function(data, txt_status, xhr) {
      /**
       * Argument data contains nothing
       */

      result.status = true;
      result.status_msg = xhr.statusText;
      result.debug = xhr;
      result.data = data;

      // Trigger the callback if defined
      ikats.common.callback(p.success, result);
      return result;
    },
    error: function(xhr) {
      return ikats.common.trigger_error_callback(result, xhr, p);
    },
    complete: function(xhr) {
      return ikats.common.trigger_complete_callback(result, xhr, p);
    }
  });


  return ikats.common.async_results_builder(result, p.async);
};

/**
 * Delete a Macro operator or custom operator
 * If number is entered instead of complex object,
 * the method will assume this is the macro operator id to remove
 *
 *   @param {ikats.common.default_params|number=} p_args (see ikats.common.default_params for common parameters)
 *   @param {number} p_args.id id of the macro operator (mandatory)
 *
 *   @return {ikats.common.results}
 *       results.data contains the deleted macro operator content
 */
ikats.api.mo.del = function(p_args) {

  // Default returned result
  const result = new ikats.common.results();

  // Default parameters
  let p = new ikats.common.default_params();
  p.id = null; // Id of the workflow
  p.all = false; // Flag protecting the removal of all workflow

  // Simple mode, if number is entered instead of complex object,
  // assume this is the workflow id to remove
  if (isNumber(p_args)) {
    const temp_args = new ikats.common.default_params();
    temp_args.id = p_args;
    p_args = temp_args;
  }

  // Merging with p_args
  p = ikats.common.merge_params(p_args, p);

  // Check missing mandatory parameters
  if ((p.id === null) && (p.all === false)) {
    console.error("id must be filled");
    // Trigger the callback if defined
    ikats.common.callback(p.error, result);
    return result;
  }
  if (ikats.common.async_check(p) === false) {
    return result;
  }

  // Conditions met to delete all workflow
  if ((p.id === null) && (p.all === true)) {
    p.id = "";
  }

  // Fire request
  $.ajax({
    type: "DELETE",
    url: ikats.constants.URL_TDM + "/mo/" + p.id,
    async: p.async,
    contentType: "application/json",
    success: function(data, txt_status, xhr) {
      /**
       * Argument data contains nothing
       */

      result.status = true;
      result.status_msg = xhr.statusText;
      result.debug = xhr;
      result.data = data;

      // Trigger the callback if defined
      ikats.common.callback(p.success, result);
      return result;
    },
    error: function(xhr) {
      return ikats.common.trigger_error_callback(result, xhr, p);
    },
    complete: function(xhr) {
      return ikats.common.trigger_complete_callback(result, xhr, p);
    }
  });


  return ikats.common.async_results_builder(result, p.async);
};

/**
 * ALGORITHM
 */
/**
 * Get the list of available algorithms
 *
 *   @param {ikats.common.default_params=} p_args (see ikats.common.default_params for common parameters)
 *
 *   @return {ikats.common.results}
 *       results.data is TBD:
 *
 */
ikats.api.algorithm.list = function(p_args) {

  //TODO complete the results.data of algorithm.list

  // Default returned result
  const result = new ikats.common.results();

  // Default parameters
  let p = new ikats.common.default_params();

  // Merging with p_args
  p = ikats.common.merge_params(p_args, p);

  // Check missing mandatory parameters
  if (ikats.common.async_check(p) === false) {
    return result;
  }

  // Handling Result Simulation while waiting for real call
  if (ikats.constants.simulate_algorithms) {

    const algorithms = [];

    // Generate algorithms
    for (let i = 1; i <= 7; i++) {
      algorithms.push({
        name: "Name of algo " + i,
        description: "Description of algo " + i
      });
    }

    result.status = true;
    result.status_msg = "OK";
    result.debug = "Simulated Call";
    result.data = algorithms.map(function(x) {
      // Translate names
      return x;
    });

    // Trigger the callback if defined
    ikats.common.callback(p.success, result);
    return ikats.common.async_results_builder(result, p.async);
  }


  // Fire request
  const promise = $.ajax({
    type: "GET",
    url: ikats.constants.URL_Algo + "/catalogue/algorithms",
    async: p.async,
    contentType: "application/json",
    success: function(data, txt_status, xhr) {
      /**
       * Argument data contains an array composed of objects:
       * - name: name of the algorithm
       * - description: description of the algorithms to display
       */
      //TODO Confirm returned content for algorithm REST API

      result.status = true;
      result.status_msg = xhr.statusText;
      result.debug = xhr;
      result.data = data;

      // Trigger the callback if defined
      ikats.common.callback(p.success, result);
      return result;
    },
    error: function(xhr) {
      return ikats.common.trigger_error_callback(result, xhr, p);
    },
    complete: function(xhr) {
      return ikats.common.trigger_complete_callback(result, xhr, p);
    }
  });

  return ikats.common.async_results_builder(result, p.async, promise);

};

/**
 * FAMILY
 */
/**
 * Get the list of available families
 *
 *   @param {ikats.common.default_params=} p_args (see ikats.common.default_params for common parameters)
 *
 *   @return {ikats.common.results}
 *       results.data is an array of objects containing:
 *       - name: Name of the family,
 *       - description: Description of the family,
 */
ikats.api.families.list = function(p_args) {

  // Default returned result
  const result = new ikats.common.results();

  // Default parameters
  let p = new ikats.common.default_params();

  // Merging with p_args
  p = ikats.common.merge_params(p_args, p);

  // Check missing mandatory parameters
  if (ikats.common.async_check(p) === false) {
    return result;
  }


  // Handling Result Simulation while waiting for real call
  if (ikats.constants.simulate_family) {
    const families = [];
    // Generate families list
    for (let i = 1; i < 10; i++) {
      families.push({
        name: "Family " + i,
        description: "Description of Family " + i
      });
    }

    result.status = true;
    result.status_msg = "OK";
    result.debug = "Simulated Call";
    result.data = families.map(function(x) {
      // Translate names
      x.desc = x.description;
      delete x.description;
      return x;
    });

    // Trigger the callback if defined
    ikats.common.callback(p.success, result);
    return ikats.common.async_results_builder(result, p.async);
  }


  // Fire request
  const promise = $.ajax({
    type: "GET",
    url: ikats.constants.URL_Algo + "/catalogue/families",
    async: p.async,
    contentType: "application/json",
    success: function(data, txt_status, xhr) {
      /**
       * Argument data contains an array composed of objects:
       * - name: name of the family to display
       * - description: description of the family to display
       */
      //TODO Confirm returned content for family REST API with MBD (#141671)

      result.status = true;
      result.status_msg = xhr.statusText;
      result.debug = xhr;
      result.data = data.map(function(x) {
        // Translate names
        x.desc = x.description;
        delete x.description;
        return x;
      });

      // Trigger the callback if defined
      ikats.common.callback(p.success, result);
      return result;
    },
    error: function(xhr) {
      return ikats.common.trigger_error_callback(result, xhr, p);
    },
    complete: function(xhr) {
      return ikats.common.trigger_complete_callback(result, xhr, p);
    }
  });

  return ikats.common.async_results_builder(result, p.async, promise);

};

/**
 * OPERATORS
 */

/**
 * Implementations summary
 *
 * @typedef {Array} implementations
 * @property {number} id id of the implementation
 * @property {string} name Functional Name of implementation,
 * @property {string} description Description of implementation,
 * @property {string} label Label to display to identify implementation,
 * @property {string} family Family name this implementation belongs to,
 * @property {string} algo Algorithm that this implementation refers to
 */

/**
 * Get the list of operators (catalog)
 *
 *   @param {ikats.common.default_params=} p_args (see ikats.common.default_params for common parameters)
 *
 *   @return {ikats.common.results} {@link implementations} for data field
 *
 */
ikats.api.op.list = function(p_args) {

  // Default returned result
  const result = new ikats.common.results();

  // Default parameters
  let p = new ikats.common.default_params();

  // Merging with p_args
  p = ikats.common.merge_params(p_args, p);

  // Check missing mandatory parameters
  if (ikats.common.async_check(p) === false) {
    return result;
  }

  // Handling Result Simulation while waiting for real call
  if (ikats.constants.simulate_implementations) {

    const implementations = [];

    // Generate implementations
    for (let i = 1; i <= 20; i++) {
      implementations.push({
        id: i,
        name: "implem_name_" + i,
        description: "Description of implem " + i,
        label: "Implem " + i,
        family: "Family " + (i % 10),
        visibility: true,
        algo: "Algo " + (i % 7)
      });
    }

    result.status = true;
    result.status_msg = "OK";
    result.debug = "Simulated Call";
    result.data = implementations.map(function(x) {
      // Translate names
      return x;
    });

    // Trigger the callback if defined
    ikats.common.callback(p.success, result);
    return ikats.common.async_results_builder(result, p.async);
  }

  // Fire request
  const promise = $.ajax({
    type: "GET",
    url: ikats.constants.URL_Algo + "/catalogue/implementations",
    async: p.async,
    contentType: "application/json",


    /**
     * @callback implementations_callback
     *
     * @param {implementations} data Functional data
     * @param {string} txt_status HTTP status message
     * @param {xhr} xhr XHR Object used for debug
     * @return {ikats.common.results}
     */
    success: function(data, txt_status, xhr) {

      result.status = true;
      result.status_msg = xhr.statusText;
      result.debug = xhr;
      result.data = data;

      // Trigger the callback if defined
      ikats.common.callback(p.success, result);
      return result;
    },
    error: function(xhr) {
      return ikats.common.trigger_error_callback(result, xhr, p);
    },
    complete: function(xhr) {
      return ikats.common.trigger_complete_callback(result, xhr, p);
    }
  });

  return ikats.common.async_results_builder(result, p.async, promise);

};

/**
 * Implementation
 *
 * @typedef {Object} implementation
 * @property {number} id id of the implementation
 * @property {string} name Functional Name of implementation,
 * @property {string} description Description of implementation,
 * @property {string} label Label to display to identify implementation,
 * @property {string} family Family name this implementation belongs to,
 * @property {string} algo Algorithm that this implementation refers to
 * @property {Array} inputs
 * @property {string} inputs.label string to display identifying the input
 * @property {string} inputs.functional_name name to use as key to communicate with API
 * @property {string} inputs.type data type
 * @property {string} inputs.desc description of the input
 * @property {Array} parameters
 * @property {string} parameters.label string to display identifying the input
 * @property {string} parameters.functional_name name to use as key to communicate with API
 * @property {string} parameters.desc description of the parameter
 * @property {*} parameters.value value of the parameter
 * @property {*} parameters.domain list of all possible choices
 * @property {Array} outputs
 * @property {string} outputs.label string to display identifying the input
 * @property {string} outputs.functional_name name to use as key to communicate with API
 * @property {string} outputs.desc description of the parameter
 * @property {string} outputs.type data type
 */

/**
 * Get the detail of an operator
 * If string is entered instead of complex object,
 * the method will assume this is the operator id to use
 *
 *   @param {ikats.common.default_params|number=} p_args (see ikats.common.default_params for common parameters)
 *   @param {string} p_args.name Name of the operator (algorithm) (mandatory)
 *
 *   @return {ikats.common.results} (see ikats.common.results for common results) {@link implementation} for data field
 *
 */
ikats.api.op.read = function(p_args) {

  // Default returned result
  const result = new ikats.common.results();

  // Default parameters
  let p = new ikats.common.default_params();
  p.name = null; // Name of the operator (algorithm) (mandatory)

  // Simple mode, if number is entered instead of complex object,
  // assume this is the operator id to use
  if (typeof(p_args) === "string") {
    const temp_args = new ikats.common.default_params();
    temp_args.name = p_args;
    p_args = temp_args;
  }

  // Merging with p_args
  p = ikats.common.merge_params(p_args, p);

  // Check missing mandatory parameters
  if (p.name === null) {
    console.error("name must be filled");
    // Trigger the callback if defined
    ikats.common.callback(p.error, result);
    return result;
  }
  if (ikats.common.async_check(p) === false) {
    return result;
  }

  // Handling Result Simulation while waiting for real call
  if (ikats.constants.simulate_implementation) {

    const implementation = {
      id: 0,
      name: "Name of implementation",
      description: "Description of implem",
      label: "Implem label",
      family: "Family",
      algo: "Algo",
      inputs: [{
        name: "ts_selection",
        label: "TSin",
        description: "list of TS",
        type: "ts_list"
      }],
      parameters: [{
          label: "cut count",
          name: "cut_nb",
          description: "number of chunk",
          type: "number",
          domain: undefined
        }

      ],
      outputs: [{
        label: "TSout",
        name: "ts_result",
        description: "List of computed TS",
        type: "ts_list"
      }]
    };

    result.status = true;
    result.status_msg = "OK";
    result.debug = "Simulated Call";
    result.data = cloneObj(implementation);

    // Trigger the callback if defined
    ikats.common.callback(p.success, result);
    return ikats.common.async_results_builder(result, p.async);
  }

  // Fire request
  const promise = $.ajax({
    type: "GET",
    url: ikats.constants.URL_Algo + "/catalogue/implementations/" + p.name +
      "/",
    async: p.async,
    contentType: "application/json",

    /**
     * @callback implementation_callback
     *
     * @param {implementation} data Functional data
     * @param {string} txt_status HTTP status message
     * @param {xhr} xhr XHR Object used for debug
     * @return {ikats.common.results}
     */
    success: function(data, txt_status, xhr) {
      /**
       * Argument data contains an array composed of objects:
       * - id: id of the implementation
       * - name: Functional Name of implementation,
       * - description: Description of implementation,
       * - label: Label to display to identify implementation,
       * - family: Family name this implementation belongs to,
       * - algo: Algorithm that this implementation refers to
       * - inputs: array of ordered objects:
       *    - label: string to display identifying the input
       *    - functional_name: name to use as key to communicate with API
       *    - type: data type
       *    - desc: description of the input
       * - parameters: array of ordered objects:
       *    - label: string to display identifying the input
       *    - functional_name: name to use as key to communicate with API
       *    - desc: description of the parameter
       *    - value: value of the parameter
       *    - domain: list of all possible choices
       * - outputs: array of ordered objects:
       *    - label: string to display identifying the input
       *    - functional_name: name to use as key to communicate with API
       *    - desc: description of the parameter
       *    - type: data type
       */

      result.status = true;
      result.status_msg = xhr.statusText;
      result.debug = xhr;
      result.data = data;

      // Trigger the callback if defined
      ikats.common.callback(p.success, result);
      return result;
    },
    error: function(xhr) {
      return ikats.common.trigger_error_callback(result, xhr, p);
    },
    complete: function(xhr) {
      return ikats.common.trigger_complete_callback(result, xhr, p);
    }
  });
  return ikats.common.async_results_builder(result, p.async, promise);
};
/**
 * Check status of an operator
 * If number is entered instead of complex object,
 * the method will assume this is the pid to use
 *
 *   @method
 *
 *   @param {ikats.common.default_params|number=} p_args (see ikats.common.default_params for common parameters)
 *   @param {number} p_args.pid Id of the process id (mandatory)
 *
 *   @return {ikats.common.results} (see ikats.common.results for common results)
 *       results.data has the following fields:
 *       * pid: PID of the execution
 *       * status : Status of the execution
 *            - INIT:        Initialization
 *            - RUN:         Running
 *            - OK:          Success
 *            - ALGO_KO:     Called algorithm failed
 *            - ENGINE_KO:   Engine calling algorithm failed
 *       * exec_msg: Execution message
 *       * error_msg: Error message
 *       * start_date: Start date of the execution (EPOCH ms)
 *       * end_date: End date of the execution (EPOCH ms)
 *       * duration: Duration of the execution (seconds)
 *       * results: function returning the raw results object (experimental)
 *
 */
ikats.api.op.status = function(p_args) {

  // Default returned result
  const result = new ikats.common.results();

  // Default parameters
  let p = new ikats.common.default_params();
  p.pid = null; // Id of the process id

  // Simple mode, if number is entered instead of complex object,
  // assume this is the pid to use
  if (["number", "string"].indexOf(typeof(p_args)) >= 0) {
    const temp_args = new ikats.common.default_params();
    temp_args.pid = parseInt(p_args, 10);
    p_args = temp_args;
  }

  // Merging with p_args
  p = ikats.common.merge_params(p_args, p);

  // Check missing mandatory parameters
  if (ikats.common.async_check(p) === false) {
    return result;
  }

  /**
   * Algorithm instance status
   *
   * @typedef {Object} algo_instance_status
   * @property {number} http_code HTTP return code
   * @property {string} process_id process id this result belongs to
   * @property {number} start_date start date of the execution
   * @property {number} end_date end date of the execution
   * @property {string} exec_state status of execution
   * @property {string} http_msg message associated to the HTTP code
   * @property {number} duration duration of the execution
   *
   */
  const promise = $.ajax({
    type: "GET",
    url: ikats.constants.URL_Algo + "/execute/getstatus/" + p.pid,
    async: p.async,
    contentType: "application/json",

    /**
     * @callback pid_callback
     *
     * @param {algo_instance_status} data Functional data
     * @param {string} txt_status HTTP status message
     * @param {xhr} xhr XHR Object used for debug
     * @return {ikats.common.results}
     */
    success: function(data, txt_status, xhr) {

      result.status = true;
      result.status_msg = xhr.statusText;
      result.debug = xhr;
      // Wrap content into a formatted result
      result.data = {
        pid: data.process_id,
        status: data.exec_state,
        error_msg: data.http_msg,
        start_date: data.start_date,
        end_date: data.end_date,
        duration: data.duration,
        results: function() {
          return ikats.api.op.results(data.exec_algo.process_id).data;
        }
      };
      // Trigger the callback if defined
      ikats.common.callback(p.success, result);
      return result;
    },
    error: function(xhr) {
      return ikats.common.trigger_error_callback(result, xhr, p);
    },
    complete: function(xhr) {
      return ikats.common.trigger_complete_callback(result, xhr, p);
    }
  });

  return ikats.common.async_results_builder(result, p.async, promise);
};
/**
 * Run the computation of any operator (algorithm)
 *
 *   @param {ikats.common.default_params} p_args (see ikats.common.default_params for common parameters)
 *       * op_id: Id of the operator (algorithm) (mandatory)
 *       * args: arguments to send to the operator without preparation
 *       * async_run: detach algorithm execution if true, returns at the end of execution otherwise
 *
 *   @return {ikats.common.results}
 *       results.data has the following fields:
 *       * pid: PID of the execution
 *       * status : Status of the execution
 *            - INIT:        Initialization
 *            - RUN:         Running
 *            - ALGO_OK:     Success
 *            - ALGO_KO:     Called algorithm failed
 *            - ENGINE_KO:   Engine calling algorithm failed
 *       * exec_msg: Execution message
 *       * error_msg: Error message
 *       * start_date: Start date of the execution (EPOCH ms)
 *       * end_date: End date of the execution (EPOCH ms)
 *       * duration: Duration of the execution (seconds)
 *       * results: function returning the raw results object (experimental)
 */
ikats.api.op.run = function(p_args) {
  // Default returned result
  const result = new ikats.common.results();

  // Default parameters
  let p = new ikats.common.default_params();
  p.op_id = null; // Id of the operator (algorithm) (mandatory)
  p.async_run = true; // Detach execution (do not wait for result)
  p.args = {}; // Arguments to provide

  // Merging with p_args
  p = ikats.common.merge_params(p_args, p);

  // Check missing mandatory parameters
  if (p.op_id === null) {
    console.error("op_id must be filled");
    // Trigger the callback if defined
    ikats.common.callback(p.error, result);
    return result;
  }
  if (ikats.common.async_check(p) === false) {
    return result;
  }

  // Object to send to the algorithm (filled by inputs and parameters provided at call)
  const arguments_to_send = p.args;

  // Final data to send (encapsulate functional data with execution information)
  const data = {
    opts: {
      async: p.async_run,
      custo_algo: false, // Not a customized algorithm
      debug: false // No debug information at return
    },
    args: arguments_to_send // Functional arguments to send
  };

  /**
   * execute algo instance status
   *
   * @typedef {Object} execute_algo_instance
   * @property {Object} exec_algo
   * @property {string} exec_algo.process_id process id this result belongs to
   * @property {number} exec_algo.start_date start date of the execution
   * @property {number} exec_algo.end_date end date of the execution
   * @property {string} exec_algo.exec_state status of execution
   * @property {number} exec_algo.duration duration of the execution
   * @property {Object} exec_status
   * @property {?string[]} messages list of produced messages
   * @property {number} http_code HTTP return code
   * @property {string} http_msg message associated to the HTTP code
   *
   */
  const promise = $.ajax({
    type: "POST",
    url: ikats.constants.URL_Algo + "/execute/runalgo/" + p.op_id,
    data: JSON.stringify(data),
    async: p.async,
    contentType: "application/json",
    /**
     * @callback op_run_callback
     *
     * @param {execute_algo_instance} data Functional data
     * @param {string} txt_status HTTP status message
     * @param {xhr} xhr XHR Object used for debug
     * @return {ikats.common.results}
     */
    success: function(data, txt_status, xhr) {
      result.status = true;
      result.status_msg = xhr.statusText;
      result.debug = xhr;
      // Wrap content into a formatted result
      result.data = {
        pid: data.exec_algo.process_id,
        status: data.exec_algo.exec_state,
        error_msg: data.http_msg,
        start_date: data.exec_algo.start_date,
        end_date: data.exec_algo.end_date,
        duration: data.exec_algo.duration,
        results: function() {
          return ikats.api.op.results(data.process_id).data;
        }
      };

      // Trigger the callback if defined
      ikats.common.callback(p.success, result);
      return result;
    },
    error: function(xhr) {
      return ikats.common.trigger_error_callback(result, xhr, p);
    },
    complete: function(xhr) {
      return ikats.common.trigger_complete_callback(result, xhr, p);
    }
  });
  return ikats.common.async_results_builder(result, p.async, promise);
};
/**
 * Get the list of all results (processData) from the processId provided in arguments
 * If number/string is entered instead of complex object,
 * the method will assume this is the pid to use
 *
 *   @param {ikats.common.default_params|number|string=} p_args (see ikats.common.default_params for common parameters)
 *   @param {number} p_args.pid Id of the process id (mandatory)
 *
 *
 *   @return {ikats.common.results}
 *       results.data is an array of objects containing:
 *       * rid : unique ID of the result
 *       * pid : processId this result belongs to
 *       * dataType : type of result (JSON, CSV)
 *       * name : name of the result
 *       * get: function returning the raw result (experimental)
 *
 */
ikats.api.op.results = function(p_args) {

  // Default returned result
  const result = new ikats.common.results();

  // Default parameters
  let p = new ikats.common.default_params();
  p.pid = null; // ProcessId to use as number (mandatory)

  // Simple mode, if number/string is entered instead of complex object,
  // assume this is the pid to use
  if (["number", "string"].indexOf(typeof(p_args)) >= 0) {
    const temp_args = new ikats.common.default_params();
    temp_args.pid = parseInt(p_args, 10);
    if (isNaN(temp_args.pid)) {
      temp_args.pid = p_args;
    }
    p_args = temp_args;
  }

  // Merging with p_args
  p = ikats.common.merge_params(p_args, p);

  // Check missing mandatory parameters
  if (p.pid === null) {
    console.error("pid must be filled");
    // Trigger the callback if defined
    ikats.common.callback(p.error, result);
    return result;
  }
  if (ikats.common.async_check(p) === false) {
    return result;
  }


  // Fire request
  const promise = $.ajax({
    type: "GET",
    url: ikats.constants.URL_TDM + "/processdata/" + p.pid,
    data: p.data,
    async: p.async,


    /**
     * Algorithm run instance results
     *
     * @typedef {Array} algo_run_instance_results
     * @property {number} id unique ID of the item (resource Id)
     * @property {number} processId processId this result belongs to
     * @property {string} dataType type of result (JSON, CSV)
     * @property {string} name name of the result
     */

    /**
     * @callback op_results_callback
     *
     * @param {algo_run_instance_results} data Functional data
     * @param {string} txt_status HTTP status message
     * @param {xhr} xhr XHR Object used for debug
     * @return {ikats.common.results}
     */
    success: function(data, txt_status, xhr) {
      /**
       * Argument data is an array of objects containing:
       * - id : unique ID of the item (resource Id)
       * - processId : processId this result belongs to
       * - dataType : type of result (JSON, CSV)
       * - name : name of the result
       */
      result.status = true;
      result.status_msg = xhr.statusText;
      result.debug = xhr;

      //Convert data format
      data.map(function(x) {
        x.pid = x.processId;
        x.rid = x.id;
        x.get = function() {
          return ikats.api.op.result(x.rid).data;
        };
        delete x.processId;
        delete x.id;
        return x;
      });
      result.data = data;
      // Trigger the callback if defined
      ikats.common.callback(p.success, result);
      return result;
    },
    error: function(xhr) {
      return ikats.common.trigger_error_callback(result, xhr, p);
    },
    complete: function(xhr) {
      return ikats.common.trigger_complete_callback(result, xhr, p);
    }
  });
  return ikats.common.async_results_builder(result, p.async, promise);
};
/**
 * Get a JSON result stored in the process data
 * If number is entered instead of complex object,
 * the method will assume this is the pid to use
 *
 *   @param {ikats.common.default_params|number=} p_args (see ikats.common.default_params for common parameters)
 *   @param {number} p_args.rid Id of the resource file to get (mandatory)
 *
 *   @return {ikats.common.results} (see ikats.common.results for common results)
 *       results.data is the raw result
 */
ikats.api.op.result = function(p_args) {
  // Default returned result
  const result = new ikats.common.results();

  // Default parameters
  let p = new ikats.common.default_params();
  p.rid = null; // Id (number) of the resource file to get (mandatory)

  // Simple mode, if number is entered instead of complex object,
  // assume this is the resource id to use

  if ((typeof(p_args) === "number") || (typeof(p_args) === "string")) {
    const temp_args = new ikats.common.default_params();
    temp_args.rid = p_args;
    p_args = temp_args;
  }

  // Merging with p_args
  p = ikats.common.merge_params(p_args, p);

  // Check missing mandatory parameters
  if (p.rid === null) {
    console.error("rid must be filled");
    // Trigger the callback if defined
    ikats.common.callback(p.error, result);
    return result;
  }
  if (ikats.common.async_check(p) === false) {
    return result;
  }

  /** MOCK CODE **/
  if (p.rid === "id_mock_pdata1") {
    result.data = [{
      "funcId": "PORTFOLIO_EWH",
      "tsuid": "650DF9000001000001000002000002000003000005"
    }];
    ikats.common.callback(p.success, result);
    return result;
  }
  /** END OF MOCK **/
  // Fire request
  const promise = $.ajax({
    type: "GET",
    url: ikats.constants.URL_TDM +
      "/processdata/id/download/" + p.rid,
    async: p.async,
    contentType: "application/json",


    /**
     * @callback ikats_api_op_result_callback
     *
     * @param {*} data Functional data
     * @param {string} txt_status HTTP status message
     * @param {xhr} xhr XHR Object used for debug
     * @return {ikats.common.results}
     */
    success: function(data, txt_status, xhr) {
      /**
       * Argument data contains the raw data
       */
      result.status = true;
      result.status_msg = xhr.statusText;
      result.debug = xhr;
      result.data = data;
      // Trigger the callback if defined
      ikats.common.callback(p.success, result);
      return result;
    },
    error: function(xhr) {
      return ikats.common.trigger_error_callback(result, xhr, p);
    },
    complete: function(xhr) {
      return ikats.common.trigger_complete_callback(result, xhr, p);
    }
  });

  return ikats.common.async_results_builder(result, p.async, promise);
};

/**
 * List all tables stored in the process data
 *
 *   @param {ikats.common.default_params|number=} p_args (see ikats.common.default_params for common parameters)
 *
 *   @return {ikats.common.results}
 *       results.data is the raw result
 */
ikats.api.table.list = function(p_args) {
  // Default returned result
  let result = new ikats.common.results();

  // Default parameters
  let p = new ikats.common.default_params();

  // Merging with p_args
  p = ikats.common.merge_params(p_args, p);

  // Check missing mandatory parameters
  if (ikats.common.async_check(p) === false) {
    return result;
  }

  // Fire request
  const promise = $.ajax({
    type: "GET",
    url: ikats.constants.URL_TDM + "/table",
    async: p.async,
    contentType: "application/json",


    /**
     * @callback ikats_api_op_result_callback
     *
     * @param {*} data Functional data
     * @param {string} txt_status HTTP status message
     * @param {xhr} xhr XHR Object used for debug
     * @return {ikats.common.results}
     */
    success: function(data, txt_status, xhr) {
      /**
       * Argument data contains the raw data
       */
      result.status = true;
      result.status_msg = xhr.statusText;
      result.debug = xhr;
      result.data = data;
      // Trigger the callback if defined
      ikats.common.callback(p.success, result);
      return result;
    },
    error: function(xhr) {
      return ikats.common.trigger_error_callback(result, xhr, p);
    },
    complete: function(xhr) {
      return ikats.common.trigger_complete_callback(result, xhr, p);
    }
  });

  return ikats.common.async_results_builder(result, p.async, promise);
};

/**
 * Get a table stored in the process data as csv file
 *
 *   @param {ikats.common.default_params|number=} p_args (see ikats.common.default_params for common parameters)
 *   @param {number} p_args.table_name name of the resource to get (mandatory)
 *
 *   @return {ikats.common.results}
 *       results.data is the raw result
 */
ikats.api.table.read = function(p_args) {
  // Default returned result
  let result = new ikats.common.results();

  // Default parameters
  let p = new ikats.common.default_params();
  p.table_name = null; // Table name identifying the resource to get (mandatory)

  // Simple mode, if string is entered instead of complex object,
  // assume this is the table name to use
  if (typeof(p_args) === "string") {
    const temp_args = new ikats.common.default_params();
    temp_args.table_name = p_args;
    p_args = temp_args;
  }

  // Merging with p_args
  p = ikats.common.merge_params(p_args, p);

  // Check missing mandatory parameters
  if (p.table_name === null) {
    console.error("table_name must be filled");
    // Trigger the callback if defined
    ikats.common.callback(p.error, result);
    return result;
  }
  if (ikats.common.async_check(p) === false) {
    return result;
  }

  // Fire request
  const promise = $.ajax({
    type: "GET",
    url: ikats.constants.URL_TDM + "/table/" + p.table_name,
    async: p.async,
    contentType: "application/json",


    /**
     * @callback ikats_api_op_result_callback
     *
     * @param {*} data Functional data
     * @param {string} txt_status HTTP status message
     * @param {xhr} xhr XHR Object used for debug
     * @return {ikats.common.results}
     */
    success: function(data, txt_status, xhr) {
      /**
       * Argument data contains the raw data
       */
      result.status = true;
      result.status_msg = xhr.statusText;
      result.debug = xhr;
      result.data = data;
      // Trigger the callback if defined
      ikats.common.callback(p.success, result);
      return result;
    },
    error: function(xhr) {
      return ikats.common.trigger_error_callback(result, xhr, p);
    },
    complete: function(xhr) {
      return ikats.common.trigger_complete_callback(result, xhr, p);
    }
  });

  return ikats.common.async_results_builder(result, p.async, promise);
};


/**
 * Delete a table stored in the process data
 *
 *   @param {ikats.common.default_params|number=} p_args (see ikats.common.default_params for common parameters)
 *   @param {number} p_args.table_name name of the resource to get (mandatory)
 *
 *   @return {ikats.common.results}
 *       results.data is the raw result
 */
ikats.api.table.del = function(p_args) {
  // Default returned result
  let result = new ikats.common.results();

  // Default parameters
  let p = new ikats.common.default_params();
  p.table_name = null; // Table name identifying the resource to get (mandatory)

  // Simple mode, if string is entered instead of complex object,
  // assume this is the table name to use
  if (typeof(p_args) === "string") {
    const temp_args = new ikats.common.default_params();
    temp_args.table_name = p_args;
    p_args = temp_args;
  }

  // Merging with p_args
  p = ikats.common.merge_params(p_args, p);

  // Check missing mandatory parameters
  if (p.table_name === null) {
    console.error("table_name must be filled");
    // Trigger the callback if defined
    ikats.common.callback(p.error, result);
    return result;
  }
  if (ikats.common.async_check(p) === false) {
    return result;
  }

  // Fire request
  const promise = $.ajax({
    type: "DELETE",
    url: ikats.constants.URL_TDM + "/table/" + p.table_name,
    async: p.async,
    contentType: "application/json",


    /**
     * @callback ikats_api_op_result_callback
     *
     * @param {*} data Functional data
     * @param {string} txt_status HTTP status message
     * @param {xhr} xhr XHR Object used for debug
     * @return {ikats.common.results}
     */
    success: function(data, txt_status, xhr) {
      /**
       * Argument data contains the raw data
       */
      result.status = true;
      result.status_msg = xhr.statusText;
      result.debug = xhr;
      result.data = data;
      // Trigger the callback if defined
      ikats.common.callback(p.success, result);
      return result;
    },
    error: function(xhr) {
      return ikats.common.trigger_error_callback(result, xhr, p);
    },
    complete: function(xhr) {
      return ikats.common.trigger_complete_callback(result, xhr, p);
    }
  });

  return ikats.common.async_results_builder(result, p.async, promise);
};

/**
 * Create a table with name and csv file provided in argument
 *
 *   @param {ikats.common.default_params|number|string=} p_args (see ikats.common.default_params for common parameters)
 *   @param {text} p_args.table_name name of the table as processId (mandatory)
 *   @param {text} p_args.row_name name of row to be considered as identifier (mandatory)
 *
 *
 *   @return {ikats.common.results}
 *
 */
ikats.api.table.createFromCSV = function(p_args) {

  // Default returned result
  let result = new ikats.common.results();

  // Default parameters
  let p = new ikats.common.default_params();
  p.table_name = null; // table_name to use as string (mandatory)
  p.row_name = null; // row_name to use as string (mandatory)
  p.file_content = null; // file content to use (mandatory)
  p.filename = null; // filename to use as string (mandatory)

  // Merging with p_args
  p = ikats.common.merge_params(p_args, p);

  // Check missing mandatory parameters
  if (p.table_name === null) {
    console.error("table_name must be filled");
    // Trigger the callback if defined
    ikats.common.callback(p.error, result);
    return result;
  }
  if (p.row_name === null) {
    console.error("row_name must be filled");
    // Trigger the callback if defined
    ikats.common.callback(p.error, result);
    return result;
  }
  if (p.file_content === null) {
    console.error("file_content must be filled");
    // Trigger the callback if defined
    ikats.common.callback(p.error, result);
    return result;
  }
  if (p.filename === null) {
    console.error("filename must be filled");
    // Trigger the callback if defined
    ikats.common.callback(p.error, result);
    return result;
  }
  if (ikats.common.async_check(p) === false) {
    return result;
  }

  const formData = new FormData();
  formData.append("rowName", p.row_name);
  formData.append("tableName", p.table_name);
  formData.append("file", new File([p.file_content], p.filename));

  // Fire request
  const promise = $.ajax({
    type: "POST",
    url: ikats.constants.URL_TDM + "/table",
    /**
     * Argument data is a form data containing:
     * - row_name : row containing unique ID of the item
     * - file : input csv file (csv content + filename)
     */
    data: formData,
    cache: false,
    contentType: false, // Prevent jQuery from using "multipart/form-data" without boundary
    processData: false, // Tell JQuery to not convert formData to string
    async: p.async,
    success: function(data, txt_status, xhr) {
      result.status = true;
      result.status_msg = xhr.statusText;
      result.debug = xhr;
      result.data = data;

      // Trigger the callback if defined
      ikats.common.callback(p.success, result);
      return result;
    },
    error: function(xhr) {
      // Display the response directly (without transformation)
      return ikats.common.trigger_error_callback(result, xhr, p);
    },
    complete: function(xhr) {
      return ikats.common.trigger_complete_callback(result, xhr, p);
    }
  });

  return ikats.common.async_results_builder(result, p.async, promise);
};

/**
 * Checks the validity of the name provided
 *
 * @param {string} name
 * @return {boolean} a boolean indicating if the name matches the pattern or not
 */
ikats.api.table.namePattern = new RegExp(/^[A-Za-z0-9-_]+$/);
ikats.api.table.isValidName = function(name) {
  return ikats.api.table.namePattern.test(name);
};

/**
 * Extends the table defined by the tableName parameter, by adding one
 * column per selected metric
 *
 *   @param {ikats.common.default_params|number|string=} p_args (see ikats.common.default_params for common parameters)
 *   @param {text} p_args.tableName the raw String representing the JSON plain content (mandatory)
 *   @param {text} p_args.metrics selected metrics separated by ";". Spaces are ignored (mandatory)
 *   @param {text} p_args.dataset the dataset name (mandatory)
 *   @param {text} p_args.joinColName the name of the table column used by the join (NOT mandatory)
 *   @param {text} p_args.joinMetaName the name of metadata used by the join (NOT mandatory)
 *   @param {text} p_args.targetColName name of the target columnr (NOT mandatory)
 *   @param {text} p_args.outputTableName name of the table joined by metric, and created in the database (mandatory)
 *
 *
 *   @return {ikats.common.results}
 *
 */
ikats.api.table.joinMetrics = function(p_args) {

  // Default returned result
  let result = new ikats.common.results();

  // Default parameters
  let p = new ikats.common.default_params();
  p.tableName = null; // table to use as json string (mandatory)
  p.metrics = null; // selected metrics as string (mandatory)
  p.dataset = null; // dataset name to use as string (mandatory)
  p.joinColName = null; // the name of the table column used by the join to use as string (optional)
  p.joinMetaName = null; // name of metadata used by the join to use as string (optional)
  p.targetColName = null; // the target column to use as string (optional)
  p.outputTableName = null; // output table name to use as string (mandatory)

  // Merging with p_args
  p = ikats.common.merge_params(p_args, p);

  // Check missing mandatory parameters
  if (p.tableName === null) {
    console.error("tableName must be filled");
    // Trigger the callback if defined
    ikats.common.callback(p.error, result);
    return result;
  }
  if (p.metrics === null) {
    console.error("metrics must be filled");
    // Trigger the callback if defined
    ikats.common.callback(p.error, result);
    return result;
  }
  if (p.dataset === null) {
    console.error("dataset name must be filled");
    // Trigger the callback if defined
    ikats.common.callback(p.error, result);
    return result;
  }
  if (p.outputTableName === null) {
    console.error("output table name must be filled");
    // Trigger the callback if defined
    ikats.common.callback(p.error, result);
    return result;
  }
  if (ikats.common.async_check(p) === false) {
    return result;
  }

  const formData = new FormData();
  formData.append("tableName", p.tableName);
  formData.append("metrics", p.metrics);
  formData.append("dataset", p.dataset);
  formData.append("joinColName", p.joinColName);
  formData.append("joinMetaName", p.joinMetaName);
  formData.append("targetColName", p.targetColName);
  formData.append("outputTableName", p.outputTableName);

  // Fire request
  const promise = $.ajax({
    type: "POST",
    url: ikats.constants.URL_TDM + "/table/join/metrics",
    /**
     * Argument data is a form data containing:
     * - tableName : the table to process (format json)
     * - meta_name : name of the metadata to process
     * - population_id : name of the population id to process
     * - output_table_name : name of the output table generated
     */
    data: formData,
    cache: false,
    contentType: false, // Prevent jQuery from using "multipart/form-data" without boundary
    processData: false, // Tell JQuery to not convert formData to string
    async: p.async,
    success: function(data, txt_status, xhr) {
      result.status = true;
      result.status_msg = xhr.statusText;
      result.debug = xhr;
      result.data = data;

      // Trigger the callback if defined
      ikats.common.callback(p.success, result);
      return result;
    },
    error: function(xhr) {
      // Display the response directly (without transformation)
      return ikats.common.trigger_error_callback(result, xhr, p);
    },
    complete: function(xhr) {
      return ikats.common.trigger_complete_callback(result, xhr, p);
    }
  });

  return ikats.common.async_results_builder(result, p.async, promise);
};

/**
 * Create a new table from an old one with a new key from metadata and population id
 *
 *   @param {ikats.common.default_params|number|string=} p_args (see ikats.common.default_params for common parameters)
 *   @param {text} p_args.tableName name of the table to process as processId (mandatory)
 *   @param {text} p_args.meta_name name of metadata to concat with agregates ref (mandatory)
 *   @param {text} p_args.population_id id of population (which is in fact a metadata name) = key of output table (mandatory)
 *   @param {text} p_args.output_table_name name of the output table generated (mandatory)
 *
 *
 *   @return {ikats.common.results}
 *
 */
ikats.api.table.ts2feature = function(p_args) {

  // Default returned result
  let result = new ikats.common.results();

  // Default parameters
  let p = new ikats.common.default_params();
  p.tableName = null; // table to use as json string (mandatory)
  p.meta_name = null; // meta_name to use as string (mandatory)
  p.population_id = null; // population_id to use as string (mandatory)
  p.output_table_name = null; // output_table_name to use as string (mandatory)

  // Merging with p_args
  p = ikats.common.merge_params(p_args, p);

  // Check missing mandatory parameters
  if (p.tableName === null) {
    console.error("tableName must be filled");
    // Trigger the callback if defined
    ikats.common.callback(p.error, result);
    return result;
  }
  if (p.meta_name === null) {
    console.error("meta_name must be filled");
    // Trigger the callback if defined
    ikats.common.callback(p.error, result);
    return result;
  }
  if (p.population_id === null) {
    console.error("population_id must be filled");
    // Trigger the callback if defined
    ikats.common.callback(p.error, result);
    return result;
  }
  if (p.output_table_name === null) {
    console.error("output_table_name must be filled");
    // Trigger the callback if defined
    ikats.common.callback(p.error, result);
    return result;
  }
  if (ikats.common.async_check(p) === false) {
    return result;
  }

  const formData = new FormData();
  formData.append("tableName", p.tableName);
  formData.append("metaName", p.meta_name);
  formData.append("populationId", p.population_id);
  formData.append("outputTableName", p.output_table_name);

  // Fire request
  const promise = $.ajax({
    type: "POST",
    url: ikats.constants.URL_TDM + "/table/ts2feature",
    /**
     * Argument data is a form data containing:
     * - tableName : the table to process (format json)
     * - meta_name : name of the metadata to process
     * - population_id : name of the population id to process
     * - output_table_name : name of the output table generated
     */
    data: formData,
    cache: false,
    contentType: false, // Prevent jQuery from using "multipart/form-data" without boundary
    processData: false, // Tell JQuery to not convert formData to string
    async: p.async,
    success: function(data, txt_status, xhr) {
      result.status = true;
      result.status_msg = xhr.statusText;
      result.debug = xhr;
      result.data = data;

      // Trigger the callback if defined
      ikats.common.callback(p.success, result);
      return result;
    },
    error: function(xhr) {
      // Display the response directly (without transformation)
      return ikats.common.trigger_error_callback(result, xhr, p);
    },
    complete: function(xhr) {
      return ikats.common.trigger_complete_callback(result, xhr, p);
    }
  });

  return ikats.common.async_results_builder(result, p.async, promise);
};

/**
 * Create a new table from an old one with a new key from metadata and population id
 *
 *   @param {ikats.common.default_params|number|string=} p_args (see ikats.common.default_params for common parameters)
 *   @param {text} p_args.tableName name of the table to process as processId (mandatory)
 *   @param {text} p_args.meta_name name of metadata to concat with aggregates ref (mandatory)
 *   @param {text} p_args.population_id id of population (which is in fact a metadata name) = key of output table (mandatory)
 *   @param {text} p_args.output_table_name name of row to be considered as identifier (NOT mandatory)
 *
 *
 *   @return {ikats.common.results}
 *
 */
ikats.api.table.trainTestSplit = function(p_args) {

  // Default returned result
  let result = new ikats.common.results();

  // Default parameters
  let p = new ikats.common.default_params();
  p.tableName = null; // table to use as json string (mandatory)
  p.targetColumnName = null; // targetColumnName to use as string (mandatory)
  p.repartitionRate = null; // repartitionRate to use as string (mandatory)
  p.outputTableName = null; // output_table_name to use as string (mandatory)

  // Merging with p_args
  p = ikats.common.merge_params(p_args, p);

  // Check missing mandatory parameters
  if (p.tableName === null) {
    console.error("tableName must be filled");
    // Trigger the callback if defined
    ikats.common.callback(p.error, result);
    return result;
  }
  if (p.targetColumnName === null) {
    console.error("targetColumnName must be filled");
    // Trigger the callback if defined
    ikats.common.callback(p.error, result);
    return result;
  }
  if (p.repartitionRate === null) {
    console.error("repartitionRate must be filled");
    // Trigger the callback if defined
    ikats.common.callback(p.error, result);
    return result;
  }
  if (p.outputTableName === null) {
    console.error("output_table_name must be filled");
    // Trigger the callback if defined
    ikats.common.callback(p.error, result);
    return result;
  }
  if (ikats.common.async_check(p) === false) {
    return result;
  }

  const formData = new FormData();
  formData.append("tableName", p.tableName);
  formData.append("targetColumnName", p.targetColumnName);
  formData.append("repartitionRate", p.repartitionRate);
  formData.append("outputTableName", p.outputTableName);

  // Fire request
  const promise = $.ajax({
    type: "POST",
    url: ikats.constants.URL_TDM +
      "/table/traintestsplit",
    /**
     * Argument data is a form data containing:
     * - tableName : the table to process (format json)
     * - targetColumnName : name of the target column in input table
     * - repartitionRate : repartition rate in output table
     * - outputTableName : name of the output table generated
     */
    data: formData,
    cache: false,
    contentType: false, // Prevent jQuery from using "multipart/form-data" without boundary
    processData: false, // Tell JQuery to not convert formData to string
    async: p.async,
    success: function(data, txt_status, xhr) {
      result.status = true;
      result.status_msg = xhr.statusText;
      result.debug = xhr;
      result.data = data;

      // Trigger the callback if defined
      ikats.common.callback(p.success, result);
      return result;
    },
    error: function(xhr) {
      // Display the response directly (without transformation)
      return ikats.common.trigger_error_callback(result, xhr, p);
    },
    complete: function(xhr) {
      return ikats.common.trigger_complete_callback(result, xhr, p);
    }
  });

  return ikats.common.async_results_builder(result, p.async, promise);
};
/**
 * Merge 2 tables into one with a join key. If not specified, the join key will be the first column of each table.
 *
 *   @param {ikats.common.default_params|number|string=} p_args (see ikats.common.default_params for common parameters)
 *   @param {text} p_args.table1 JSON representation of the first table to join on (mandatory)
 *   @param {text} p_args.table2 JSON representation of the second table to join on (mandatory)
 *   @param {text} p_args.join_on column name to be used for the join. (NOT mandatory)
 *   @param {text} p_args.output_table_name the merged table name
 *
 *   @return {ikats.common.results}
 */
ikats.api.table.merge = function(p_args) {

  // Default returned result
  let result = new ikats.common.results();

  // Default parameters
  let p = new ikats.common.default_params();
  p.table1 = null;
  p.table2 = null;
  p.joinOn = null;
  p.outputTableName = null;

  // Merging with p_args
  p = ikats.common.merge_params(p_args, p);

  // Check missing mandatory parameters
  if (p.table1 === null || p.table2 === null) {
    console.error("Both input table should be provided");
    // Trigger the callback if defined
    ikats.common.callback(p.error, result);
    return result;
  }
  if (ikats.common.async_check(p) === false) {
    return result;
  }

  // Fire request
  const data = JSON.stringify({
    tableNames: [p.table1, p.table2],
    joinOn: p.joinOn,
    outputTableName: p.outputTableName,
  });
  const promise = $.ajax({
    type: "POST",
    url: ikats.constants.URL_TDM + "/table/merge",
    /**
     * Argument data is a form data containing:
     * - table : the tables to merge
     * - joinOn : name of the column to use for joining (blank to use the first column)
     * - outputTableName : name of the output table to generate
     */
    data: data,
    cache: false,
    contentType: "application/json",
    async: p.async,
    success: function(data, txt_status, xhr) {
      result.status = true;
      result.status_msg = xhr.statusText;
      result.debug = xhr;
      result.data = data;

      // Trigger the callback if defined
      ikats.common.callback(p.success, result);
      return result;
    },
    error: function(xhr) {
      // Display the response directly (without transformation)
      return ikats.common.trigger_error_callback(result, xhr, p);
    },
    complete: function(xhr) {
      return ikats.common.trigger_complete_callback(result, xhr, p);
    }
  });

  return ikats.common.async_results_builder(result, p.async, promise);

};

/**
 * List all ingestion sessions.
 *
 *   @param {ikats.common.default_params|number|string=} p_args (see ikats.common.default_params for common parameters)

 *   @return {ikats.common.results}
 */
ikats.api.ingest.sessions = function(p_args) {

  // Default returned result
  let result = new ikats.common.results();

  // Default parameters
  let p = new ikats.common.default_params();

  // Merging with p_args
  p = ikats.common.merge_params(p_args, p);

  // Check missing mandatory parameters
  if ([p.dataset, p.description, p.rootPath, p.pathPattern,
      p.funcIdPattern, p.importer, p.serializer
    ].some(x => x === null)) {
    console.error("All parameters shall be set");
    // Trigger the callback if defined
    ikats.common.callback(p.error, result);
    return result;
  }
  if (ikats.common.async_check(p) === false) {
    return result;
  }

  // Fire request
  const promise = $.ajax({
    type: "GET",
    url: ikats.constants.URL_Ingestion + "/sessions",
    contentType: "application/json",
    async: p.async,
    success: function(data, txt_status, xhr) {
      result.status = true;
      result.status_msg = xhr.statusText;
      result.debug = xhr;
      result.data = data;

      // Trigger the callback if defined
      ikats.common.callback(p.success, result);
      return result;
    },
    error: function(xhr) {
      // Display the response directly (without transformation)
      return ikats.common.trigger_error_callback(result, xhr, p);
    },
    complete: function(xhr) {
      return ikats.common.trigger_complete_callback(result, xhr, p);
    }
  });

  return ikats.common.async_results_builder(result, p.async, promise);

};

/**
 * Restart a former ingestion session
 *
 *   @param {ikats.common.default_params|number|string=} p_args (see ikats.common.default_params for common parameters)
 *   @param {text} p_args.id The session Id to restart
 *
 *   @return {ikats.common.results}
 */
ikats.api.ingest.restart = function(p_args) {

  // Default returned result
  let result = new ikats.common.results();

  // Default parameters
  let p = new ikats.common.default_params();
  p.id = null;

  // Merging with p_args
  p = ikats.common.merge_params(p_args, p);

  // Check missing mandatory parameters
  if (!isNumber(p.id)) {
    console.error("'id' parameter shall be set");
    // Trigger the callback if defined
    ikats.common.callback(p.error, result);
    return result;
  }

  if (ikats.common.async_check(p) === false) {
    return result;
  }

  // Fire request
  const promise = $.ajax({
    type: "PUT",
    url: ikats.constants.URL_Ingestion + "/sessions/" + p.id + "/restart",
    cache: false,
    contentType: "application/json",
    async: p.async,
    success: function(data, txt_status, xhr) {
      result.status = true;
      result.status_msg = xhr.statusText;
      result.debug = xhr;
      result.data = data;

      // Trigger the callback if defined
      ikats.common.callback(p.success, result);
      return result;
    },
    error: function(xhr) {
      // Display the response directly (without transformation)
      return ikats.common.trigger_error_callback(result, xhr, p);
    },
    complete: function(xhr) {
      return ikats.common.trigger_complete_callback(result, xhr, p);
    }
  });

  return ikats.common.async_results_builder(result, p.async, promise);

};

/**
 * Ingest a set of timeseries available on a specific path in the server.
 * All parameters are mandatory
 *
 *   @param {ikats.common.default_params|number|string=} p_args (see ikats.common.default_params for common parameters)
 *   @param {text} p_args.dataset The name of the dataset into IKATS database
 *   @param {text} p_args.description A description of that dataset for the end user
 *   @param {text} p_args.rootPath The root path of the dataset on the import server where files are located
 *   @param {text} p_args.pathPattern Regex pattern rules for defining tags and metric of dataset
 *   @param {text} p_args.funcIdPattern Pattern configuring how is generated the Functional Identifier
 *   @param {text} p_args.importer Fully Qualified Name of the java importer used to transfer the Time-Serie data to the
 *                                 IKATS dedicated database
 *   @param {text} p_args.serializer Set the Fully Qualified Name of the input serializer
 *
 *   @return {ikats.common.results}
 */
ikats.api.ingest.start = function(p_args) {

  // Default returned result
  let result = new ikats.common.results();

  // Default parameters
  let p = new ikats.common.default_params();
  p.dataset = null;
  p.description = null;
  p.rootPath = "/IKATSDATA";
  p.pathPattern = null;
  p.funcIdPattern = null;
  p.importer = "fr.cs.ikats.ingestion.process.opentsdb.OpenTsdbImportTaskFactory";
  p.serializer = "fr.cs.ikats.datamanager.client.opentsdb.importer.CommonDataJsonIzer";

  // Merging with p_args
  p = ikats.common.merge_params(p_args, p);

  // Check missing mandatory parameters
  if ([p.dataset, p.description, p.rootPath, p.pathPattern,
      p.funcIdPattern, p.importer, p.serializer
    ].some(x => x === null)) {
    console.error("All parameters shall be set");
    // Trigger the callback if defined
    ikats.common.callback(p.error, result);
    return result;
  }
  if (ikats.common.async_check(p) === false) {
    return result;
  }

  // Fire request
  const data = JSON.stringify({
    dataset: p.dataset,
    description: p.description,
    rootPath: p.rootPath,
    pathPattern: p.pathPattern,
    funcIdPattern: p.funcIdPattern,
    importer: p.importer,
    serializer: p.serializer
  });
  const promise = $.ajax({
    type: "POST",
    url: ikats.constants.URL_Ingestion + "/sessions",
    data: data,
    cache: false,
    contentType: "application/json",
    async: p.async,
    success: function(data, txt_status, xhr) {
      result.status = true;
      result.status_msg = xhr.statusText;
      result.debug = xhr;
      result.data = data;

      // Trigger the callback if defined
      ikats.common.callback(p.success, result);
      return result;
    },
    error: function(xhr) {
      // Display the response directly (without transformation)
      return ikats.common.trigger_error_callback(result, xhr, p);
    },
    complete: function(xhr) {
      return ikats.common.trigger_complete_callback(result, xhr, p);
    }
  });

  return ikats.common.async_results_builder(result, p.async, promise);

};

/**
 * Read the parameters of an ingestion session
 *
 *   @param {ikats.common.default_params|number|string=} p_args (see ikats.common.default_params for common parameters)
 *   @param {text} p_args.id Id of the session to get
 *
 *   @return {ikats.common.results}
 */
ikats.api.ingest.session = function(p_args) {

  // Default returned result
  let result = new ikats.common.results();

  // Default parameters
  let p = new ikats.common.default_params();
  p.id = null;

  // Merging with p_args
  p = ikats.common.merge_params(p_args, p);

  // Check missing mandatory parameters
  if (p.id === null) {
    console.error("id must be set");
    // Trigger the callback if defined
    ikats.common.callback(p.error, result);
    return result;
  }
  if (ikats.common.async_check(p) === false) {
    return result;
  }

  // Fire request
  const promise = $.ajax({
    type: "GET",
    url: ikats.constants.URL_Ingestion + "/sessions/" + p.id,
    cache: false,
    contentType: "application/json",
    accepts: "application/json; charset=utf-8",
    async: p.async,
    success: function(data, txt_status, xhr) {
      result.status = true;
      result.status_msg = xhr.statusText;
      result.debug = xhr;
      result.data = data;

      // Trigger the callback if defined
      ikats.common.callback(p.success, result);
      return result;
    },
    error: function(xhr) {
      // Display the response directly (without transformation)
      return ikats.common.trigger_error_callback(result, xhr, p);
    },
    complete: function(xhr) {
      return ikats.common.trigger_complete_callback(result, xhr, p);
    }
  });

  return ikats.common.async_results_builder(result, p.async, promise);

};

/**
 * Get the current status of an ingestion session
 *
 *   @param {ikats.common.default_params|number|string=} p_args (see ikats.common.default_params for common parameters)
 *   @param {text} p_args.id Id of the session to check
 *
 *   @return {ikats.common.results}
 */
ikats.api.ingest.status = function(p_args) {

  // Default returned result
  let result = new ikats.common.results();

  // Default parameters
  let p = new ikats.common.default_params();
  p.id = null;

  // Merging with p_args
  p = ikats.common.merge_params(p_args, p);

  // Check missing mandatory parameters
  if (p.id === null) {
    console.error("id must be set");
    // Trigger the callback if defined
    ikats.common.callback(p.error, result);
    return result;
  }
  if (ikats.common.async_check(p) === false) {
    return result;
  }

  // Fire request
  const promise = $.ajax({
    type: "GET",
    url: ikats.constants.URL_Ingestion + "/sessions/" + p.id + "/stats",
    cache: false,
    contentType: "application/json",
    dataType: "json",
    async: p.async,
    success: function(data, txt_status, xhr) {
      result.status = true;
      result.status_msg = xhr.statusText;
      result.debug = xhr;
      result.data = data;

      // Trigger the callback if defined
      ikats.common.callback(p.success, result);
      return result;
    },
    error: function(xhr) {
      // Display the response directly (without transformation)
      return ikats.common.trigger_error_callback(result, xhr, p);
    },
    complete: function(xhr) {
      return ikats.common.trigger_complete_callback(result, xhr, p);
    }
  });

  return ikats.common.async_results_builder(result, p.async, promise);

};

// Allow bundles from contributions to access Ikats API through window object
window.ikats = ikats;
