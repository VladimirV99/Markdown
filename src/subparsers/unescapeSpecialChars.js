/**
 * Swap back in all the special characters we've hidden.
 */
export default function unescapeSpecialChars (text, globals) {

  text = text.replace(/¨E(\d+)E/g, function (wholeMatch, m1) {
    let charCodeToReplace = parseInt(m1);
    return String.fromCharCode(charCodeToReplace);
  });

  return text;
}