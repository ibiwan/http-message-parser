var Buffer = require("buffer").Buffer;

const pred = require("./predicates");

module.exports.stringAndBuffer = (inp) => {
  let messageBuffer, messageString;
  if (pred.isBuffer(inp)) {
    messageBuffer = inp;
    messageString = inp.toString();
  } else if (typeof inp === "string") {
    messageString = inp;
    messageBuffer = Buffer.from(messageString);
  } else {
    throw new Error("Data to be parsed must be a string or Buffer");
  }
  return { messageString, messageBuffer };
};

module.exports.normalizeNewline = (str) => str.replace(/\r\n/gim, "\n");
