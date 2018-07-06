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
 * @file This file boostraps the application
 */

/**
 * Definition of the angular application ikatsapp
 * @namespace IKATS_GUI
 */

/**
 * @class IKATS_GUI.Controllers
 * @memberOf IKATS_GUI
 */
angular.module('ikatsapp.controllers', []);

/**
 * @class IKATS_GUI.Filters
 * @memberOf IKATS_GUI
 */
angular.module("ikatsapp.filters", []);

/**
 * @class IKATS_GUI.Config
 * @memberOf IKATS_GUI
 */
angular.module("ikatsapp.config", []);

/**
 * @class IKATS_GUI.Directives
 * @memberOf IKATS_GUI
 */
angular.module("ikatsapp.directives", []);

angular.module("ikatsapp", ["flowChart", "ui.tree", "toggle-switch", "720kb.datepicker", "ngDragDrop", "ui.bootstrap", "ngAnimate", "toastr", "slide", "ikatsapp.controllers", "ikatsapp.filters", "ikatsapp.config", "ikatsapp.directives"]);
