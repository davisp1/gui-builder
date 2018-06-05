var gulp = require('gulp'),
  inject = require('gulp-inject'),
  merge = require('merge-stream'),
  clean = require('gulp-clean'),
  glob = require("glob");

var dest = 'dist';

gulp.task("clean", function () {
  return gulp.src(dest, {
    read: false
  })
    .pipe(clean());
});

jsToInclude = [];
gulp.task('build-contrib', ['build-ikats'], function () {

  var jsToInclude = [];
  glob.sync('./contrib/**/manifest.json').forEach(
    function (file) {
      var f = require(file)
      var arrPath = file.split('/');
      var prefix = arrPath.splice(1, arrPath.length - 4).join('/')
      Array.prototype.push.apply(jsToInclude,
        f.css.map(x => dest + '/' + prefix + '/' + x));
      Array.prototype.push.apply(jsToInclude,
        f.js.map(x => dest + '/' + prefix + '/' + x));
    });

  return merge(

    /* Update index.html with new JS & CSS */
    gulp.src(dest + '/index.html')
      .pipe(inject(gulp.src(jsToInclude, {
        read: false,
        base: 'contrib'
      }), {
          starttag: '<!-- inject:{{ext}} -->',
          relative: true,
        }))
      .pipe(gulp.dest(dest)),

    /* Update VizToolsLibrary.js with new viztools */
    gulp.src(dest + '/js/VizModule/VizToolsLibrary.js')
      .pipe(inject(gulp.src('contrib/*/viz/**/viztool_def.json'), {
        starttag: '// inject:json',
        endtag: '// endinject',
        transform: function (filepath, file) {
          return file.contents.toString('utf8') + ',';
        }
      }))
      .pipe(gulp.dest(dest + '/js/VizModule/'))

  );
});

gulp.task('build-ikats', function () {
  return merge(
    gulp.src(['./src/versions.txt']).pipe(gulp.dest(dest)),
    gulp.src(['./src/index.html']).pipe(gulp.dest(dest)),
    gulp.src(['./src/js/**/*.js']).pipe(gulp.dest(dest + '/js')),
    gulp.src(['./src/css/**']).pipe(gulp.dest(dest + '/css')),
    gulp.src(['./src/fonts/**']).pipe(gulp.dest(dest + '/fonts')),
    gulp.src(['./src/icons/**']).pipe(gulp.dest(dest + '/icons')),
    gulp.src(['./src/lib/**/*']).pipe(gulp.dest(dest + '/lib')),
    gulp.src(['./src/views/**/*']).pipe(gulp.dest(dest + '/views')),
    /* Copy the contributor root path to the build folder */
    gulp.src('./contrib/*/viz/**').pipe(gulp.dest(dest + '/contrib'))
  );
});


gulp.task("build", ['build-ikats', 'build-contrib']);
gulp.task("default", ['clean', 'build']);

gulp.task("watch", function () {
  return gulp.watch('src/**/*.js', ['clean', 'build-ikats']);
});
