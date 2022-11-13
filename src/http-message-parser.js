const { stringAndBuffer, normalizeNewline } = require("./util/transforms");
const { parseStartLine } = require("./util/parser/startLine");
const { extractHeaderBlock, parseHeaders } = require("./util/parser/header");
const { evalMultiPart, parseMultiPart } = require("./util/parser/multipart");

module.exports = httpMessageParser = (message) => {
  // get two copies of message, in case of binary data
  let { messageString, messageBuffer } = stringAndBuffer(message);

  let result;
  // ditch crlf endings for cr, clear start/end whitesapce
  messageString = normalizeNewline(messageString).trim();

  // get type of message and req/resp fields; return the rest
  ({ result, messageString } = parseStartLine(messageString));

  // stop if start-line is everything
  if (!messageString) {
    return result;
  }

  const { type } = result;

  // find header and body sections of message, as applicable
  const { headersString, bodyString } = extractHeaderBlock(type, messageString);

  // parse headers
  if (headersString) {
    const headers = parseHeaders(headersString);

    if (Object.keys(headers).length > 0) {
      result.headers = headers;
    }
  }

  // check for multipart by checking headers,
  // then by falling back on a boundary-finding heuristic
  const { isMultipart, boundary, fullBoundary } = evalMultiPart(
    result.headers,
    bodyString
  );

  if (boundary) {
    result.boundary = boundary;
  }

  if (isMultipart) {
    // if multipart, extract each section's headers and content
    const parts = parseMultiPart(bodyString, fullBoundary, messageBuffer);
    const { multipart, body, meta = null } = parts;
    Object.assign(result, { multipart, body, meta });
  } else if (bodyString) {
    result.body = bodyString;
  }
  return result;
};
