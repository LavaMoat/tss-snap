export const copyToClipboard = async (text: string) => {
  await window.navigator.clipboard.writeText(text);
};

export const abbreviateAddress = (address: string): string => {
  const start = address.substr(0, 5);
  const end = address.substr(address.length - 5);
  return `${start}...${end}`;
}
