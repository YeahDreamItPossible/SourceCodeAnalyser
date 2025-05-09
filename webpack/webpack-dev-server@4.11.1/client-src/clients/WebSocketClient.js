import { log } from "../utils/log.js";

export default class WebSocketClient {
  constructor(url) {
    this.client = new WebSocket(url);
    this.client.onerror = (error) => {
      log.error(error);
    };
  }

  onOpen(f) {
    this.client.onopen = f;
  }

  onClose(f) {
    this.client.onclose = f;
  }

  onMessage(f) {
    this.client.onmessage = (e) => {
      f(e.data);
    };
  }
}
