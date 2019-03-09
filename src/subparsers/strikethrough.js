export default function strikethrough (text, globals) {

  text = text.replace(/(?:~){2}([\s\S]+?)(?:~){2}/g, function (wm, txt) { return '<del>' + txt + '</del>'; });

  return text;
}