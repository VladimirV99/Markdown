/**
 * Convert all tabs to spaces
 */
export default function detab(text, globals) {
  // expand first n-1 tabs
  text = text.replace(/\t(?=\t)/g, globals.tab);

  // replace the nth with two sentinels
  text = text.replace(/\t/g, '¨A¨B');

  // use the sentinel to anchor our regex so it doesn't explode
  text = text.replace(/¨B(.+?)¨A/g, function (wholeMatch, m1) {
    let leadingText = m1;
    let numSpaces = globals.tabWidth - leadingText.length % globals.tabWidth;

    // there *must* be a better way to do this:
    for (let i = 0; i < numSpaces; i++) {
      leadingText += ' ';
    }

    return leadingText;
  });

  // clean up sentinels
  text = text.replace(/¨A/g, globals.tab);
  text = text.replace(/¨B/g, '');

  return text;
}