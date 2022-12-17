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

const winston = require('winston');
const EventEmitter = require('events');

module.exports = {
    emitter: new EventEmitter(),
    log: winston.createLogger({
        format: winston.format.combine(
            winston.format.timestamp({
                format: 'YYYY-MM-DD HH:mm:ss'
            }),
            winston.format.printf(info => `${info.timestamp} [${info.level.toUpperCase()}]: ${info.message}`)
        ),
        defaultMeta: { service: 'slonkboard-service' },
        transports: [
            //
            // - Write to all logs with level `info` and below to `combined.log` 
            // - Write all logs error (and below) to `error.log`.
            //
            new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
            new winston.transports.File({ filename: 'logs/combined.log' }).on('logged', (info) => {
                module.exports.emitter.emit("log", info);
            }),
            new winston.transports.Console()
        ]
    })
};