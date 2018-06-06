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
 * Unordered library of all available VizTools
 * should list object of format :
 * {
 *  name:'name', - name of the VizTool
 *  types:['type1','type2','type3'], - list of compatible data types
 *  classRef:Class - ClassName of the implementation of VizTool
 *  context:['specific_context_1','specific_context_2'] - The list of contextual data to grant the file access to (Only 'inputs' and 'parameters' are currently supported)
 *  debugModeOnly:bool, - Define if the viztool is only available in Debug mode (true) or not (false)
 *  keyMap:{"key1":"def of action 1","key2":"def of action 2","mouseEvt1":"def of action 3"}, - Dictionnary of "event":"action description"
 *  desc:'description', - textual description of VizTool
 * }
 * @file
 * @type {Array}
 */
VizToolsLibrary = [
/* inject:json */
/* endinject */
];
