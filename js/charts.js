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
const remote = require('@electron/remote')
const interface = remote.require("./modules/interface");

// Initializing all the variables.
let chartElems = [];
let panelSelects = [];
let panelLabels = [];

for (let i = 0; i < 4; i++) {
    chartElems.push(document.getElementById("chart" + i).getContext("2d"));
    panelSelects.push(document.getElementById("panelSelect" + i));
    panelLabels.push(document.getElementById("panelLabel" + i));
}

// Initializing all the charts.
var charts = []

for (var i = 0; i < 4; i++) {
    charts.push(new Chart(chartElems[i], {
        type: 'line',
        data: {
            datasets: []
        },
        options: {
            legend: {
                display: true,
                labels: {
                    boxWidth: 15
                }
            },
            scales: {
                x: {
                    type: 'realtime'
                },
                y: {
                    ticks: {
                        beginAtZero: true
                    },
                },
                title: {
                    display: true,
                    text: "N/A"
                }
            },
            animation: {
                duration: 0
            },
            hover: {
                animationDuration: 0
            },
            responsiveAnimationDuration: 0,
            plugins: {
                streaming: {
                    frameRate: 15,
                    duration: 60000
                }
            }
        }
    }));
}

/**
 * Reformat a chart with a new sensor group.
 * @param {int} chartid the ID of the chart to be reformatted
 * @param {int} groupId the ID of the group to pull from 
 */
function applySensorGroup(chartid, groupId) {
    var chart = charts[chartid];

    chart.data.datasets = []

    for (sensor of interface.config.sensor_groups[groupId].sensors) {
        chart.data.datasets.push({
            label: sensor.label,
            data: [],
            lineTension: 0,
            fill: false,
            backgroundColor: sensor.color,
            borderColor: sensor.color,
            source_label: sensor.label,
        })

        chart.options.scales.title.text = sensor.units;
    }
    chart.update({
        preservation: true
    });
}

/**
 * Update the charts with a new sensor value.
 * @param {object} message The JSON object for the sensor value message received.
 */
function updateSensorValue(message) {
    let group_cfg = interface.config.sensor_groups[message.group_id];
    for (let i = 0; i < 4; i++) {
        if (panelSelects[i].value == message.group_id) {
            // chart i displays data from the group described in the message.
            for (datum of message.readings) {
                let sensor_cfg = group_cfg.sensors[datum.sensor_id];
                let calibrated_value = sensor_cfg.calibration_slope * datum.reading + sensor_cfg.calibration_intercept;

                let impossible_temperature = sensor_cfg.units == '°F' && calibrated_value < -200;
                let impossible_pressure = sensor_cfg.units == 'psi' && calibrated_value < -200;
                let possible_value = !impossible_temperature && !impossible_pressure;

                if (possible_value) {
                    charts[i].data.datasets[datum.sensor_id].data.push({ x: Date.now(), y: calibrated_value });
                }
            }
            charts[i].update({ preservation: true });
        }
    }
}

for (let i = 0; i < 4; i++) {
    // when things change on the panel selectors, reformat their associated charts
    panelSelects[i].addEventListener('change', () => {
        applySensorGroup(i, panelSelects[i].value)
    });
}
// Watch for chart reformat request.
ipcRenderer.on("applySensorGroup", function (event, data) {
    applySensorGroup(data.chartid, data.panel);
});

interface.emitter.on("sensorValue", updateSensorValue);
