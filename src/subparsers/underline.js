import { escapeCharactersCallback } from '../helpers';

//TODO what to do?
export default function underline (text, globals) {

  text = text.replace(/\b___(\S[\s\S]+?)___\b/g, function (wm, txt) {
    return '<u>' + txt + '</u>';
  });
  text = text.replace(/\b__(\S[\s\S]+?)__\b/g, function (wm, txt) {
    return '<u>' + txt + '</u>';
  });

  text = text.replace(/(_)/g, escapeCharactersCallback);
  
  return text;
}