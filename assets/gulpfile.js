var gulp = require('gulp'),
  gutil = require('gulp-util'),
  inject = require('gulp-inject'),
  merge = require('merge-stream'),
  clean = require('gulp-clean'),
  replace = require('gulp-replace'),
  glob = require("glob");

// Viztools sources folder location
var vtSources = 'fetch-vt';

// built GUI folder location
var destination = 'build';

// Viztools folder location relative to build path
var VTPATH = 'viztools'

// Update API endpoints
gulp.task("set-api-endpoints", function () {
  return gulp.src(`${destination}/js/ikats_api.js`)
    .pipe(replace(/ikats\.constants\.tomee_addr = .*;/, `ikats.constants.tomee_addr = "${gutil.env.tomee}";`))
    .pipe(replace(/ikats\.constants\.gunicorn_addr = .*;/, `ikats.constants.gunicorn_addr = "${gutil.env.gunicorn}";`))
    .pipe(replace(/ikats\.constants\.tomcat_addr = .*;/, `ikats.constants.tomcat_addr = "${gutil.env.tomcat}";`))
    .pipe(replace(/ikats\.constants\.opentsdb_addr = .*;/, `ikats.constants.opentsdb_addr = "${gutil.env.opentsdb}";`))
    .pipe(gulp.dest(`${destination}/js/`));
});

// Clean former run
gulp.task("clean", function () {
  return gulp.src(`${destination}/*`, {
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
  glob.sync(`./${vtSources}/**/manifest.json`).forEach(
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
        read: false
      }), {
          starttag: '<!-- inject:{{ext}} -->',
          relative: true,
          ignorePath: `../${destination}/`
        }))
      .pipe(gulp.dest(destination)),

    /* Update VizToolsLibrary.js with new viztools */
    gulp.src('src/js/VizModule/VizToolsLibrary.js')
      .pipe(inject(gulp.src(`${vtSources}/**/viztool_def.json`), {
        starttag: '/* inject:json */',
        endtag: '/* endinject */',
        transform: function (filepath, file) {
          return file.contents.toString('utf8') + ',';
        }
      }))
      .pipe(gulp.dest(`${destination}/js/VizModule/`))

  );
});

// Default GUI with no additional viztool linked
gulp.task('prepare', function () {
  return merge(
    /* Copy base GUI content to build folder */
    gulp.src(['./src/**/*']).pipe(gulp.dest(destination)),

    /* Copy all Viztools to build folder */
    gulp.src([`./${vtSources}/**`]).pipe(gulp.dest(`${destination}/${VTPATH}/`))
  );
});

// Task aliases
gulp.task("default", ['clean', 'prepare', 'build', 'set-api-endpoints']);

// Watch sources changes and trigger the build again
gulp.task("watch", function () {
  return gulp.watch('src/**/*.js', ['clean', 'prepare']);
});
