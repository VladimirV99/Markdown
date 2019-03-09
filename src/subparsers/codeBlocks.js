import outdent from './outdent';
import encodeCode from './encodeCode';
import detab from './detab';
import hashBlock from './hashBlock';

/**
 * Process Markdown `<pre><code>` blocks.
 */
export default function codeBlocks (text, globals) {

  // sentinel workarounds for lack of \A and \Z, safari\khtml bug
  text += '¨0';

  let pattern = new RegExp('(?:\n\n|^)((?:(?:[ ]{' + globals.tabWidth + '}|\t).*\n+)+)(\n*[ ]{0,'+globals.tabWidthLimit+'}[^ \t\n]|(?=¨0))', 'g');
  text = text.replace(pattern, function (wholeMatch, m1, m2) {
    let codeblock = m1,
        nextChar = m2;

    codeblock = outdent(codeblock, globals);
    codeblock = encodeCode(codeblock, globals);
    codeblock = detab(codeblock, globals);
    codeblock = codeblock.replace(/^\n+/g, ''); // trim leading newlines
    codeblock = codeblock.replace(/\n+$/g, ''); // trim trailing newlines

    codeblock = '<pre><code>' + codeblock + '</code></pre>';

    return hashBlock(codeblock, globals) + nextChar;
  });

  // strip sentinel
  text = text.replace(/¨0/, '');

  return text;
}