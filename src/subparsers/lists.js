import outdent from './outdent';
import githubCodeBlocks from './githubCodeBlocks';
import blockGamut from './blockGamut';
import hashHTMLBlocks from './hashHTMLBlocks';
import paragraphs from './paragraphs';
import spanGamut from './spanGamut';

/**
 * Form HTML ordered (numbered) and unordered (bulleted) lists.
 */
export default function lists (text, globals) {

  /**
   * Process the contents of a single ordered or unordered list, splitting it
   * into individual list items.
   * @param {string} listStr
   * @param {boolean} trimTrailing
   * @returns {string}
   */
  function processListItems (listStr, trimTrailing) {
    // The $g_list_level global keeps track of when we're inside a list.
    // Each time we enter a list, we increment it; when we leave a list,
    // we decrement. If it's zero, we're not in a list anymore.
    //
    // We do this because when we're not inside a list, we want to treat
    // something like this:
    //
    //    I recommend upgrading to version
    //    8. Oops, now this line is treated
    //    as a sub-list.
    //
    // As a single paragraph, despite the fact that the second line starts
    // with a digit-period-space sequence.
    //
    // Whereas when we're inside a list (or sub-list), that line will be
    // treated as the start of a sub-list. What a kludge, huh? This is
    // an aspect of Markdown's syntax that's hard to parse perfectly
    // without resorting to mind-reading. Perhaps the solution is to
    // change the syntax rules such that sub-lists must start with a
    // starting cardinal number; e.g. "1." or "a.".
    globals.gListLevel++;

    // trim trailing blank lines:
    listStr = listStr.replace(/\n{2,}$/, '\n');

    // attacklab: add sentinel to emulate \z
    listStr += '¨0';

    let rgx = new RegExp('(\n)?(^ {0,'+globals.tabWidthLimit+'})([*+-]|\\d+[.])[ \t]+((\\[(x|X| )?])?[ \t]*[^\r]+?(\n{1,2}))(?=\n*(¨0| {0,'+globals.tabWidthLimit+'}([*+-]|\\d+[.])[ \t]+))', 'gm'),
        isParagraphed = (/\n[ \t]*\n(?!¨0)/.test(listStr));

    listStr = listStr.replace(rgx, function (wholeMatch, m1, m2, m3, m4, taskbtn, checked) {
      checked = (checked && checked.trim() !== '');

      let item = outdent(m4, globals),
          bulletStyle = '';

      // Support for github tasklists
      if (taskbtn) {
        bulletStyle = ' class="task-list-item" style="list-style-type: none;"';
        item = item.replace(/^[ \t]*\[(x|X| )?]/m, function () {
          let otp = '<input type="checkbox" disabled style="margin: 0px 0.35em 0.25em -1.6em; vertical-align: middle;"';
          if (checked) {
            otp += ' checked';
          }
          otp += '>';
          return otp;
        });
      }

      // ISSUE #312
      // This input: - - - a
      // causes trouble to the parser, since it interprets it as:
      // <ul><li><li><li>a</li></li></li></ul>
      // instead of:
      // <ul><li>- - a</li></ul>
      // So, to prevent it, we will put a marker (¨A)in the beginning of the line
      // Kind of hackish/monkey patching, but seems more effective than overcomplicating the list parser
      item = item.replace(/^([-*+]|\d\.)[ \t]+[\S\n ]*/g, function (wm2) {
        return '¨A' + wm2;
      });

      // SPECIAL CASE: an heading followed by a paragraph of text that is not separated by a double newline
      // or/nor indented. ex:
      //
      // - # foo
      // bar is great
      //
      // While this does now follow the spec per se, not allowing for this might cause confusion since
      // header blocks don't need double newlines after
      if (/^#+.+\n.+/.test(item)) {
        item = item.replace(/^(#+.+)$/m, '$1\n');
      }

      // m1 - Leading line or
      // Has a double return (multi paragraph)
      if (m1 || (item.search(/\n{2,}/) > -1)) {
        item = githubCodeBlocks(item, globals);
        item = blockGamut(item, globals);
      } else {

        // Recursion for sub-lists:
        item = lists(item, globals);
        item = item.replace(/\n$/, ''); // chomp(item)
        item = hashHTMLBlocks(item, globals);

        // Colapse double linebreaks
        item = item.replace(/\n\n+/g, '\n\n');

        if (isParagraphed) {
          item = paragraphs(item, globals);
        } else {
          item = spanGamut(item, globals);
        }
      }

      // now we need to remove the marker (¨A)
      item = item.replace('¨A', '');
      // we can finally wrap the line in list item tags
      item =  '<li' + bulletStyle + '>' + item + '</li>\n';

      return item;
    });

    // attacklab: strip sentinel
    listStr = listStr.replace(/¨0/g, '');

    globals.gListLevel--;

    if (trimTrailing) {
      listStr = listStr.replace(/\s+$/, '');
    }

    return listStr;
  }

  function styleStartNumber (list, listType) {
    // check if ol and starts by a number different than 1
    if (listType === 'ol') {
      let res = list.match(/^ *(\d+)\./);
      if (res && res[1] !== '1') {
        return ' start="' + res[1] + '"';
      }
    }
    return '';
  }

  /**
   * Check and parse consecutive lists (better fix for issue #142)
   * @param {string} list
   * @param {string} listType
   * @param {boolean} trimTrailing
   * @returns {string}
   */
  function parseConsecutiveLists (list, listType, trimTrailing) {
    // check if we caught 2 or more consecutive lists by mistake
    // we use the counterRgx, meaning if listType is UL we look for OL and vice versa
    let olRgx = /^ {0,3}\d+\.[ \t]/gm,
        ulRgx = /^ {0,3}[*+-][ \t]/gm,
        counterRxg = (listType === 'ul') ? olRgx : ulRgx,
        result = '';

    if (list.search(counterRxg) !== -1) {
      (function parseCL (txt) {
        let pos = txt.search(counterRxg),
            style = styleStartNumber(list, listType);
        if (pos !== -1) {
          // slice
          result += '\n\n<' + listType + style + '>\n' + processListItems(txt.slice(0, pos), !!trimTrailing) + '</' + listType + '>\n';

          // invert counterType and listType
          listType = (listType === 'ul') ? 'ol' : 'ul';
          counterRxg = (listType === 'ul') ? olRgx : ulRgx;

          //recurse
          parseCL(txt.slice(pos));
        } else {
          result += '\n\n<' + listType + style + '>\n' + processListItems(txt, !!trimTrailing) + '</' + listType + '>\n';
        }
      })(list);
    } else {
      let style = styleStartNumber(list, listType);
      result = '\n\n<' + listType + style + '>\n' + processListItems(list, !!trimTrailing) + '</' + listType + '>\n';
    }

    return result;
  }

  // Start of list parsing
  let subListRgx = new RegExp('^(( {0,'+globals.tabWidthLimit+'}([*+-]|\\d+[.])[ \t]+)[^\r]+?(¨0|\n{2,}(?=\\S)(?![ \t]*(?:[*+-]|\\d+[.])[ \t]+)))', 'gm');
  let mainListRgx = new RegExp('(\n\n|^\n?)(( {0,'+globals.tabWidthLimit+'}([*+-]|\\d+[.])[ \t]+)[^\r]+?(¨0|\n{2,}(?=\\S)(?![ \t]*(?:[*+-]|\\d+[.])[ \t]+)))', 'gm');

  if (globals.gListLevel) {
    text = text.replace(subListRgx, function (wholeMatch, list, m2) {
      let listType = (m2.search(/[*+-]/g) > -1) ? 'ul' : 'ol';
      return parseConsecutiveLists(list, listType, true);
    });
  } else {
    text = text.replace(mainListRgx, function (wholeMatch, m1, list, m3) {
      let listType = (m3.search(/[*+-]/g) > -1) ? 'ul' : 'ol';
      return parseConsecutiveLists(list, listType, false);
    });
  }
  
  return text;
}