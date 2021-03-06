let should = require('chai').should();
let fs = require('fs');
let converter = require('./build/markdown');

function getTestSuite(dir) {
  return fs.readdirSync(dir)
    .filter((file) => file.slice(-3) === '.md')
    .map((fileName => {
      let file = 'file://' + process.cwd().replace(/\\/g, '/') + dir + fileName;
      let name = fileName.replace('.md', '');
      let htmlPath = dir + name + '.html';
      let html = fs.readFileSync(htmlPath, 'utf8');
      let mdPath = dir + name + '.md';
      let md = fs.readFileSync(mdPath, 'utf8');

      return {
        name:     name,
        input:    md,
        expected: html,
        file: file
      };
    }));
}

function normalize (testCase) {
  // Normalize line returns
  testCase.expected = testCase.expected.replace(/(\r\n)|\n|\r/g, '\n');
  testCase.actual = testCase.actual.replace(/(\r\n)|\n|\r/g, '\n');

  // Ignore all leading/trailing whitespace
  testCase.expected = testCase.expected.split('\n').map(function (x) {
    return x.trim();
  }).join('\n');
  testCase.actual = testCase.actual.split('\n').map(function (x) {
    return x.trim();
  }).join('\n');

  // Remove extra lines
  testCase.expected = testCase.expected.trim();
  testCase.actual = testCase.actual.trim();

  // Normalize line returns
  testCase.expected = testCase.expected.replace(/(\r\n)|\n|\r/g, '\n');
  testCase.actual = testCase.actual.replace(/(\r\n)|\n|\r/g, '\n');

  return testCase;
}

function assertion (testCase, converter, options={}) {
  return function () {
    converter.setOptions(options);
    testCase.actual = converter.makeHtml(testCase.input);
    testCase = normalize(testCase);
    testCase.actual.should.equal(testCase.expected, testCase.file);
  };
}

let standardTestsuites = [
  "blockquotes",
  "code",
  "ellipsis",
  "emojis",
  "emphasis",
  "escape",
  "headers",
  "horizontalRules",
  "html",
  "images",
  "links",
  "lists",
  "paragraphs",
  "strikethrough",
  "stripLinkDefinitions",
  "tables"
];

describe('makeHtml() standard testsuite', function () {
  standardTestsuites.forEach(testsuite => {
    describe(testsuite, function () {
      let tests = getTestSuite('test/standard/' + testsuite + '/');
      tests.forEach((test) => {
        it(test.name.replace(/-/g, ' '), assertion(test, converter));
      });
    });
  })
});

describe('makeHtml() imageCaptions testsuite', function () {
  let tests = getTestSuite('test/imageCaptions/');
  tests.forEach((test) => {
    it(test.name.replace(/-/g, ' '), assertion(test, converter, {imageCaptions: true}));
  });
});

describe('makeHtml() openLinkInNewTab testsuite', function () {
  let tests = getTestSuite('test/openLinksInNewTab/');
  tests.forEach((test) => {
    it(test.name.replace(/-/g, ' '), assertion(test, converter, {openLinksInNewTab: true}));
  });
});