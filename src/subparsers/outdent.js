/**
 * Remove one level of line-leading tabs or spaces
 */
export default function outdent (text, globals) {

  // attacklab: hack around Konqueror 3.5.4 bug:
  // "----------bug".replace(/^-/g,"") == "bug"
  text = text.replace(new RegExp('^(\t|[ ]{1,' + globals.tabWidth + '})', 'gm'), '¨0');

  // attacklab: clean up hack
  text = text.replace(/¨0/g, '');

  return text;
}