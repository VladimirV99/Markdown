import spanGamut from './spanGamut';
import codeSpans from './codeSpans';
import { isUndefined, escapeCharactersCallback } from '../helpers';

export default function tables (text, globals) {
  let tableRgx       = new RegExp('^ {0,'+globals.tabWidthLimit+'}\\|?.+\\|.+\n {0,'+globals.tabWidthLimit+'}\\|?[ \t]*:?[ \t]*(?:[-=]){2,}[ \t]*:?[ \t]*\\|[ \t]*:?[ \t]*(?:[-=]){2,}[\\s\\S]+?(?:\n\n|¨0)', 'gm'),
      singeColTblRgx = new RegExp('^ {0,'+globals.tabWidthLimit+'}\\|.+\\|[ \t]*\n {0,'+globals.tabWidthLimit+'}\\|[ \t]*:?[ \t]*(?:[-=]){2,}[ \t]*:?[ \t]*\\|[ \t]*\n( {0,'+globals.tabWidthLimit+'}\\|.+\\|[ \t]*\n)*(?:\n|¨0)', 'gm');

  function parseStyles (sLine) {
    if (/^:[ \t]*--*$/.test(sLine)) {
      return ' style="text-align:left;"';
    } else if (/^--*[ \t]*:[ \t]*$/.test(sLine)) {
      return ' style="text-align:right;"';
    } else if (/^:[ \t]*--*[ \t]*:$/.test(sLine)) {
      return ' style="text-align:center;"';
    } else {
      return '';
    }
  }

  function parseHeaders (header, style) {
    header = header.trim();
    header = spanGamut(header, globals);

    return '<th' + style + '>' + header + '</th>\n';
  }

  function parseCells (cell, style) {
    let subText = spanGamut(cell, globals);
    return '<td' + style + '>' + subText + '</td>\n';
  }

  function buildTable (headers, cells) {
    let tb = '<table>\n<thead>\n<tr>\n',
        tblLgn = headers.length;

    for (let i = 0; i < tblLgn; ++i) {
      tb += headers[i];
    }
    tb += '</tr>\n</thead>\n<tbody>\n';

    for (let i = 0; i < cells.length; ++i) {
      tb += '<tr>\n';
      for (let j = 0; j < tblLgn; ++j) {
        tb += cells[i][j];
      }
      tb += '</tr>\n';
    }
    tb += '</tbody>\n</table>\n';
    return tb;
  }

  function parseTable (rawTable) {
    let tableLines = rawTable.split('\n');

    for (let i = 0; i < tableLines.length; ++i) {
      // strip wrong first and last column if wrapped tables are used
      let rgx = new RegExp('^ {0,'+globals.tabWidthLimit+'}\\|', '');
      if (rgx.test(tableLines[i])) {
        tableLines[i] = tableLines[i].replace(rgx, '');
      }
      if (/\|[ \t]*$/.test(tableLines[i])) {
        tableLines[i] = tableLines[i].replace(/\|[ \t]*$/, '');
      }
      // parse code spans first, but we only support one line code spans

      tableLines[i] = codeSpans(tableLines[i], globals);
    }

    let rawHeaders = tableLines[0].split('|').map(function (s) { return s.trim();}),
        rawStyles = tableLines[1].split('|').map(function (s) { return s.trim();}),
        rawCells = [],
        headers = [],
        styles = [],
        cells = [];

    tableLines.shift();
    tableLines.shift();

    for (let i = 0; i < tableLines.length; ++i) {
      if (tableLines[i].trim() === '') {
        continue;
      }
      rawCells.push(
        tableLines[i]
          .split('|')
          .map(function (s) {
            return s.trim();
          })
      );
    }

    if (rawHeaders.length < rawStyles.length) {
      return rawTable;
    }

    for (let i = 0; i < rawStyles.length; ++i) {
      styles.push(parseStyles(rawStyles[i]));
    }

    for (let i = 0; i < rawHeaders.length; ++i) {
      if (isUndefined(styles[i])) {
        styles[i] = '';
      }
      headers.push(parseHeaders(rawHeaders[i], styles[i]));
    }

    for (let i = 0; i < rawCells.length; ++i) {
      let row = [];
      for (let j = 0; j < headers.length; ++j) {
        row.push(parseCells(rawCells[i][j], styles[j]));
      }
      cells.push(row);
    }

    return buildTable(headers, cells);
  }

  // find escaped pipe characters
  text = text.replace(/\\(\|)/g, escapeCharactersCallback);

  // parse multi column tables
  text = text.replace(tableRgx, parseTable);

  // parse one column tables
  text = text.replace(singeColTblRgx, parseTable);

  return text;
}