// Generated on <%= (new Date).toISOString().split('T')[0] %> using <%= pkg.name %> <%= pkg.version %>
'use strict';

var gulp = require('gulp'),
    $ = require('gulp-load-plugins')();

var paths = {
  styles: 'app/styles/**/*.scss',
  scripts: 'app/scripts/**/*.js',
  images: 'app/images/**/*.{gif,jpg,png,svg,webp}',
  extras: 'app/*.*',
  html: ['app/**/*.html'],
  index: 'app/templates/_layout.html',
  clean: ['.tmp/*', 'public/**/*',
      '!public/assets', '!public/assets/**/*',
      '!public/index.php', '!public/.htaccess']
};

/**
 * 1. Add dokku remote to git repository.
 * 2. Push to dokku to intialize app container.
 * 3. Set a custom PHP buildpack
 * 4. Create mariadb container.
 * 5. Link app container with mariadb container.
 */
gulp.task('deploy-init', $.shell.task([
  'git remote add dokku dokku@staging.francisbond.com:<%= _.slugify(slug) %>', /*[1]*/
  'git push dokku master', /*[2]*/
  'ssh dokku@staging.francisbond.com config:set <%= _.slugify(slug) %> BUILDPACK_URL=https://github.com/CHH/heroku-buildpack-php', /*[3]*/
  'ssh dokku@staging.francisbond.com mariadb:create <%= _.slugify(slug) %>', /*[4]*/
  'ssh dokku@staging.francisbond.com mariadb:link <%= _.slugify(slug) %> <%= _.slugify(slug) %>' /*[5]*/
]));

gulp.task('deploy', $.shell.task([
  'git push dokku master'
]));

/**
 * 1. Check if .tmp exists, create it if it doesn't.
 * 2. Dump the local database to .tmp/local.sql.
 */
gulp.task('db-dump-local', ['build'], $.shell.task([
  '[ -d ".tmp" ] || mkdir .tmp', /*[1]*/
  'vagrant ssh --command "mysqldump -uroot -proot <%= _.slugify(slug) %> > /vagrant/.tmp/local.sql"' /*[2]*/
]));

/**
 * 1. Check if .tmp exists, create it if it doesn't.
 * 2. Dump the remote database to .tmp/remote.sql.
 */
gulp.task('db-dump-remote', ['build'], $.shell.task([
  '[ -d ".tmp" ] || mkdir .tmp', /*[1]*/
  'ssh dokku@staging.francisbond.com mariadb:dumpraw <%= _.slugify(slug) %> | tee .tmp/remote.sql > /dev/null' /*[2]*/
]));

gulp.task('db-push', ['db-dump-local'], $.shell.task([
  'ssh dokku@staging.francisbond.com mariadb:console <%= _.slugify(slug) %> < .tmp/local.sql'
]));

gulp.task('db-pull', ['db-dump-remote'], $.shell.task([
  'vagrant ssh --command "mysql -uroot -proot <%= _.slugify(slug) %> < /vagrant/.tmp/remote.sql"'
]));

gulp.task('db-dump', ['clean', 'db-dump-local', 'db-dump-remote'], function() {
  return gulp.src(['.tmp/local.sql', '.tmp/remote.sql'])
    .pipe(gulp.dest('databases'));
});

gulp.task('styles', function() {
  return gulp.src([paths.styles, 'bower_components/**/*.scss'])
    .pipe($.plumber())
    .pipe($.rubySass({
      style: 'expanded',
      precision: 10
    }))
    .pipe($.autoprefixer('last 1 version'))
    .pipe(gulp.dest('public/styles'))
});

gulp.task('scripts', function() {
  return gulp.src(paths.scripts)
    .pipe($.jshint())
    .pipe($.jshint.reporter('jshint-stylish'))
    .pipe($.jshint.reporter('fail'))
    .pipe(gulp.dest('public/scripts'));
});

gulp.task('images', function () {
  return gulp.src(paths.images)
    .pipe($.cache($.imagemin({
      progressive: true,
      interlaced: true
    })))
    .pipe(gulp.dest('public/images'));
});

gulp.task('extras', function() {
  return gulp.src(paths.extras, { dot: true })
    .pipe(gulp.dest('public'));
});

gulp.task('clean', function(cb) {
  require('del').bind(null, paths.clean)
});

gulp.task('build', ['clean'], function() {
  gulp.start('build-useref');
});

gulp.task('build-useref', ['images', 'styles', 'extras'], function() {
  var jsFilter = filter('**/*.js');
  var cssFilter = filter('**/*.css');

  return gulp.src(paths.html)
    .pipe($.useref.assets({searchPath: '{public,app}'}))
    .pipe($.jsFilter)
    .pipe($.uglify())
    .pipe($.jsFilter.restore())
    .pipe($.cssFilter)
    .pipe($.csso())
    .pipe($.cssFilter.restore())
    .pipe($.useref.restore())
    .pipe($.useref())
    .pipe(gulp.dest('public'));
});

gulp.task('watch', function() {
  gulp.src(paths.index($.inject('http://localhost:35729/livereload.js')));

  gulp.start('extras')
    .start('scripts')
    .start('images')
    .start('build-useref');

  livereload.listen();
  gulp.watch('public/**/*')
    .on('change', $.livereload.changed);

  gulp.watch(paths.extras, ['extras']);
  gulp.watch(paths.html, ['build-useref']);
  gulp.watch(paths.scripts, ['scripts', 'build-useref']);
  gulp.watch(paths.styles, ['build-useref']);
  gulp.watch(paths.images, ['images']);
});

gulp.task('default', ['build']);