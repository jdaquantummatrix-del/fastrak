// Dependency-free VFP/DBF reader (JS port of incoming/dbf_data.py).
// readDbf(path) -> { fields: [{name,type,len,dec}], records: [ {FIELD: value} ] }
import fs from "node:fs";

function decode(field, raw) {
  switch (field.type) {
    case "C":
      return raw.toString("latin1").replace(/\s+$/, "");
    case "N":
    case "F": {
      const s = raw.toString("latin1").trim();
      return s === "" ? null : Number(s);
    }
    case "D": {
      const s = raw.toString("latin1").trim();
      return s.length === 8 ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : null;
    }
    case "L": {
      const c = raw.toString("latin1").trim().toUpperCase();
      if (c === "T" || c === "Y") return true;
      if (c === "F" || c === "N") return false;
      return null;
    }
    case "Y": // currency: 8-byte signed int scaled by 10000
      return Number(raw.readBigInt64LE(0)) / 10000;
    case "I":
      return raw.readInt32LE(0);
    default:
      return null; // memo/general/blob — not needed for slice 1
  }
}

export function readDbf(path) {
  const buf = fs.readFileSync(path);
  const nrec = buf.readUInt32LE(4);
  const hlen = buf.readUInt16LE(8);
  const rlen = buf.readUInt16LE(10);

  const fields = [];
  let p = 32;
  while (p < hlen && buf[p] !== 0x0d) {
    const name = buf.toString("latin1", p, p + 11).replace(/\0.*$/, "").trim();
    if (!name) break;
    fields.push({
      name,
      type: String.fromCharCode(buf[p + 11]),
      len: buf[p + 16],
      dec: buf[p + 17]
    });
    p += 32;
  }

  const records = [];
  for (let i = 0; i < nrec; i++) {
    const start = hlen + i * rlen;
    const rec = buf.subarray(start, start + rlen);
    if (rec.length < rlen) break;
    if (rec[0] === 0x2a) continue; // 0x2A '*' = deleted
    let off = 1;
    const row = {};
    for (const f of fields) {
      row[f.name] = decode(f, rec.subarray(off, off + f.len));
      off += f.len;
    }
    records.push(row);
  }
  return { fields, records };
}
