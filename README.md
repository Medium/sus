SUS
===

SUS parses your css source and generates two new CSS sources from it – a base source and a sprites source.

The base source has all your original styles minus all background image defintions.

The sprites source has all your background image defintions, but converted to data-uris

### CLI

install sus with `npm install sus -g`

you can then run sus from your terminal

```
$ sus path/to/css/app.css
```

This will generate two files in place:

```
css
├── app-base.css
└── pay-sprites.css
```

Alternatively you can pass an option `--out` to specify which location the generated styles are placed:

```
$ sus path/to/css/app.css --out out/css/
```


### Programatic API

Sus accepts a string of css source and an options object. Use the options object to specify the location that your css is referencing images from. Alternatively pass a tranformer method to the base object to return fully resolved image paths.

```
var sus = require('sus')

sus(data, {
  base: '/foo/bar'
}).parse(function (err, parsed) {
  parsed.base()    // base css styles
  parsed.sprites() // base css styles
})
```