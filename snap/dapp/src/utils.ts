export const copyToClipboard = async (text: string) => {
  await window.navigator.clipboard.writeText(text);
};

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
