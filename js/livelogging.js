/*
  slonkboard, a frontend dashboard for rocket controllers.
  Copyright (C) 2022 Rice Eclipse.

  slonkboard is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  slonkboard is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

// Module for network hook calls.
const { ipcRenderer } = require('electron');

module.exports = {
    log: function (timestamp, level, message) {
        const logs = document.getElementById("logs");
        if (timestamp != "" && level != "") {
            logs.innerHTML += `${timestamp} : [${level}] ${message}<br>`;
        } else {
            logs.innerHTML += `${message}<br>`;
        }
        logs.scrollTop = logs.scrollHeight;
    }
}

ipcRenderer.on('log', (event, arg) => {

    let level = ""
    if (arg.level == "info") {
        level = `<span style="color:green;">INFO</span>`
    } else if (arg.level == "error") {
        level = `<span style="color:red;">ERROR</span>`
    } else if (arg.level == "warn") {
        level = `<span style="color:yellow;">WARN</span>`
    } else {
        level = arg.level
    }

    module.exports.log(arg.timestamp, level, arg.message);
});