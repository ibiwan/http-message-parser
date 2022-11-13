const re = require("../../util/regex");
const fac = require("../factory");

module.exports.parseStartLine = (messageString) => {
  const result = fac.emptyResult();

  const firstLineEndsAt = messageString.indexOf("\n");
  const firstLine =
    firstLineEndsAt === -1
      ? messageString
      : messageString.slice(0, firstLineEndsAt);

  let wasReqRes = false;

  const requestResult = parseRequestLine(firstLine);
  if (requestResult) {
    wasReqRes = true;
    Object.assign(result, requestResult);
  } else {
    const responseResult = parseResponseLine(firstLine);
    if (responseResult) {
      wasReqRes = true;
      Object.assign(result, responseResult);
    }
  }

  if (wasReqRes) {
    messageString =
      firstLineEndsAt === -1 ? null : messageString.slice(firstLineEndsAt + 1);
  }

  return { result, messageString };
};

const parseRequestLine = (line) => {
  const matches = line.match(re.requestLineRegex);
  const groups = matches && matches.groups;

  if (groups) {
    const { method, url, httpVersion } = groups;
    return {
      method,
      url,
      httpVersion: parseFloat(httpVersion || "1.1"),
      type: "request",
    };
  }

  return null;
};

const parseResponseLine = (line) => {
  const matches = line.match(re.responseLineRegex);
  const groups = matches && matches.groups;

  if (groups) {
    const { httpVersion, statusCode, statusMessage } = groups;
    return {
      httpVersion: parseFloat(httpVersion || "1.1"),
      statusCode: parseInt(statusCode),
      statusMessage,
      type: "response",
    };
  }

  return null;
};
