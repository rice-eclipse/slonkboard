/******************************************************************************
 * This file deals with reading data from UDP datagrams received from the Pi.
 *
 * Each datagram consists of an 8-byte header, which contains the type and
 * number of data payloads being sent, followed by a series of 16-byte
 * payloads, which each contains a datapoint and a timestamp. The datapoint is
 * the actual numeric reading (e.g. from a load cell), while the timestamp is
 * the time at which the data was sent.
 *
 * On the local server created by final_mocked (see the engine controller
 * code), these numbers are slightly different. The header, for example, is 16
 * bytes long instead. Other details are explained in the code itself.
 *
 * Note that byte order is always little endian throughout the code.
 *****************************************************************************/

module.exports = {
    /**
     * Formats the input microsecond timestamp nicely (hours:minutes:seconds).
     * Seconds is truncated to 3 decimal places.
     *
     * @param {number} timestamp a numeric timestamp in microseconds
     * @return {string} a string with the formatted time
     */
    formatTimestamp: function(timestamp) {
        let hours = Math.floor(timestamp / 3600000000);
        let minutes = Math.floor(timestamp / 60000000) - hours * 60;
        let seconds = timestamp / 1000000.0 - hours * 3600 - minutes * 60;
        return (hours < 10 ? "0" + hours : hours.toString()) + ":" +
               (minutes < 10 ? "0" + minutes : minutes.toString()) + ":" +
               (seconds < 10 ? "0" + seconds.toFixed(3) : seconds.toFixed(3));
    },

    /**
     * Reads the header and payloads from the given UDP datagram.
     * 
     * @param {Buffer} msg the datagram to be decoded
     * @param {Object} rinfo corresponding rinfo object
     * @param {boolean} using_mocked whether to use the mock server format
     * @return {Array} if successful, a pair of the form
     *                 [[type, number],
     *                  [[data1, time_lower1, time_upper1],
     *                   [data2, time_lower2, time_upper2], ...]], i.e. the
     *                 results of readHeader and readPayloads bundled;
     *                 if unsuccessful, an empty array
     */
    decode: function(msg, rinfo, using_mocked) {
        let decoded = [];
        let header = exports.readHeader(msg, rinfo, using_mocked);
        if (!header) {
            console.log("[ERROR] Could not decode header");
            return [];
        }
        decoded.push(header);
        let payloads = exports.readPayloads(msg, rinfo, header[1], using_mocked);
        if (!payloads) {
            console.log("[ERROR] Could not decode payloads");
            return [];
        }
        decoded.push(payloads);
        return decoded;
    },

    /**
     * Reads the type and number from the header of the given datagram.
     * 
     * @param {Buffer} msg the datagram to be read
     * @param {Object} rinfo corresponding rinfo object
     * @param {boolean} using_mocked whether to use the mock server header format
     * @return {number[]} if successful, an array of the form [type, number];
     *                    otherwise, an empty array
     */
    readHeader: function(msg, rinfo, using_mocked) {
        let msg_size = rinfo.size; // size of msg in bytes
        let expected_size;
        let number_offset; // starting index of number in msg
        if (using_mocked) {
            // Header format: type (1 byte), padding (7 bytes),
            // number (4 bytes), padding (4 bytes)
            expected_size = 16;
            number_offset = 8;
        } else {
            // Header format: type (1 byte), padding (3 bytes),
            // number (4 bytes)
            expected_size = 8;
            number_offset = 4;
        }
        if (msg_size < expected_size) {
            console.log("[ERROR] Packet is too short to read header!");
            return [];
        }
        let type = msg.readUInt8(0);
        let number = msg.readUInt32LE(number_offset);
        return [type, number];
    },

    /**
     * Reads the payloads (pairs of data and timestamp) from a datagram. If not
     * all payloads could be read, reads as many as are present in the
     * datagram.
     * 
     * @param {Buffer} msg the datagram, including header
     * @param {Object} rinfo corresponding rinfo object
     * @param {number} number the number from the header
     * @param {boolean} using_mocked whether to use the mock server format
     * @return {number[][]} if successful, an array of the form
     *                      [[data1, time_lower1, time_upper1],
     *                       [data2, time_lower2, time_upper2],
     *                       ...]; if no payloads could be read, an empty array
     */
    readPayloads: function(msg, rinfo, number, using_mocked) {
        // Payload format: data (2 bytes), padding (6 bytes),
        // timestamp (8 bytes)
        let msg_size = rinfo.size;
        let header_size = using_mocked ? 16 : 8;
        if (msg_size < header_size + 16) {
            console.log("[ERROR] Packet is too short to read any payloads");
            return [];
        }
        let offset = header_size; // offset into msg
        let payloads = [];
        // Try to read number payloads, and stop early if the msg is truncated
        for (let i = 0; i < number; i++) {
            if (msg_size - offset < 16) {
                console.log("[ERROR] Packet is truncated, can only read " + payloads.length + " payloads");
                break;
            }
            let data = msg.readUInt16LE(offset);
            // NOTE: timestamp is a 64-bit long. JS doesn't support longs
            // natively, so we're splitting the timestamp into two 32-bit
            // halves (lower bits and upper bits) for combination later.
            // TODO: use a BigDecimal equivalent?
            let time_lower = msg.readUInt32LE(offset + 8);
            let time_upper = msg.readUInt32LE(offset + 12);
            payloads.push([data, time_lower, time_upper]);
            offset += 16; // move to next payload
        }
        if (offset < msg_size) {
            console.log("[WARNING] Leftover data in packet");
        }
        return payloads;
    }
}