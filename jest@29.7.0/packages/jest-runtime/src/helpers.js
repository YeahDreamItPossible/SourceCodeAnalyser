"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findSiblingsWithFileExtension = exports.decodePossibleOutsideJestVmPath = exports.createOutsideJestVmPath = void 0;
var path = require("path");
var glob = require("glob");
var slash = require("slash");
var OUTSIDE_JEST_VM_PROTOCOL = 'jest-main:';
// String manipulation is easier here, fileURLToPath is only in newer Nodes,
// plus setting non-standard protocols on URL objects is difficult.
var createOutsideJestVmPath = function (path) {
  return "".concat(OUTSIDE_JEST_VM_PROTOCOL, "//").concat(encodeURIComponent(path));
};
exports.createOutsideJestVmPath = createOutsideJestVmPath;
var decodePossibleOutsideJestVmPath = function (outsideJestVmPath) {
  if (outsideJestVmPath.startsWith(OUTSIDE_JEST_VM_PROTOCOL)) {
    return decodeURIComponent(outsideJestVmPath.replace(new RegExp("^".concat(OUTSIDE_JEST_VM_PROTOCOL, "//")), ''));
  }
  return undefined;
};
exports.decodePossibleOutsideJestVmPath = decodePossibleOutsideJestVmPath;
var findSiblingsWithFileExtension = function (moduleFileExtensions, from, moduleName) {
  if (!path.isAbsolute(moduleName) && path.extname(moduleName) === '') {
    var dirname = path.dirname(from);
    var pathToModule = path.resolve(dirname, moduleName);
    try {
      var slashedDirname_1 = slash(dirname);
      var matches = glob
        .sync("".concat(pathToModule, ".*"))
        .map(function (match) { return slash(match); })
        .map(function (match) {
          var relativePath = path.posix.relative(slashedDirname_1, match);
          return path.posix.dirname(match) === slashedDirname_1
            ? "./".concat(relativePath)
            : relativePath;
        })
        .map(function (match) { return "\t'".concat(match, "'"); })
        .join('\n');
      if (matches) {
        var foundMessage = "\n\nHowever, Jest was able to find:\n".concat(matches);
        var mappedModuleFileExtensions = moduleFileExtensions
          .map(function (ext) { return "'".concat(ext, "'"); })
          .join(', ');
        return ("".concat(foundMessage, "\n\nYou might want to include a file extension in your import, or update your 'moduleFileExtensions', which is currently ") +
          "[".concat(mappedModuleFileExtensions, "].\n\nSee https://jestjs.io/docs/configuration#modulefileextensions-arraystring"));
      }
    }
    catch (_a) { }
  }
  return '';
};
exports.findSiblingsWithFileExtension = findSiblingsWithFileExtension;
