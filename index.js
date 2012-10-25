// ==========================================
// Copyright 2012 The Obvious Corporation
// Licensed under The MIT License
// http://opensource.org/licenses/MIT
// ==========================================

var _  = require("lodash")
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
SUS.PROTOCOCAL_REGEXP = /\/\//

function parseRules (base, sprites, options, complete) {
  var cache = {}

  // filter rules, if we find any empty ones (or ones which
  // have become empty from the declaration filter, then we
  // remove them from the rules list)
  async.filterSeries(base.rules, function (rule, nextRule) {

    // if rule has rules, that means it's a media query, so we
    // parse it recursively and generate a new sprites obj for it
    if (rule.rules) {

      // create a sprite object and push it to the sprite rules
      var spriteKey = sprites.rules.length
      var _sprite = _.clone(rule)
      _sprite.rules = []
      sprites.rules.push(_sprite)

      return parseRules(rule, _sprite, options, function (err, result) {
        // if no sprite rules, then we remove the sprite from the array
        if (!_sprite.rules.length) sprites.rules.splice(spriteKey, 1)

        // set the rules to the result of the parsed media query
        nextRule(rule.rules = result.length && result)
      })
    }

    // filter rule.declarations for declarations which contain a url()
    // that we can extract and inline in -sprites.css
    async.filterSeries(rule.declarations, function (declaration, nextDeclaration) {
      var ext
      var file
      var filepath

      //exit early if declaration doesn't contain a url
      if (!SUS.URL_REGEXP.test(declaration.value)) return nextDeclaration(declaration)

      file = RegExp.$1

      // exit early if url is a remote reference, and not local
      if (SUS.PROTOCOCAL_REGEXP.test(file)) return nextDeclaration(declaration)

      // if base is a function, set that to the file path
      if (typeof options.base == "function") {
        filepath = options.base(file)
      } else {
        filepath = path.join(options.base, file)
      }

      // parse ext name for uri type
      ext = path.extname(file).replace(SUS.DOT_REGEXP, "")

      // read img file and then add sprite sheet
      if (options.sync) {
        parseSprite(fs.readFileSync(filepath, "base64"), sprites, rule, declaration, cache, ext, nextDeclaration)
      } else {
        fs.readFile(filepath, "base64", function (err, data) {
          if (err) return complete(err)
          parseSprite(data, sprites, rule, declaration, cache, ext, nextDeclaration)
        })
      }
    }, function (result) {
      nextRule(rule.declarations = result.length && result)
    })

  }, function (result) {
    complete(null, (base.rules = result))
  })
}

function parseSprite(data, sprites, rule, declaration, cache, ext, complete) {
  var spriteRule
  var spriteDeclaration
  var dataURI

  // create data uri
  dataURI = "url(data:image/" + ext + ";base64," + data + ")"

  // define sprite declaration
  spriteDeclaration = {
    "property": declaration.property
  , "value": declaration.value.replace(SUS.URL_REGEXP, dataURI)
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

SUS.prototype.parse = function (complete) {
  this._base = CSS.parse(this.source)
  this._sprites = { "stylesheet": { "rules": [] } }

  // parse rules then report back to complete callback
  parseRules(this._base.stylesheet, this._sprites.stylesheet, this.options, function (err) {
    complete(err, this)
  }.bind(this))

  return this
}

SUS.prototype.base = function () {
  return CSS.stringify(this._base)
}

SUS.prototype.sprites = function () {
  return CSS.stringify(this._sprites)
}