var gulp = require('gulp'),
  inject = require('gulp-inject'),
  merge = require('merge-stream'),
  clean = require('gulp-clean'),
  glob = require("glob");

// built GUI folder location
var destination = 'build';

// Viztools folder location relative to build path
var VTPATH = 'viztools'


// Clean former run
gulp.task("clean", function () {
  return gulp.src(destination, {
    read: false
  })
    .pipe(clean());
});

// List of JS to include to the built GUI
jsToInclude = [];

// Append viztools to the built GUI
gulp.task('build', function () {

  // Get a list of JS files to include
  var jsToInclude = [];
  glob.sync('./fetch-vt/**/manifest.json').forEach(
    function (file) {
      var f = require(file);
      if (f.css) {
        Array.prototype.push.apply(jsToInclude, f.css.map(x => `${destination}/${VTPATH}/${x}`));
      }
      if (f.js) {
        Array.prototype.push.apply(jsToInclude, f.js.map(x => `${destination}/${VTPATH}/${x}`));
      }
    }
  );

  return merge(

    /* Update index.html with new JS & CSS */
    gulp.src('src/index.html')
      .pipe(inject(gulp.src(jsToInclude, {
        read: false,
      }), {
          starttag: '<!-- inject:{{ext}} -->',
          relative: true,
        }))
      .pipe(gulp.dest(destination)),

    /* Update VizToolsLibrary.js with new viztools */
    gulp.src('src/js/VizModule/VizToolsLibrary.js')
      .pipe(inject(gulp.src(`${destination}/${VTPATH}/**/viztool_def.json`), {
        starttag: '// inject:json',
        endtag: '// endinject',
        transform: function (filepath, file) {
          return file.contents.toString('utf8') + ',';
        }
      }))
      .pipe(gulp.dest(`${destination}/js/VizModule/'`))

  );
});

// Default GUI with no additional viztool linked
gulp.task('prepare', function () {
  return merge(
    /* Copy base GUI content to build folder */
    gulp.src(['./src/**/*']).pipe(gulp.dest(destination)),

    /* Copy all Viztools to build folder */
    gulp.src(['./fetch-vt/**']).pipe(gulp.dest(`${destination}/${VTPATH}/`))
  );
});

// Task aliases
gulp.task("default", ['clean', 'prepare', 'build']);

// Watch sources changes and trigger the build again
gulp.task("watch", function () {
  return gulp.watch('src/**/*.js', ['clean', 'prepare']);
});
