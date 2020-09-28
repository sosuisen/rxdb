"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.overwritable = void 0;

var _util = require("./util");

/**
 * functions that can or should be overwritten by plugins
 */
var overwritable = {
  /**
   * if this method is overwritte with one
   * that returns true, we do additional checks
   * which help the developer but have bad performance
   */
  isDevMode: function isDevMode() {
    return false;
  },

  /**
   * validates if a password can be used
   * @overwritten by plugin (optional)
   * @throws if password not valid
   */
  validatePassword: function validatePassword(_password) {
    throw (0, _util.pluginMissing)('encryption');
  },

  /**
   * creates a key-compressor for the given schema
   */
  createKeyCompressor: function createKeyCompressor(_rxSchema) {
    throw (0, _util.pluginMissing)('key-compression');
  },

  /**
   * checks if the given adapter can be used
   */
  checkAdapter: function checkAdapter(_adapter) {
    throw (0, _util.pluginMissing)('adapter-check');
  },

  /**
   * overwritte to map error-codes to text-messages
   */
  tunnelErrorMessage: function tunnelErrorMessage(message) {
    return "RxDB Error-Code " + message + ".\n        - To find out what this means, use the dev-mode-plugin https://pubkey.github.io/rxdb/custom-build.html#dev-mode\n        - Or search for this code https://github.com/pubkey/rxdb/search?q=" + message + "\n        ";
  }
};
exports.overwritable = overwritable;

//# sourceMappingURL=overwritable.js.map