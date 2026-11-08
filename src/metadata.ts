/** Decode a declared Nexus byte size without losing its signed int64 value. */
function int64Size(source: string): number | string {
  const match = /^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(source);
  if (!match) throw new TypeError("Invalid Nexus metadata size.");
  const [, sign, whole, fraction = "", exponent = "0"] = match;
  let digits = (whole + fraction).replace(/^0+/, "");
  if (!digits) return 0;
  const scale = Number(exponent) - fraction.length;
  if (scale >= 0) {
    // Check magnitude before padding or BigInt allocation, even for huge exponents.
    if (digits.length + scale > 19) throw new TypeError("Nexus metadata size is outside int64.");
    digits += "0".repeat(scale);
  } else {
    const remove = -scale;
    if (remove >= digits.length || !/^0*$/.test(digits.slice(digits.length - remove)))
      throw new TypeError("Nexus metadata size must be an integer.");
    digits = digits.slice(0, digits.length - remove);
  }
  const maximum = sign ? "9223372036854775808" : "9223372036854775807";
  if (digits.length > 19 || (digits.length === 19 && digits > maximum))
    throw new TypeError("Nexus metadata size is outside int64.");
  const exact = BigInt(sign + digits);
  const number = Number(exact);
  return Number.isSafeInteger(number) ? number : exact.toString();
}

/** Scan only known Nexus positions; unrelated subtrees use a depth counter, not recursion. */
export function parseMetadata(text: string, route: string): unknown {
  const result = JSON.parse(text);
  const path = route.split("?")[0];
  const assets = path === "assets" || path.startsWith("assets/") || path === "search/assets";
  const paged = ["assets", "components", "search", "search/assets"].includes(path);
  const repositoryList = path === "repositories";
  const repositoryDetail = /^repositories\/[^/]+$/.test(path);
  const tokens = new WeakMap<object, string>();
  type Role = "page" | "asset" | "component" | "assets" | "components" | "repository" | "repositories";
  const stack: { role: Role; value: any; array: boolean; index: number; key?: string; expectingKey: boolean }[] = [];
  let skip = 0;
  // Native JSON.parse already validated grammar. Strings are whole tokens, including escapes.
  const lexical = /"(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null|[{}\[\]:,]/g;
  for (const match of text.matchAll(lexical)) {
    const token = match[0];
    const open = token === "{" || token === "[";
    const close = token === "}" || token === "]";
    if (skip) { if (open) skip++; else if (close) skip--; continue; }
    const parent = stack.at(-1);
    if (open) {
      let role: Role | undefined;
      let value: any;
      if (!parent) { role = repositoryList ? "repositories" : repositoryDetail ? "repository" : paged ? "page" : assets ? "asset" : "component"; value = result; }
      else if (token === "[" && parent.role === "page" && parent.key === "items") {
        role = assets ? "assets" : "components"; value = parent.value?.items;
      } else if (token === "[" && parent.role === "component" && parent.key === "assets") {
        role = "assets"; value = parent.value?.assets;
      } else if (token === "{" && parent.array && ["assets", "components", "repositories"].includes(parent.role)) {
        role = parent.role === "repositories" ? "repository" : parent.role === "assets" ? "asset" : "component"; value = parent.value?.[parent.index];
      }
      if (role) stack.push({ role, value, array: token === "[", index: 0, expectingKey: token === "{" });
      else skip = 1;
    } else if (close) stack.pop();
    else if (token === "," && parent) { if (parent.array) parent.index++; else parent.expectingKey = true; }
    else if (token[0] === '"' && parent && !parent.array && parent.expectingKey) {
      parent.key = JSON.parse(token); parent.expectingKey = false;
    } else if (((parent?.role === "asset" && parent.key === "fileSize") || (parent?.role === "repository" && parent.key === "size")) && /^[-\d]/.test(token)
      && parent.value && typeof parent.value === "object") tokens.set(parent.value, token);
  }
  function sized(value: any, field: "fileSize" | "size") {
    if (!value || typeof value !== "object" || Array.isArray(value) || !Object.hasOwn(value, field)) return;
    const source = tokens.get(value);
    if (typeof value[field] !== "number" || source === undefined)
      throw new TypeError("Invalid Nexus metadata size.");
    value[field] = int64Size(source);
  }
  const asset = (value: any) => sized(value, "fileSize");
  function component(value: any) {
    if (value && Array.isArray(value.assets)) value.assets.forEach(asset);
  }
  const visit = repositoryList || repositoryDetail ? (value: any) => sized(value, "size") : assets ? asset : component;
  if (repositoryList) {
    if (Array.isArray(result)) result.forEach(visit);
  } else if (paged) {
    if (result && Array.isArray(result.items)) result.items.forEach(visit);
  } else visit(result);
  return result;
}
