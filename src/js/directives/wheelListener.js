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
 * Listen mouse wheel events and permits callbacks according "direction" (up/down)
 * @class ikats_HMI.Directives.wheelListener
 * @memberOf ikats_HMI.Directives
 */
angular.module("ikatsapp.directives").directive("wheelListener", function () {
    return function (scope, element, attrs) {
        element.bind("mousewheel wheel", function (event) {
            let direction = attrs.wheelup;
            if (event.originalEvent.deltaY >= 0) {
                direction = attrs.wheeldown;
            }
            scope.$apply(function () {
                scope.$eval(direction);
            });
            if (event.preventDefault) {
                event.preventDefault();
            }
        });
    };
});
