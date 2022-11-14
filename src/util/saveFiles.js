const fs = require("fs");
const path = require("path");
const Buffer = require("buffer").Buffer;

exports.saveFile = (headers, body, prefix = "file") => {
  const headerName = headers?.["Content-Disposition"]?.match(
    /filename=\"(?<name>\S+)\"/
  )?.groups?.name;
  let ext = headerName && path.extname(headerName);
  if (!ext) {
    const { type: _type, subType } =
      headers?.["Content-Type"]?.match(/^(?<type>[\w+.]+)\/(?<subType>[\w+.]+)/)
        ?.groups ?? {};
    ext = subType?.split("+").pop();
  }

  if (!ext) {
    ext = "bin";
  }

  const dir = "saved-files";
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }

  const dirList = fs.readdirSync(dir);
  let n = 0;
  let genName;
  do {
    genName = `${prefix} - ${n}.${ext}`;
    n++;
  } while (dirList.includes(genName));

  const f = fs.openSync(path.join(dir, genName), "w");
  fs.writeSync(f, body);
  fs.closeSync(f);
};
