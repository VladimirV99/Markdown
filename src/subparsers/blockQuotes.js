import githubCodeBlocks from './githubCodeBlocks';
import hashBlock from './hashBlock';
import blockGamut from './blockGamut';

export default function blockQuotes (text, globals) {

  // add a couple extra lines after the text and endtext mark
  text = text + '\n\n';

  let rgx = new RegExp('^ {0,'+globals.tabWidthLimit+'}>[\\s\\S]*?(?:\n\n)', 'gm');

  text = text.replace(rgx, function (bq) {
    // attacklab: hack around Konqueror 3.5.4 bug:
    // "----------bug".replace(/^-/g,"") == "bug"
    bq = bq.replace(/^[ \t]*>[ \t]?/gm, ''); // trim one level of quoting

    // attacklab: clean up hack
    bq = bq.replace(/¨0/g, '');

    bq = bq.replace(/^[ \t]+$/gm, ''); // trim whitespace-only lines
    bq = githubCodeBlocks(bq, globals);
    bq = blockGamut(bq, globals); // recurse

    bq = bq.replace(/(^|\n)/g, '$1  ');
    // These leading spaces screw with <pre> content, so we need to fix that:
    bq = bq.replace(/(\s*<pre>[^\r]+?<\/pre>)/gm, function (wholeMatch, m1) {
      let pre = m1;
      // attacklab: hack around Konqueror 3.5.4 bug:
      pre = pre.replace(/^  /mg, '¨0');
      pre = pre.replace(/¨0/g, '');
      return pre;
    });

    return hashBlock('<blockquote>\n' + bq + '\n</blockquote>', globals);
  });

  return text;
}