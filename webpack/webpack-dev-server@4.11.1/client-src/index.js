/* global __resourceQuery, __webpack_hash__ */
/// <reference types="webpack/module" />
import webpackHotLog from "webpack/hot/log.js";
import stripAnsi from "./utils/stripAnsi.js";
import parseURL from "./utils/parseURL.js";
import socket from "./socket.js";
import { formatProblem, show, hide } from "./overlay.js";
import { log, logEnabledFeatures, setLogLevel } from "./utils/log.js";
import sendMessage from "./utils/sendMessage.js";
import reloadApp from "./utils/reloadApp.js";
import createSocketURL from "./utils/createSocketURL.js";

/**
 * @typedef {Object} Options
 * @property {boolean} hot
 * @property {boolean} liveReload
 * @property {boolean} progress
 * @property {boolean | { warnings?: boolean, errors?: boolean, trustedTypesPolicyName?: string }} overlay
 * @property {string} [logging]
 * @property {number} [reconnect]
 */

/**
 * @typedef {Object} Status
 * @property {boolean} isUnloading
 * @property {string} currentHash
 * @property {string} [previousHash]
 */

const status = {
  isUnloading: false,
  currentHash: typeof __webpack_hash__ !== "undefined" ? __webpack_hash__ : "",
};

const options = {
  hot: false,
  liveReload: false,
  progress: false,
  overlay: false,
};
const parsedResourceQuery = parseURL(__resourceQuery);

const enabledFeatures = {
  "Hot Module Replacement": false,
  "Live Reloading": false,
  Progress: false,
  Overlay: false,
};

// "./node_modules/webpack-dev-server/client/index.js?protocol=ws%3A&hostname=0.0.0.0&port=9527&pathname=%2Fws&logging=info&overlay=true&reconnect=10&hot=true&live-reload=true"
// __resourceQuery = "?protocol=ws%3A&hostname=0.0.0.0&port=9527&pathname=%2Fws&logging=info&overlay=true&reconnect=10&hot=true&live-reload=true"
if (parsedResourceQuery.hot === "true") {
  options.hot = true;
  enabledFeatures["Hot Module Replacement"] = true;
}

if (parsedResourceQuery["live-reload"] === "true") {
  options.liveReload = true;
  enabledFeatures["Live Reloading"] = true;
}

if (parsedResourceQuery.progress === "true") {
  options.progress = true;
  enabledFeatures.Progress = true;
}

if (parsedResourceQuery.overlay) {
  try {
    options.overlay = JSON.parse(parsedResourceQuery.overlay);
  } catch (e) {
    log.error("Error parsing overlay options from resource query:", e);
  }

  // Fill in default "true" params for partially-specified objects.
  if (typeof options.overlay === "object") {
    options.overlay = {
      errors: true,
      warnings: true,
      ...options.overlay,
    };
  }
  enabledFeatures.Overlay = true;
}

if (parsedResourceQuery.logging) {
  options.logging = parsedResourceQuery.logging;
}

if (typeof parsedResourceQuery.reconnect !== "undefined") {
  options.reconnect = Number(parsedResourceQuery.reconnect);
}

/**
 * @param {string} level
 */
function setAllLogLevel(level) {
  // This is needed because the HMR logger operate separately from dev server logger
  webpackHotLog.setLogLevel(
    level === "verbose" || level === "log" ? "info" : level
  );
  setLogLevel(level);
}

if (options.logging) {
  setAllLogLevel(options.logging);
}

logEnabledFeatures(enabledFeatures);

self.addEventListener("beforeunload", () => {
  status.isUnloading = true;
});

const onSocketMessage = {
  hot() {
    if (parsedResourceQuery.hot === "false") {
      return;
    }

    options.hot = true;
  },
  liveReload() {
    if (parsedResourceQuery["live-reload"] === "false") {
      return;
    }

    options.liveReload = true;
  },
  invalid() {
    log.info("App updated. Recompiling...");

    // Fixes #1042. overlay doesn't clear if errors are fixed but warnings remain.
    if (options.overlay) {
      hide();
    }

    sendMessage("Invalid");
  },
  hash(hash) {
    status.previousHash = status.currentHash;
    status.currentHash = hash;
  },
  logging: setAllLogLevel,
  overlay(value) {
    if (typeof document === "undefined") {
      return;
    }

    options.overlay = value;
  },
  reconnect(value) {
    if (parsedResourceQuery.reconnect === "false") {
      return;
    }

    options.reconnect = value;
  },
  progress(value) {
    options.progress = value;
  },
  "progress-update": function progressUpdate(data) {
    if (options.progress) {
      log.info(
        `${data.pluginName ? `[${data.pluginName}] ` : ""}${data.percent}% - ${
          data.msg
        }.`
      );
    }

    sendMessage("Progress", data);
  },
  "still-ok": function stillOk() {
    log.info("Nothing changed.");

    if (options.overlay) {
      hide();
    }

    sendMessage("StillOk");
  },
  ok() {
    sendMessage("Ok");

    if (options.overlay) {
      hide();
    }

    reloadApp(options, status);
  },
  "content-changed": function contentChanged(file) {
    log.info(
      `${
        file ? `"${file}"` : "Content"
      } from static directory was changed. Reloading...`
    );

    self.location.reload();
  },
  "static-changed": function staticChanged(file) {
    log.info(
      `${
        file ? `"${file}"` : "Content"
      } from static directory was changed. Reloading...`
    );

    self.location.reload();
  },
  warnings(warnings, params) {
    log.warn("Warnings while compiling.");

    const printableWarnings = warnings.map((error) => {
      const { header, body } = formatProblem("warning", error);

      return `${header}\n${stripAnsi(body)}`;
    });

    sendMessage("Warnings", printableWarnings);

    for (let i = 0; i < printableWarnings.length; i++) {
      log.warn(printableWarnings[i]);
    }

    const needShowOverlayForWarnings =
      typeof options.overlay === "boolean"
        ? options.overlay
        : options.overlay && options.overlay.warnings;

    if (needShowOverlayForWarnings) {
      const trustedTypesPolicyName =
        typeof options.overlay === "object" &&
        options.overlay.trustedTypesPolicyName;
      show("warning", warnings, trustedTypesPolicyName || null);
    }

    if (params && params.preventReloading) {
      return;
    }

    reloadApp(options, status);
  },
  errors(errors) {
    log.error("Errors while compiling. Reload prevented.");

    const printableErrors = errors.map((error) => {
      const { header, body } = formatProblem("error", error);

      return `${header}\n${stripAnsi(body)}`;
    });

    sendMessage("Errors", printableErrors);

    for (let i = 0; i < printableErrors.length; i++) {
      log.error(printableErrors[i]);
    }

    const needShowOverlayForErrors =
      typeof options.overlay === "boolean"
        ? options.overlay
        : options.overlay && options.overlay.errors;

    if (needShowOverlayForErrors) {
      const trustedTypesPolicyName =
        typeof options.overlay === "object" &&
        options.overlay.trustedTypesPolicyName;
      show("error", errors, trustedTypesPolicyName || null);
    }
  },
  error(error) {
    log.error(error);
  },
  close() {
    log.info("Disconnected!");

    if (options.overlay) {
      hide();
    }

    sendMessage("Close");
  },
};

const socketURL = createSocketURL(parsedResourceQuery);

socket(socketURL, onSocketMessage, options.reconnect);
