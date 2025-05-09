import SockJS from "../modules/sockjs-client/index.js";
import { log } from "../utils/log.js";

export default class SockJSClient {
  constructor(url) {
    this.sock = new SockJS(
      url.replace(/^ws:/i, "http:").replace(/^wss:/i, "https:")
    );
    this.sock.onerror =
      (error) => {
        log.error(error);
      };
  }

  onOpen(f) {
    this.sock.onopen = f;
  }

  onClose(f) {
    this.sock.onclose = f;
  }

  onMessage(f) {
    this.sock.onmessage =
      (e) => {
        f(e.data);
      };
  }
}
