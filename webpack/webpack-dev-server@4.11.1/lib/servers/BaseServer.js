"use strict";

// 最基础的服务器
module.exports = class BaseServer {
  constructor(server) {
    this.server = server;

    this.clients = [];
  }
};
