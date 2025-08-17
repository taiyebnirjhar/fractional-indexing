export const BASE_62_DIGITS =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

// ------------------------------
// Internal helpers
// ------------------------------

function midpoint(a: string, b: string | null, digits: string): string {
  const zero = digits[0];
  if (b != null && a >= b) throw new Error(`${a} >= ${b}`);
  if (a.endsWith(zero) || (b && b.endsWith(zero)))
    throw new Error("trailing zero");

  if (b) {
    let n = 0;
    while ((a[n] || zero) === b[n]) n++;
    if (n > 0) return b.slice(0, n) + midpoint(a.slice(n), b.slice(n), digits);
  }

  const digitA = a ? digits.indexOf(a[0]) : 0;
  const digitB = b != null ? digits.indexOf(b[0]) : digits.length;

  if (digitB - digitA > 1) {
    return digits[Math.round(0.5 * (digitA + digitB))];
  } else {
    if (b && b.length > 1) return b[0];
    return digits[digitA] + midpoint(a.slice(1), null, digits);
  }
}

function getIntegerLength(head: string): number {
  if (head >= "a" && head <= "z") return head.charCodeAt(0) - 96 + 1;
  if (head >= "A" && head <= "Z") return 91 - head.charCodeAt(0);
  throw new Error("invalid order key head: " + head);
}

function getIntegerPart(key: string): string {
  const len = getIntegerLength(key[0]);
  if (len > key.length) throw new Error("invalid order key: " + key);
  return key.slice(0, len);
}

function incrementInteger(x: string, digits: string): string | null {
  const [head, ...digs] = x.split("");
  let carry = true;
  for (let i = digs.length - 1; carry && i >= 0; i--) {
    const d = digits.indexOf(digs[i]) + 1;
    if (d === digits.length) digs[i] = digits[0];
    else {
      digs[i] = digits[d];
      carry = false;
    }
  }
  if (carry) {
    if (head === "Z") return "a" + digits[0];
    if (head === "z") return null;
    const h = String.fromCharCode(head.charCodeAt(0) + 1);
    if (h > "a") digs.push(digits[0]);
    else digs.pop();
    return h + digs.join("");
  }
  return head + digs.join("");
}

function decrementInteger(x: string, digits: string): string | null {
  const [head, ...digs] = x.split("");
  let borrow = true;
  for (let i = digs.length - 1; borrow && i >= 0; i--) {
    const d = digits.indexOf(digs[i]) - 1;
    if (d === -1) digs[i] = digits.slice(-1);
    else {
      digs[i] = digits[d];
      borrow = false;
    }
  }
  if (borrow) {
    if (head === "a") return "Z" + digits.slice(-1);
    if (head === "A") return null;
    const h = String.fromCharCode(head.charCodeAt(0) - 1);
    if (h < "Z") digs.push(digits.slice(-1));
    else digs.pop();
    return h + digs.join("");
  }
  return head + digs.join("");
}

function unjitteredGenerateKeyBetween(
  a: string | null,
  b: string | null,
  digits: string
): string {
  if (a != null && b != null && a >= b) throw new Error(`${a} >= ${b}`);

  if (a == null) {
    if (b == null) return "a" + digits[0];
    const ib = getIntegerPart(b);
    if (ib < b) return ib;
    const res = decrementInteger(ib, digits);
    if (!res) throw new Error("cannot decrement");
    return res;
  }

  if (b == null) {
    const ia = getIntegerPart(a);
    const i = incrementInteger(ia, digits);
    return i ?? ia + midpoint(a.slice(ia.length), null, digits);
  }

  const ia = getIntegerPart(a);
  const fa = a.slice(ia.length);
  const ib = getIntegerPart(b);
  const fb = b.slice(ib.length);

  if (ia === ib) return ia + midpoint(fa, fb, digits);
  const i = incrementInteger(ia, digits);
  if (!i) throw new Error("cannot increment");
  return i < b ? i : ia + midpoint(fa, null, digits);
}

function unjitteredGenerateNKeysBetween(
  a: string | null,
  b: string | null,
  n: number,
  digits: string
): string[] {
  if (n === 0) return [];
  if (n === 1) return [unjitteredGenerateKeyBetween(a, b, digits)];
  if (b == null) {
    let c = unjitteredGenerateKeyBetween(a, b, digits);
    const res = [c];
    for (let i = 0; i < n - 1; i++) {
      c = unjitteredGenerateKeyBetween(c, b, digits);
      res.push(c);
    }
    return res;
  }
  if (a == null) {
    let c = unjitteredGenerateKeyBetween(a, b, digits);
    const res = [c];
    for (let i = 0; i < n - 1; i++) {
      c = unjitteredGenerateKeyBetween(a, c, digits);
      res.push(c);
    }
    return res.reverse();
  }
  const mid = Math.floor(n / 2);
  const c = unjitteredGenerateKeyBetween(a, b, digits);
  return [
    ...unjitteredGenerateNKeysBetween(a, c, mid, digits),
    c,
    ...unjitteredGenerateNKeysBetween(c, b, n - mid - 1, digits),
  ];
}

// ------------------------------
// Public API (jittered)
// ------------------------------

const DEFAULT_JITTER_BITS = 30;
const DEFAULT_GET_RANDOM_BIT = () => Math.random() < 0.5;

export function generateKeyBetween(
  a: string | null,
  b: string | null,
  opts?: {
    digits?: string;
    jitterBits?: number;
    getRandomBit?: () => boolean;
  }
): string {
  const {
    digits = BASE_62_DIGITS,
    jitterBits = DEFAULT_JITTER_BITS,
    getRandomBit = DEFAULT_GET_RANDOM_BIT,
  } = opts ?? {};

  let low = a;
  let high = b;
  let mid = unjitteredGenerateKeyBetween(a, b, digits);
  let bits = jitterBits;

  while (bits-- > 0) {
    if (getRandomBit()) low = mid;
    else high = mid;
    mid = unjitteredGenerateKeyBetween(low, high, digits);
  }

  return mid;
}

export function generateNKeysBetween(
  a: string | null,
  b: string | null,
  n: number,
  opts?: {
    digits?: string;
    jitterBits?: number;
    getRandomBit?: () => boolean;
  }
): string[] {
  const { digits = BASE_62_DIGITS, jitterBits } = opts ?? {};

  if (n === 0) return [];
  if (jitterBits === 0) return unjitteredGenerateNKeysBetween(a, b, n, digits);

  const keys = unjitteredGenerateNKeysBetween(a, b, n + 1, digits);
  const res: string[] = [];
  for (let i = 0; i < n; i++) {
    res.push(generateKeyBetween(keys[i], keys[i + 1], opts));
  }
  return res;
}
