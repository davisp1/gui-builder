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
 * Toastr access from outside angular context
 *
 * @returns {*}
 */
function notify() {
    return angular.element("body").scope().wfCtrl.toastr;
}

/**
 * copy the content of a div to the clipboard
 * @param div div reference to copy from
 */
function copyToClipboard(div) {
    const $temp = $("<input>");
    $("body").append($temp);
    $temp.val(div.text()).select();
    document.execCommand("copy");
    $temp.remove();
}


/**
 * Return if the HTTP status code is 2xx (within [200;300[)
 * @param status
 */
function is2xx(status) {
    return (status >= 200 && status < 300);
}

/**
 * Return if the HTTP status code is 4xx (within [400;500[)
 * @param status
 */
function is4xx(status) {
    return (status >= 400 && status < 500);
}

/**
 * Return if the HTTP status code is 5xx (within [500;600[)
 * @param status
 */
function is5xx(status) {
    return (status >= 500 && status < 600);
}


/**
 * Test if argument is an Object
 *
 * @param {*} obj the item to check
 * @return {boolean} true if the item <obj> is really an object like {}
 */
function isObject(obj) {
    return Object.prototype.toString.call(obj) === "[object Object]";
}

/**
 * Test if argument is an Array
 *
 * @param {*} obj the item to check
 * @return {boolean} true if the item <obj> is really an array like []
 */
function isArray(obj) {
    return Object.prototype.toString.call(obj) === "[object Array]";
}

/**
 * Test if argument is a number
 *
 * @param {*} obj the item to check
 * @return {boolean} true if the item <obj> is really a number
 */
function isNumber(obj) {
    return Object.prototype.toString.call(obj) === "[object Number]";
}

/**
 * Test if argument is a function
 *
 * @param {*} obj the item to check
 * @return {boolean} true if the item <obj> is really a function
 */
function isFunction(obj) {
    return Object.prototype.toString.call(obj) === "[object Function]";
}


/**
 * In an array of object, returns all objects having its key = value
 *
 * @param {Array} arr Array to find item in
 * @param {string} key key to compare
 * @param {*} value value of the key to match
 *
 * @return {Array}
 */
function ObjFromArray(arr, key, value) {
    return $.grep(arr, function (e) {
        return e[key] === value;
    });
}

/**
 * Capitalize the first letter of each word in string
 *
 * @param {string} s string to capitalize
 * @returns {string} capitalized string
 */
function capitalize(s) {
    return s.toLowerCase()
        .replace(/^.|[\s\-\/]\S/g, function (str) {
            return str.toUpperCase();
        });
}

/**
 * Clone an object with all attributes
 *
 * @param {*} obj Original object to clone
 * @return {*} cloned object
 */
function cloneObj(obj) {
    const func_name = cloneObj;
    let copy;

    //TODO return "" instead of true for bool
    //obj = obj && obj instanceof Object ? obj : '';

    // Handle Date (return new Date object with old value)
    if (obj instanceof Date) {
        return new Date(obj);
    }

    // Handle Array (return a full slice of the array)
    if (obj instanceof Array) {
        copy = [];
        for (let i = 0; i < obj.length; i++) {
            copy.push(func_name(obj[i]));
        }
        return copy;
    }
    // Handle Functions (return a full slice of the array)
    if (obj instanceof Function) {
        return obj;
    }

    // Handle Object
    if (obj instanceof Object) {
        copy = new obj.constructor();
        for (let attr in obj) {
            if (obj.hasOwnProperty(attr)) {
                // Prevents from too many circular recursive copy
                if (attr !== "parent") {
                    copy[attr] = func_name(obj[attr]);
                }
                else {
                    copy[attr] = null;
                }
            }
        }
        return copy;
    }

    return obj;
}

/**
 * Select the currently selected node
 * @returns {NODE}
 */
function node() {
    return angular.element("body").scope().wfCtrl.focusedNode.data;
}

/**
 * Select a node by providing its id
 * @param {Number} id identifier of the node
 * @return {Node} the node
 */
function nodeById(id) {
    return $.grep(angular.element("body").scope().wfCtrl.chartViewModel.nodes, function (x) {
        return x.data.id === id;
    });
}

/**
 * Get the nodes list
 *
 * @return {NODE[]} List of nodes
 */
function nodes() {
    return angular.element("body").scope().wfCtrl.chartViewModel.nodes.map(x => x.data);
}

/**
 * Get the connections list
 *
 * @returns {Array|*}
 */
function connections() {
    return angular.element("body").scope().wfCtrl.chartViewModel.connections.map(function (x) {
        return x.data;
    });
}

/**
 * Check if value is a number
 *
 * @param {*} value value to check
 * @returns {Number|boolean} the integer value, or false if not a number
 */
function filterInt(value) {
    if (/^([-+])?([0-9]+|Infinity)$/.test(value))
        return Number(value);
    return false;
}

/**
 * Max function for arrays
 *
 * @param a array to check
 * @return {number} the value of the maximum item in array
 */
function max(a) {
    let max = -Infinity;
    for (let i = 0; i < a.length; i++) if (a[i] > max) max = a[i];
    return max;
}

/**
 * Min function for arrays
 *
 * @param a array to check
 * @return {number} the value of the minimum item in array
 */
function min(a) {
    let min = Infinity;
    for (let i = 0; i < a.length; i++) if (a[i] < min) min = a[i];
    return min;
}

/**
 * Strip duplicates from array
 *
 * @param {Array} array array to strip
 */
function uniq(array) {
    const hash = {};
    array.forEach(function (item) {
        hash[item] = 1;
    });
    return Object.keys(hash);
}

/**
 * Convert a timestamp (in ms) to a special string
 *
 * Examples of outputs:
 *   - "5min 13s"
 *   - "2h 3s"
 *   - "2d 56min 1s"
 *   - "1s 540ms"
 *
 * @param {number} timestamp value to format (in ms)
 * @return {string} Formatted value
 */
function ms2hms(timestamp) {

    // Get date elements
    // Milliseconds
    const ms = timestamp % 1000;
    // Temporary parser
    let x = parseInt(timestamp / 1000, 10);
    // Seconds
    const s = x % 60;
    x = parseInt(x / 60, 10);
    // Minutes
    const m = x % 60;
    x = parseInt(x / 60, 10);
    // Hours
    const h = x % 24;
    x = parseInt(x / 24, 10);
    // Days
    const d = x;

    // Preparing string
    const msg = [];

    // Do not display if "0 day"
    if (d > 0) {
        msg.push(d + "d");
    }

    // Do not display if "0 hour"
    if (h > 0) {
        msg.push(h + "h");
    }

    // Do not display if "0 minute"
    if (m > 0) {
        msg.push(m + "min");
    }

    // Do not display if "0 second"
    if (s > 0) {
        msg.push(s + "s");
    }

    // Do not display if "0 ms"
    // Display ms only if lesser than 1 minute
    if ((ms > 0) && ( timestamp < 60 * 1000 * 1000)) {
        msg.push(parseInt(ms, 10) + "ms");
    }

    // Concat and return formatted string
    return msg.join(" ");

}

/**
 * Returns the Functional ID from the TSUID provided in argument
 * based on its match with the TS_LIST provided
 *
 * @param ts_list reference list to look for the functional Id
 * @param tsuid TSUID to get FID from
 * @returns {*}
 */
function fidFromTSList(ts_list, tsuid) {
    try {
        return $.grep(ts_list, x => x.tsuid === tsuid)[0].funcId;
    }
    catch (e) {
        console.error("TSUID [" + tsuid + "] not found in ", ts_list, e);
    }
    return "";
}

/**
 * Find a pattern in a text
 *
 * @param pattern pattern to find (accepts wildcard "*")
 * @param source where to look the pattern in
 * @param cs case sensitive flag (default to false: case insensitive)
 * @return {boolean}
 */
function isIn(pattern, source, cs = false) {

    let isInSource = true;

    if (!cs) {
        pattern = pattern.toLowerCase();
        source = source.toLowerCase();
    }
    let startIndex = 0;
    const array = pattern.split("*");
    for (let i = 0; i < array.length; i++) {
        const index = source.indexOf(array[i], startIndex);

        //Handle startsWith
        if ((pattern[0] !== "*") &&
            (i === 0) &&
            (index !== 0)) {
            isInSource = false;
        }
        //Handle EndsWith
        if ((pattern[pattern.length - 1] !== "*") &&
            (i === array.length - 1) &&
            (source.length - index !== array[i].length)) {
            isInSource = false;
        }

        if (index === -1) {
            isInSource = false;
        }
        else startIndex = index;
    }
    return isInSource;
}

/**
 * Add leading characters to number
 *
 * pad(12, 4) --> "0012"
 * pad(12, 3) --> "012"
 * pad(12.2, 2) --> "12.2"
 *
 * @param n the number to pad
 * @param width the total number of characters
 * @param z the padding character (0 by default)
 * @returns {string} the padded number
 */
function pad(n, width, z) {
    z = z || "0";
    n = n + "";
    return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
}

/**
 * Return the value of the metadata name for a specific tsuid from a ikats.api.md.read result
 * @param mdList {Array} List of metadata results
 * @param tsuid {string} TSUID to get metadata for
 * @param mdName {string} Name of the metadata to get
 * @return {*} the value of the metadata
 */
function getMd(mdList, tsuid, mdName) {
    const res = mdList.filter(function (md) {
        return md.name === mdName && md.tsuid === tsuid;
    });
    if (res.length === 0) {
        throw `No metadata named "${mdName}" found in list passed for tsuid "${tsuid}"`;
    }
    return res[0].value;
}
