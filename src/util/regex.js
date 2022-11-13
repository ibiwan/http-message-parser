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
module.exports.requestLineRegex = new RegExp(requestLineRE, "i");

const responseLineRE =
  versionRE +
  someWhitespaceRE +
  statusCodeRE +
  someWhitespaceRE +
  statusMessageRE;
module.exports.responseLineRegex = new RegExp(responseLineRE, "i");

module.exports.headerKVRegex = /(?<key>[\w-]+):\s*(?<value>.*)/;

module.exports.findBoundaryRegex = /\n--(?<boundary>[\w-]+)\n/m;
