require('node:fs').mkdirSync('reports', { recursive: true });

module.exports = {
  default: {
    paths: ['test/cucumber/features/**/*.feature'],
    require: ['test/cucumber/support/**/*.cjs'],
    format: ['progress', 'html:reports/cucumber.html'],
    parallel: 0,
  },
};
