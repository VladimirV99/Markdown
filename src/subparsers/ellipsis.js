export default function ellipsis (text, globals) {
  text = text.replace(/\.\.\./g, '…');

  return text;
}