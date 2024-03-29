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

/*
Implemnetation of the interface between the dashboard and the slonk server, via TCP.
*/

const net = require('net');
const EventEmitter = require('events');
const logger = require("./runtime_logging");

const tcpClient = new net.Socket();

/**
 * The message we're getting from the controller.
 * We'll build up this buffer until we have something that can be parsed as a JSON object, and then
 * empty the buffer again.
 */
let msg_buf = "";

module.exports = {
	/**
	 * The currently active configuration.
	 * This will be updated with a new object whenever we receive a configuration message.
	 * 
	 * At the start of program execution, `config` will be `null`.
	 * For a description of the keys and values in `config`, refer to the API specification.
	 */
	config: null,
	/**
	 * Whether there is currently an active TCP connection to a controller.
	 */
	tcpConnected: false,
	/**
	 * The event emitter for TCP.
	 * Sends out events based on the goings-on of the current TCP connection.
	 * 
	 * # Events
	 * 
	 * - `status`: `bool` - Emitted every time the TCP connection status has changed.
	 * 	Emits `false` after disconnection and `true` after connection.
	 * - `config`: `object` - Emitted every time a new `Configuration` message is received from the 
	 * 	controller. 
	 * 	The attached object is the new configuration (see the API specification for its keys and 
	 * 	values).
	 * 	Used to overwrite the current configuration.
	 * - `sensor_value`: `object` - Emitted every time a new `SensorValue` message is received from
	 * 	the controller. 
	 * 	The attached object is the message received as-is.
	 * - `driver_value`: `object` - Emitted every time a new `DriverValue` message is received from
	 * 	the controller.
	 * 	The attached object is the message received as-is.
	 */
	emitter: new EventEmitter(),
	/**
	 * Connect to a `slonk` controller instance at a given address.
	 * This function is a no-op if the current TCP client is already connected (i.e. if 
	 * `tcpConnected` is `false`).
	 * 
	 * @param {*} port The port to connect on.
	 * @param {*} ip The IP address of the controller instants to connect to.
	 */
	connectTcp: function (port, ip) {

		module.exports.destroyTcp();

		// Don't bother connecting if TCP is already running.

		logger.log.info("Connecting to " + ip + ":" + port);

		tcpClient.connect(port, ip);
		
		// Server expects to immediately receive the time in s since Unix Epoch
		// const d = new Date;
		// let date = d.getTime();
		// tcpClient.write(date.toString());
	},
	/**
	 * Send a command to the `slonk` controller.
	 * 
	 * @param {object} command The object to be sent to the server.
	 */
	sendTcp: function (command) {
		let command_str = JSON.stringify(command)
		logger.log.info("Sent command " + command_str + " to controller.");
		tcpClient.write(command_str);
	},
	/**
	 * Destroy the currently active TCP connection.
	 * 
	 * This function will do nothing if there is no TCP connection.
	 */
	destroyTcp: function () {
		if (module.exports.tcpConnected) {
			tcpClient.destroy();
		}
	}
};

/**
 * Try to extract the first JSON object from a buffer.
 * @param {string} buf The buffer to extract a JSON from
 * @return {str|null} A str which is possibly JSON made from buf, or `null` if no such substring exists.
 */
function try_extract_json(buf) {
	let sub_buf = "";
	let in_string = false;
	let depth = 0;
	let backslashed = false;
	for (c of buf) {
		sub_buf += c;
		switch (c) {
			case '{':
				if (!in_string) {
					depth++;
				}
				break;
			case '}':
				if (!in_string) {
					if (depth == 0) {
						throw "extra closing brace";
					}
					depth--;
					if (depth == 0) {
						return sub_buf;
					}
				}
				break;
			case '"':
				in_string ^= !backslashed;
				break;
		}
		backslashed = c == '\\' && !backslashed;
	}

	return null;
}

function processMessage(message) {
	switch (message.type) {
		case "Config":
			logger.log.info("Received new configuration from dashboard.");
			module.exports.config = message.config;
			module.exports.emitter.emit("config", message.config);
			break;
		case "SensorValue":
			// don't log that we received a sensor value since we get a lot of them.
			module.exports.emitter.emit("sensorValue", message);
			break;
		case "DriverValue":
			// don't log that we received a driver value since we get a lot of them.
			module.exports.emitter.emit("driverValue", message);
			break;
		default:
			logger.log.error("Unrecognized message type " + JSON.stringify(message));
			break;
	}
}

tcpClient.on('data', function (text) {
	// We just received some data from the controller.
	// Send that information down the correct pipeline using the emitter.

	msg_buf += text;
	json_str = try_extract_json(msg_buf);
	if (json_str != null) {
		msg_buf = msg_buf.slice(json_str.length);
		message_list = JSON.parse(json_str);
		if (message_list.tcs) {
			processMessage(message_list.tcs);
			processMessage(message_list.lcs);
			processMessage(message_list.pts);
			processMessage(message_list.driver);
		} else {
			processMessage(message_list);
		}
	}
});

tcpClient.on('close', function (data) {
	/*
	Emitted when TCP client is disconnected.
	*/
	logger.log.info("Connection to controller closed.");
	module.exports.tcpConnected = false;
	module.exports.emitter.emit("status", false);
});

tcpClient.on('connect', function () {
	/*
	Emitted when TCP client connects to the server.
	*/
	logger.log.info("Connection established to controller.");
	module.exports.tcpConnected = true;
	module.exports.emitter.emit("status", true);
});

tcpClient.on('error', function (err) {
	if (err.code == 'ECONNREFUSED') {
		logger.log.warn(`Controller server could not be reached on ${err.address}:${err.port}`);
	}
});