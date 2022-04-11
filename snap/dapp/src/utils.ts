export const copyToClipboard = async (text: string) => {
  await window.navigator.clipboard.writeText(text);
};
