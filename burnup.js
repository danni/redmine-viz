'use strict';

function Burnup (redmine) {
  var self = this;

  self.redmine = redmine;

  self.init();
}

Burnup.prototype = {

  init: function () {
    /* set up */
    var margin = {
      top: 10,
      right: 10,
      bottom: 10,
      left: 10
    };
    var width = 1000 - margin.left - margin.right;
    var height = 300 - margin.top - margin.bottom;

    var x = this.x = d3.scale.linear()
        .range([0, width]);
    var y = this.y = d3.scale.linear()
        .range([0, height]);

    var svg = this.svg = d3.select('body').append('svg')
      .append('g')
        .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');
  },

  load: function () {
    redmine.load_versions(function (versions) {
      redmine.load_issues(function (issues) {

        /* group the data by version */
        var issues_grouped = d3.nest()
          .key(function(d) { return d.fixed_version })
          .map(issues);

        /* sort the versions */
        versions.forEach(function (version) {
          version.issues = issues_grouped[version.name] || [];
          version.total_headaches = version.issues.reduce(sumHeadaches, 0);

          version.done_issues = version.issues.filter(doneIssues);
          version.done_headaches = version.done_issues.reduce(sumHeadaches, 0);

          version.maybe_done_issues = version.issues.filter(maybeDoneIssues);
          version.maybe_done_headaches =
              version.maybe_done_issues.reduce(sumHeadaches, 0);

          console.log("Version", version.name,
                      "Issues", version.issues.length,
                      "Headaches", version.total_headaches,
                      "Done", version.done_issues.length,
                      "Headaches", version.done_headaches,
                      "UAT", version.maybe_done_issues.length,
                      "Headaches", version.maybe_done_headaches);

          /* save some memory */
          delete version.issues;
          delete version.done_issues;
          delete version.maybe_done_issues;
        });

        // FIXME: pass versions here
      }, '*');
    });
  },

  visualise: function (data) {

    var x = this.x,
        y = this.y,
        svg = this.svg;
  }

}

function cleanup (name) {
  return name.replace(/[^A-Za-z0-9]+/g, '_');
}

function sumHeadaches (val1, val2) {
    return val1 + (+val2.headaches || 0);
}

function doneIssues (issue) {
    return ['Closed', 'Resolved', 'Acceptance Test Passed'].indexOf(issue.status) != -1;
}

function maybeDoneIssues (issue) {
    return ['Acceptance Test'].indexOf(issue.status) != -1;
}
