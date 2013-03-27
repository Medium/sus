// Copyright 2012 The Obvious Corporation

var fs = require("fs")
var CSS = require("css")
var path = require("path")
var async = require("async")

module.exports = SUS

function SUS (source, options) {
  if (!(this instanceof SUS)) return new SUS(source, options)
  this.source = source
  this.options = options || {}
}

// These are the RegExp constants we use
SUS.DOT_REGEXP = /^./
SUS.URL_REGEXP = /url\s*\(['"]?([^\)'"]+)['"]?\)/
SUS.URL_REGEXP_GLOBAL = /url\s*\(['"]?[^\)'"]+['"]?\)/g
SUS.PROTOCOCAL_REGEXP = /\/\//

function extend (obj) {
  Array.prototype.slice.call(arguments, 1).forEach(function (source) {
    for (var prop in source) {
      obj[prop] = source[prop]
    }
  })
  return obj
}

function parseRules (base, sprites, options, complete) {


  // filter rules, if we find any empty ones (or ones which
  // have become empty from the declaration filter, then we
  // remove them from the rules list)
  async.filterSeries(base.rules, function (rule, nextRule) {

    // if rule has rules, that means it's a media query, so we
    // parse it recursively and generate a new sprites obj for it
    if (rule.rules) {

      // create a sprite object and push it to the sprite rules
      var spriteKey = sprites.rules.length
      var _sprite = extend({}, rule)
      _sprite.rules = []
      sprites.rules.push(_sprite)

      return parseRules(rule, _sprite, options, function (err, result) {
        // if no sprite rules, then we remove the sprite from the array
        if (!_sprite.rules.length) sprites.rules.splice(spriteKey, 1)

        // set the rules to the result of the parsed media query
        nextRule(rule.rules = result.length && result)
      })
    }

    // we craete a new stack – css files can get quite large and without this
    // you can sometimes exceed the callstack limit
    process.nextTick(function () {

      // skip keyframes and font-face declarations
      if (rule.keyframes || (rule.selectors[0] && rule.selectors[0] == '@font-face')) {
        return nextRule(rule)
      }

      // filter rule.declarations for declarations which contain a url()
      // that we can extract and inline in -sprites.css
      async.filterSeries(rule.declarations, function (declaration, nextDeclaration) {

        var files = declaration.value.match(SUS.URL_REGEXP_GLOBAL)

        //exit early if declaration doesn't contain a url
        if (!files) return nextDeclaration(declaration)

        // look over all occurences of url_regexp
        async.map(files, function (file, nextFile) {

          // get inner file value
          var filepath = file.match(SUS.URL_REGEXP)[1]

          // exit early if url is a remote reference, and not local
          if (SUS.PROTOCOCAL_REGEXP.test(filepath)) return nextFile(null)

          // if base is a function, set that to the file path
          if (typeof options.base == 'function') {
            filepath = options.base(filepath)
          } else if (typeof options.base != 'undefined') {
            filepath = path.join(options.base, filepath)
          }

          // read img file and then add sprite sheet
          fs.readFile(filepath, "base64", function (err, data) {
            if (err) return complete(err)
            nextFile(null, {
              expression: file
            , ext: path.extname(filepath).replace(SUS.DOT_REGEXP, "")
            , path: filepath
            , data: data
            })
          })

        }, function (err, results) {
          if (!results.filter(function (r) { return r }).length) return nextDeclaration(declaration)
          parseSprite(results, sprites, rule, declaration, nextDeclaration)
        })

      }, function (result) {
        nextRule(rule.declarations = result.length && result)
      })

    })

  }, function (result) {
    complete(null, (base.rules = result))
  })
}

function parseSprite(files, sprites, rule, declaration, complete) {
  var value = declaration.value
  var spriteRule
  var spriteDeclaration
  var dataURI

  files.forEach(function (file) {
    dataURI = "url(data:image/" + file.ext + ";base64," + file.data + ")"
    value = value.replace(file.expression, dataURI)
  })

  // define sprite declaration
  spriteDeclaration = {
    "property": declaration.property
  , "value": value
  }

  // define sprite rule
  spriteRule = {
    "selectors": rule.selectors
  , "declarations": [ spriteDeclaration ]
  }

  // remove declaration entry from -base.css
  declaration = null

  // add sprite rule to sprites
  sprites.rules.push(spriteRule)

  complete(declaration)
}

SUS.prototype.parse = function (callback) {
  this._base = CSS.parse(this.source)
  this._sprites = { "stylesheet": { "rules": [] } }

  // parse rules then report back to complete callback
  parseRules(this._base.stylesheet, this._sprites.stylesheet, this.options, function (err) {
    callback(err, this)
  }.bind(this))

  return this
}

SUS.prototype.base = function () {
  return CSS.stringify(this._base)
}

SUS.prototype.sprites = function () {
  return CSS.stringify(this._sprites)
}
