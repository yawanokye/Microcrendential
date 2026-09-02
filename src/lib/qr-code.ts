const VERSION = 5;
const SIZE = VERSION * 4 + 17;
const DATA_CODEWORDS = 108;
const ECC_CODEWORDS = 26;

function multiply(x: number, y: number) {
  let result = 0;
  for (let index = 7; index >= 0; index -= 1) {
    result = (result << 1) ^ ((result >>> 7) * 0x11d);
    result ^= ((y >>> index) & 1) * x;
  }
  return result;
}

function reedSolomonDivisor(degree: number) {
  const result = Array(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let index = 0; index < degree; index += 1) {
    for (let coefficient = 0; coefficient < degree; coefficient += 1) {
      result[coefficient] = multiply(result[coefficient], root);
      if (coefficient + 1 < degree) result[coefficient] ^= result[coefficient + 1];
    }
    root = multiply(root, 2);
  }
  return result;
}

function reedSolomonRemainder(data: number[], divisor: number[]) {
  const result = Array(divisor.length).fill(0);
  for (const byte of data) {
    const factor = byte ^ result.shift()!;
    result.push(0);
    for (let index = 0; index < divisor.length; index += 1) result[index] ^= multiply(divisor[index], factor);
  }
  return result;
}

function appendBits(target: number[], value: number, length: number) {
  for (let index = length - 1; index >= 0; index -= 1) target.push((value >>> index) & 1);
}

function encodeData(value: string) {
  const bytes = Array.from(new TextEncoder().encode(value));
  if (bytes.length > 106) throw new Error("The verification URL is too long for the certificate QR code.");
  const bits: number[] = [];
  appendBits(bits, 0b0100, 4);
  appendBits(bits, bytes.length, 8);
  for (const byte of bytes) appendBits(bits, byte, 8);
  appendBits(bits, 0, Math.min(4, DATA_CODEWORDS * 8 - bits.length));
  while (bits.length % 8) bits.push(0);
  const data: number[] = [];
  for (let index = 0; index < bits.length; index += 8) data.push(bits.slice(index, index + 8).reduce((sum, bit) => (sum << 1) | bit, 0));
  for (let pad = 0; data.length < DATA_CODEWORDS; pad += 1) data.push(pad % 2 ? 0x11 : 0xec);
  return [...data, ...reedSolomonRemainder(data, reedSolomonDivisor(ECC_CODEWORDS))];
}

export function makeVerificationQr(value: string) {
  const modules = Array.from({ length: SIZE }, () => Array<boolean>(SIZE).fill(false));
  const functions = Array.from({ length: SIZE }, () => Array<boolean>(SIZE).fill(false));
  const setFunction = (x: number, y: number, dark: boolean) => {
    if (x >= 0 && y >= 0 && x < SIZE && y < SIZE) {
      modules[y][x] = dark;
      functions[y][x] = true;
    }
  };
  const finder = (centerX: number, centerY: number) => {
    for (let deltaY = -4; deltaY <= 4; deltaY += 1) {
      for (let deltaX = -4; deltaX <= 4; deltaX += 1) {
        const distance = Math.max(Math.abs(deltaX), Math.abs(deltaY));
        setFunction(centerX + deltaX, centerY + deltaY, distance !== 2 && distance !== 4);
      }
    }
  };
  const alignment = (centerX: number, centerY: number) => {
    for (let deltaY = -2; deltaY <= 2; deltaY += 1) {
      for (let deltaX = -2; deltaX <= 2; deltaX += 1) setFunction(centerX + deltaX, centerY + deltaY, Math.max(Math.abs(deltaX), Math.abs(deltaY)) !== 1);
    }
  };

  for (let index = 0; index < SIZE; index += 1) {
    setFunction(6, index, index % 2 === 0);
    setFunction(index, 6, index % 2 === 0);
  }
  finder(3, 3);
  finder(SIZE - 4, 3);
  finder(3, SIZE - 4);
  alignment(30, 30);

  const format = 0x77c4;
  const formatBit = (index: number) => Boolean((format >>> index) & 1);
  for (let index = 0; index <= 5; index += 1) setFunction(8, index, formatBit(index));
  setFunction(8, 7, formatBit(6));
  setFunction(8, 8, formatBit(7));
  setFunction(7, 8, formatBit(8));
  for (let index = 9; index < 15; index += 1) setFunction(14 - index, 8, formatBit(index));
  for (let index = 0; index < 8; index += 1) setFunction(SIZE - 1 - index, 8, formatBit(index));
  for (let index = 8; index < 15; index += 1) setFunction(8, SIZE - 15 + index, formatBit(index));
  setFunction(8, SIZE - 8, true);

  const dataBits = encodeData(value).flatMap((byte) => Array.from({ length: 8 }, (_, index) => (byte >>> (7 - index)) & 1));
  let bitIndex = 0;
  let upward = true;
  for (let right = SIZE - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vertical = 0; vertical < SIZE; vertical += 1) {
      const y = upward ? SIZE - 1 - vertical : vertical;
      for (let offset = 0; offset < 2; offset += 1) {
        const x = right - offset;
        if (functions[y][x]) continue;
        let dark = Boolean(dataBits[bitIndex] ?? 0);
        bitIndex += 1;
        if ((x + y) % 2 === 0) dark = !dark;
        modules[y][x] = dark;
      }
    }
    upward = !upward;
  }
  return modules;
}

export function verificationQrSvg(value: string) {
  const matrix = makeVerificationQr(value);
  const quietZone = 4;
  const size = matrix.length + quietZone * 2;
  const path = matrix.flatMap((row, y) => row.map((dark, x) => dark ? `M${x + quietZone} ${y + quietZone}h1v1h-1z` : "")).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" role="img" aria-label="Certificate verification QR code"><rect width="${size}" height="${size}" fill="#fff"/><path d="${path}" fill="#062f49"/></svg>`;
}
