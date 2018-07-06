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
 * @file Defines filter converting ms durations to formated XXXh XXmin XXs
 */

/**
 * Filter to convert raw date (in ms) to format like "2h 5min 45s"
 * @class IKATS_GUI.Filters.ms2hms
 * @memberOf IKATS_GUI.Filters
 */
angular.module("ikatsapp.filters").filter("ms2hms", function () {
    return function (input) {
        input = input || 0;
        return ms2hms(input);
    };
});
