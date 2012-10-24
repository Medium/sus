var CSS     = require('css');
var sus     = require('..');
var fs      = require('fs');
var path    = require('path');
var assert  = require('assert');
var read    = fs.readFileSync;
var readdir = fs.readdirSync;

describe('sus(str)', function () {
  readdir('test/css').forEach(function (file) {
    it ('should correctly parse ' + file, function (done) {
      file = path.basename(file, '.css');
      fs.readFile(path.join('test', 'css', file + '.css'), 'utf-8', function (err, data) {
        sus(data, { base: "test/css" }).parse(function (err, suss) {
          fs.readFile(path.join('test', 'expected', [file, 'base'].join('-') + '.css'), 'utf-8', function (err, okBase) {
            fs.readFile(path.join('test', 'expected', [file, 'sprites'].join('-') + '.css'), 'utf-8', function (err, okSprites) {
              assert.equal(suss.base(), okBase)
              assert.equal(suss.sprites(), okSprites)
              done()
            })
          })
        })
      })
    })
  })
})