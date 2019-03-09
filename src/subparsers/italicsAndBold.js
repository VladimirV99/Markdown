export default function italicsAndBold (text, globals) {
  // it's faster to have 3 separate regexes for each case than have just one
  // because of backtracing, in some cases, it could lead to an exponential effect
  // called "catastrophic backtrace". Ominous!

  function parseInside (txt, left, right) {
    return left + txt + right;
  }

  // Parse underscores
  text = text.replace(/\b___(\S[\s\S]+?)___\b/g, function (wm, txt) {
    return parseInside (txt, '<strong><em>', '</em></strong>');
  });
  text = text.replace(/\b__(\S[\s\S]+?)__\b/g, function (wm, txt) {
    return parseInside (txt, '<strong>', '</strong>');
  });
  text = text.replace(/\b_(\S[\s\S]+?)_\b/g, function (wm, txt) {
    return parseInside (txt, '<em>', '</em>');
  });

  // Now parse asterisks
  text = text.replace(/\*\*\*(\S[\s\S]+?)\*\*\*/g, function (wm, txt) {
    return parseInside (txt, '<strong><em>', '</em></strong>');
  });
  text = text.replace(/\*\*(\S[\s\S]+?)\*\*/g, function (wm, txt) {
    return parseInside (txt, '<strong>', '</strong>');
  });
  text = text.replace(/\*(\S[\s\S]+?)\*/g, function (wm, txt) {
    return parseInside (txt, '<em>', '</em>');
  });

  return text;
}