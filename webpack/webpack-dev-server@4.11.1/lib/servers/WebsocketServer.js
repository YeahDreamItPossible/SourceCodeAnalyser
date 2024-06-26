"use strict";

const WebSocket = require("ws");
const BaseServer = require("./BaseServer");

module.exports = class WebsocketServer extends BaseServer {
  static heartbeatInterval = 1000;

  constructor(server) {
    super(server);

    const options = {
      .../** @type {WebSocketServerConfiguration} */
      (this.server.options.webSocketServer).options,
      clientTracking: false,
    };
    const isNoServerMode =
      typeof options.port === "undefined" &&
      typeof options.server === "undefined";

    if (isNoServerMode) {
      options.noServer = true;
    }

    this.implementation = new WebSocket.Server(options);

    (this.server.server).on(
      "upgrade",
      /**
       * @param {import("http").IncomingMessage} req
       * @param {import("stream").Duplex} sock
       * @param {Buffer} head
       */
      (req, sock, head) => {
        if (!this.implementation.shouldHandle(req)) {
          return;
        }

        this.implementation.handleUpgrade(req, sock, head, (connection) => {
          this.implementation.emit("connection", connection, req);
        });
      }
    );

    this.implementation.on(
      "error",
      /**
       * @param {Error} err
       */
      (err) => {
        this.server.logger.error(err.message);
      }
    );

    const interval = setInterval(() => {
      this.clients.forEach(
        /**
         * @param {ClientConnection} client
         */
        (client) => {
          if (client.isAlive === false) {
            client.terminate();

            return;
          }

          client.isAlive = false;
          client.ping(() => {});
        }
      );
    }, WebsocketServer.heartbeatInterval);

    this.implementation.on(
      "connection",
      /**
       * @param {ClientConnection} client
       */
      (client) => {
        this.clients.push(client);

        client.isAlive = true;

        client.on("pong", () => {
          client.isAlive = true;
        });

        client.on("close", () => {
          this.clients.splice(this.clients.indexOf(client), 1);
        });
      }
    );

    this.implementation.on("close", () => {
      clearInterval(interval);
    });
  }
};
