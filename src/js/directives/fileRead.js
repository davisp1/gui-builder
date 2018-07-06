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
 * Open file for reading in input type file parameter
 * @class IKATS_GUI.Directives.fileread
 * @memberOf IKATS_GUI.Directives
 */
angular.module("ikatsapp.directives").directive("fileread", [function () {
    return {
        scope: {
            fileread: "=",
            filename: "="
        },
        link: function (scope, element) {
            element.bind("change", function (changeEvent) {
                let reader = new FileReader();
                reader.onload = function (loadEvent) {
                    scope.$apply(function () {
                        scope.fileread = loadEvent.target.result;
                        console.debug(scope.fileread);
                        scope.filename = changeEvent.target.files[0].name;
                        console.debug("filename ", scope.filename);
                    });
                };
                reader.readAsDataURL(changeEvent.target.files[0]);
            });
        }
    };
}]);
