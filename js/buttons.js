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

// Modules for config management.

// Module for network hook calls.
const { ipcRenderer } = require('electron');
const remote = require('@electron/remote');
const interface = remote.require("./modules/interface.js");
const logger = remote.require("./modules/runtime_logging.js");

// Retrieving server connection buttons.
const btnConnect = document.getElementById('serverConnect');
const btnDisconnect = document.getElementById('serverDisconnect');
const ipInput = document.getElementById("ipInput");
const portInput = document.getElementById("portInput");

// Retrieving ignition buttons.
const btnIgnition = document.getElementById('btnIgnition');
const btnStopIgnition = document.getElementById('btnStopIgnition');

/**
 * The callback interval object, calling regularly on countdown.
 * To stop countdown, this interval can be cleared.
 */
let interval = null;
/**
 * The current ignition timer. 
 * Is null if there is no ignition process going on.
 * Is negative before the ignition start, and positive after.
 */
let ignitionTimer = null;

// BTN: Connect
btnConnect.addEventListener('click', (_event) => {
    ipcRenderer.send('connectTcp', {
        port: portInput.value,
        ip: ipInput.value
    });
});

// BTN: Disconnect
btnDisconnect.addEventListener('click', (_event) => {
    ipcRenderer.send('destroyTcp', {});
});

// BTN: Ignition
btnIgnition.addEventListener('click', (_event) => {
    startIgnitionCountdown();
});

// BTN: Anti-Ignition
btnStopIgnition.addEventListener('click', function (event) {
    endIgnitionCountdown();
    ipcRenderer.send('sendTcp', { "type": "EmergencyStop" });
});

interface.emitter.on("status", (state) => {
    btnIgnition.disabled = !state;
    btnStopIgnition.disabled = !state;
    btnDisconnect.disabled = !state;
});

/**
 * Begin the ignition countdown process.
 * Will be a no-op if the ignition countdown is currently happening.
 */
function startIgnitionCountdown() {
    if (ignitionTimer == null) {
        // do not double-ignite

        ignitionTimer = -10;

        interval = setInterval(() => {
            logger.log.warn("" + ignitionTimer + " seconds until ignition");

            if (ignitionTimer == 0) {
                // send ignition message to dashboard
                logger.log.warn("Igniting.")
                ipcRenderer.send('sendTcp', { "type": "Ignition" });
                endIgnitionCountdown();
            }
            else {
                ignitionTimer += 1;
            }
        }, 1000);
    }
}

/**
 * Stop the ignition countdown timer. 
 * Will be a no-op if the ignition countdown is not currently happening.
 */
function endIgnitionCountdown() {
    if (interval != null) {
        clearInterval(interval);
    }
    ignitionTimer = null;
}