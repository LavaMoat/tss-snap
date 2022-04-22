export const copyToClipboard = async (text: string) => {
  await window.navigator.clipboard.writeText(text);
};

export function encode(value: string): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(value);
}

export function decode(value: Uint8Array): string {
  const decoder = new TextDecoder();
  return decoder.decode(value);
}

export function download(fileName: string, buffer: Uint8Array, type?: string) {
  const blob = new Blob([buffer], { type: type || "application/octet-stream" });
  const link = document.createElement("a");
  link.href = window.URL.createObjectURL(blob);
  link.download = fileName;
  link.click();
}

export const abbreviateAddress = (address: string): string => {
  const start = address.substr(0, 5);
  const end = address.substr(address.length - 5);
  return `${start}...${end}`;
};

export type Dictionary<T> = {
  [key: string]: T;
};

export const chains: Dictionary<string> = {
  "0x1": "Mainnet",
  "0x3": "Ropsten",
  "0x4": "Rinkeby",
  "0x5": "Goerli",
  "0x2a": "Kovan",
};
