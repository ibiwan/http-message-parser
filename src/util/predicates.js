module.exports.isBuffer = function (item) {
  return (
    (isNodeBufferSupported() &&
      typeof global === "object" &&
      global.Buffer.isBuffer(item)) ||
    (item instanceof Object && item._isBuffer)
  );
};

const isNodeBufferSupported = function () {
  return (
    typeof global === "object" &&
    typeof global.Buffer === "function" &&
    typeof global.Buffer.isBuffer === "function"
  );
};

module.exports.isNumeric = function _isNumeric(v) {
  if (typeof v === "number" && !isNaN(v)) {
    return true;
  }

  v = (v || "").toString().trim();

  if (!v) {
    return false;
  }

  return !isNaN(v);
};
