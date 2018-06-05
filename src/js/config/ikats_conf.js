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
 * Possible running modes
 * @type {{DEBUG: number, PROD: number}}
 */
IKATS_MODES = {
    // Debugging mode (verbose information in code + additional control structures)
    DEBUG: 0,
    // Production mode
    PROD: 1
};

// Family name containing all the developers useful operators
window.DEVELOPER_FAMILY = "Developers";

// Ikats Debug mode Flag
window.CURRENT_IKATS_MODE = IKATS_MODES.PROD;

/**
 * Activate / Deactivate the debugging mode
 * If no parameter is given, just print the current debug state
 * @param activate set to true to activate the debug mode, false otherwise
 */
window.debug = function (activate) {
    if (activate === undefined || activate === null) {
        console.info("Debug mode is " + (window.CURRENT_IKATS_MODE === IKATS_MODES.DEBUG && "ON" || "OFF"));
    }
    else {
        if (activate === true) {
            window.CURRENT_IKATS_MODE = IKATS_MODES.DEBUG;
            console.info("Activated debug mode.");
        } else {
            window.CURRENT_IKATS_MODE = IKATS_MODES.PROD;
            console.info("Deactivated debug mode.");
        }
    }
};

/**
 * Return true if debug mode is active
 * Used for scripts to simplify the conditions
 * @returns {boolean}
 */
window.isInDebug = function () {
    return window.CURRENT_IKATS_MODE === IKATS_MODES.DEBUG;
};
