var Buffer = require("buffer").Buffer;

//#region main
function httpMessageParser(message) {
  let { messageString, messageBuffer } = stringAndBuffer(message);

  let result;
  messageString = normalizeNewline(messageString).trim();

  ({ result, messageString } = parseStartLine(messageString));

  if (!messageString) {
    return result;
  }

  const { headersString, bodyString } = extractHeaderBlock(messageString);

  if (headersString) {
    const headers = parseHeaders(headersString);

    if (Object.keys(headers).length > 0) {
      result.headers = headers;
    }
  }
  const { isMultipart, boundary, fullBoundary } = evalMultiPart(
    result.headers,
    bodyString
  );

  if (boundary) {
    result.boundary = boundary;
  }

  if (!isMultipart) {
    result.body = bodyString;
  } else {
    const {
      multipart,
      body,
      meta = null,
    } = parseMultiPart(bodyString, fullBoundary, messageBuffer);
    Object.assign(result, { multipart, body, meta });
  }
  return result;
}

//#endregion

//#region regexes
const validVersions = ["1.0", "1.1", "2.0"];
const validVersionsFragment = validVersions.join("|").replace(".", "\\.");
const versionRE = `(HTTP\\/(?<httpVersion>(${validVersionsFragment})))`;

const validMethods = [
  "GET",
  "POST",
  "PUT",
  "DELETE",
  "PATCH",
  "OPTIONS",
  "HEAD",
  "TRACE",
  "CONNECT",
];
const methodRE = `(?<method>${validMethods.join("|")})`;

const urlRE = "(?<url>\\S*)";
const someWhitespaceRE = "\\s+";
const anyWhiteSpaceRE = "\\s*";
const statusCodeRE = "(?<statusCode>\\d+)";
const statusMessageRE = "(?<statusMessage>[\\w\\s\\-_]+)";

const requestLineRE =
  methodRE + someWhitespaceRE + urlRE + anyWhiteSpaceRE + versionRE + "?";
const requestLineRegex = new RegExp(requestLineRE, "i");

const responseLineRE =
  versionRE +
  someWhitespaceRE +
  statusCodeRE +
  someWhitespaceRE +
  statusMessageRE;
const responseLineRegex = new RegExp(responseLineRE, "i");

const headerKVRegex = /(?<key>[\w-]+):\s*(?<value>.*)/;

const findBoundaryRegex = /\n--(?<boundary>[\w-]+)\n/m;
//#endregion

//#region factories
const createBuffer = function (data) {
  return new Buffer(data);
};

const emptyResult = () => ({
  httpVersion: null,
  statusCode: null,
  statusMessage: null,
  method: null,
  url: null,
  headers: null,
  body: null,
  boundary: null,
  multipart: null,
});
//#endregion

//#region predicates
const isBuffer = function (item) {
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

const isNumeric = function _isNumeric(v) {
  if (typeof v === "number" && !isNaN(v)) {
    return true;
  }

  v = (v || "").toString().trim();

  if (!v) {
    return false;
  }

  return !isNaN(v);
};
//#endregion

//#region transforms
const stringAndBuffer = (inp) => {
  let messageBuffer, messageString;
  if (isBuffer(inp)) {
    messageBuffer = inp;
    messageString = inp.toString();
  } else if (typeof inp === "string") {
    messageString = inp;
    messageBuffer = createBuffer(messageString);
  } else {
    throw new Error("Data to be parsed must be a string or Buffer");
  }
  return { messageString, messageBuffer };
};

const normalizeNewline = (str) => str.replace(/\r\n/gim, "\n");
//#endregion

//#region parsers
const parseStartLine = (messageString) => {
  const result = emptyResult();

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
  const matches = line.match(requestLineRegex);
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
  const matches = line.match(responseLineRegex);
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

const extractHeaderBlock = (messageString) => {
  const metaEndsAt = messageString.indexOf("\n\n");

  if (metaEndsAt === -1) {
    return {
      bodyString: messageString,
    };
  }

  const headersString = messageString.slice(0, metaEndsAt);
  const headerZero = headersString.split("\n")[0];
  if (headerZero.match(headerKVRegex)) {
    return {
      headersString: messageString.slice(0, metaEndsAt),
      bodyString: messageString.slice(metaEndsAt + 1),
    };
  }

  return {
    bodyString: messageString,
  };
};

const parseHeaders = function _parseHeaders(headersString) {
  return headersString.split("\n").reduce((headers, headerLine) => {
    const matches = headerLine.match(headerKVRegex);
    const groups = matches && matches.groups;

    if (groups && isNumeric(groups.value)) {
      groups.value = Number(groups.value);
    }

    if (groups) {
      headers[groups.key] = groups.value;
    }

    return headers;
  }, {});
};

const evalMultiPart = (headers, bodyString) => {
  let boundary;
  if (headers?.["Content-Type"]?.match(/^multipart\//)) {
    boundary = parseBoundaryHeader(headers);
  }

  if (!boundary) {
    boundary = deriveBoundary(bodyString);
  }

  if (boundary) {
    const fullBoundary = boundary ? "\n--" + boundary : null;

    return {
      isMultipart: true,
      boundary,
      fullBoundary,
    };
  } else {
    return { isMultipart: false };
  }
};

const parseBoundaryHeader = (headers) => {
  const type = headers["Content-Type"];
  if (!type) {
    return null;
  }

  return type.match(/^multipart\/[\w-]+;\s*boundary=(?<boundary>.*)$/)?.groups
    ?.boundary;
};

const deriveBoundary = (body) => {
  return body.match(findBoundaryRegex)?.groups?.boundary;
};

const parseMultiPart = (bodyString, fullBoundary, messageBuffer) => {
  const savedBody = bodyString;
  const partsAndParts = [];

  let lastStringBoundary = bodyString.indexOf(fullBoundary);
  let lastBufferBoundary = messageBuffer.indexOf(fullBoundary);

  const hop = fullBoundary.length;

  while (lastStringBoundary !== -1 && lastBufferBoundary !== -1) {
    const nextStringBoundary = bodyString.indexOf(
      fullBoundary,
      lastStringBoundary + hop
    );
    const nextBufferBoundary = messageBuffer.indexOf(
      fullBoundary,
      lastBufferBoundary + hop
    );

    if (nextStringBoundary === -1 || nextBufferBoundary === -1) {
      break;
    }

    // copy next part without moving the line
    const partString = bodyString.slice(
      lastStringBoundary + hop,
      nextStringBoundary
    );
    const partBuffer = messageBuffer.slice(
      lastBufferBoundary + hop,
      nextBufferBoundary
    );

    partsAndParts.push({
      partString,
      partBuffer,
      partBufferOffset: lastBufferBoundary + hop,
    });

    // record next place to search from
    lastStringBoundary = nextStringBoundary;
    lastBufferBoundary = nextBufferBoundary;
  }

  const parts = partsAndParts.map(parseBodyPart);

  return { multipart: parts, body: savedBody };
};

const parseBodyPart = ({ partString, partBuffer, partBufferOffset }) => {
  const partHeaderEndsAt = partString.indexOf("\n\n");

  if (partHeaderEndsAt === -1) {
    throw new Error("multipart part must include a blank line");
  }

  const partHeadersString = partString.slice(0, partHeaderEndsAt);
  const partBufferBodyOffset = partHeaderEndsAt + 2;
  const partBodyBuffer = partBuffer.slice(partBufferBodyOffset);

  const partHeaders = parseHeaders(partHeadersString);

  return {
    headers: partHeaders,
    body: partBodyBuffer,
    meta: {
      body: {
        byteOffset: {
          start: partBufferOffset + partBufferBodyOffset + 1,
          end: partBufferOffset + partBuffer.length + 1,
        },
      },
    },
  };
};
//#endregion

//#region packaging
const isInBrowser = function () {
  return !(typeof process === "object" && process + "" === "[object process]");
};

if (isInBrowser) {
  if (typeof window === "object") {
    window.httpMessageParser = httpMessageParser;
  }
}

if (typeof exports !== "undefined") {
  if (typeof module !== "undefined" && module.exports) {
    exports = module.exports = httpMessageParser;
  }
  exports.httpMessageParser = httpMessageParser;
} else {
  // eslint-disable-next-line no-undef
  const def = define || null;
  if (typeof def === "function" && def.amd) {
    def([], function () {
      return httpMessageParser;
    });
  }
}
//#endregion
