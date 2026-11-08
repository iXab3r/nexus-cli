/** Decode Nexus AssetXO.fileSize without losing its signed int64 value. */
function fileSize(source: string): number | string {
  const match = /^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(source);
  if (!match) throw new TypeError("Invalid Nexus asset size.");
  const [, sign, whole, fraction = "", exponent = "0"] = match;
  let digits = (whole + fraction).replace(/^0+/, "");
  if (!digits) return 0;
  const scale = Number(exponent) - fraction.length;
  if (scale >= 0) {
    // Check magnitude before padding or BigInt allocation, even for huge exponents.
    if (digits.length + scale > 19) throw new TypeError("Nexus asset size is outside int64.");
    digits += "0".repeat(scale);
  } else {
    const remove = -scale;
    if (remove >= digits.length || !/^0*$/.test(digits.slice(digits.length - remove)))
      throw new TypeError("Nexus asset size must be an integer.");
    digits = digits.slice(0, digits.length - remove);
  }
  const maximum = sign ? "9223372036854775808" : "9223372036854775807";
  if (digits.length > 19 || (digits.length === 19 && digits > maximum))
    throw new TypeError("Nexus asset size is outside int64.");
  const exact = BigInt(sign + digits);
  const number = Number(exact);
  return Number.isSafeInteger(number) ? number : exact.toString();
}

/** Retain token provenance while visiting only AssetXO fields in the known response shape. */
export function parseMetadata(text: string, route: string): unknown {
  const tokens = new WeakMap<object, string>();
  const result = JSON.parse(text, function (this: object, key: string, value: unknown, context?: { source?: string }) {
    if (key === "fileSize" && context?.source !== undefined) tokens.set(this, context.source);
    return value;
  });
  function asset(value: any) {
    if (!value || typeof value !== "object" || Array.isArray(value) || !Object.hasOwn(value, "fileSize")) return;
    const source = tokens.get(value);
    if (typeof value.fileSize !== "number" || source === undefined)
      throw new TypeError("Invalid Nexus asset size.");
    value.fileSize = fileSize(source);
  }
  function component(value: any) {
    if (value && Array.isArray(value.assets)) value.assets.forEach(asset);
  }
  const path = route.split("?")[0];
  const visit = path === "assets" || path.startsWith("assets/") || path === "search/assets" ? asset : component;
  if (["assets", "components", "search", "search/assets"].includes(path)) {
    if (result && Array.isArray(result.items)) result.items.forEach(visit);
  } else visit(result);
  return result;
}
