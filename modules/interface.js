/*
Written by Alp Yakici and Andrew Obler for Rice Eclipse

Creates a class for TCP protocol, which is used to send commands to the engine controller.
Engine does not send any data using TCP protocol; therefore, this is a one way communication.
*/

const net = require('net');
const EventEmitter = require('events');
const logger = require("./runtime_logging");

const tcpClient = new net.Socket();

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

		logger.log.info("Connecting to " + ip + ":" + port + " over TCP.");

		tcpClient.connect(port, ip);
	},
	/**
	 * Send a command to the `slonk` controller.
	 * 
	 * @param {object} command The object to be sent to the server.
	 */
	sendTcp: function (command) {
		let command_str = JSON.stringify(command)
		logger.log.info("Sent command " + command_str + " over TCP.");
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

tcpClient.on('data', function (text) {
	// We just received some data from the controller.
	// Send that information down the correct pipeline using the emitter.

	logger.log.info(text);
	message = JSON.parse(text)
	switch (message.type) {
		case "Configuration":
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
			module_exports.emitter.emit("driverValue", message);
			break;
		default:
			logger.log.error("Unrecognized message type " + message.type);
			break;
	}
});

tcpClient.on('close', function (data) {
	/*
	Emitted when TCP client is disconnected.
	*/
	logger.log.info("Connection closed over TCP.");
	module.exports.tcpConnected = false;
	module.exports.emitter.emit("status", false);
});

tcpClient.on('connect', function () {
	/*
	Emitted when TCP client connects to the server.
	*/
	logger.log.info("Connection established over TCP.");
	module.exports.tcpConnected = true;
	module.exports.emitter.emit("status", true);
});

tcpClient.on('error', function (err) {
	if (err.code == 'ECONNREFUSED') {
		logger.log.warn(`Server could not be reached on ${err.address}:${err.port} over TCP.`);
	}
});