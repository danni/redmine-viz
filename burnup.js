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
      left: 50
    };
    var width = this.width = 1000 - margin.left - margin.right;
    var height = this.height = 300 - margin.top - margin.bottom;

    var x = this.x = d3.scale.ordinal()
        .rangePoints([0, width]);
    var y = this.y = d3.scale.linear()
        .range([height, 0]);

    var svg = this.svg = d3.select('body').append('svg')
      .append('g')
        .attr('class', 'burnup')
        .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');
    
    var xAxis = this.xAxis = d3.svg.axis()
        .scale(x)
        .orient('bottom');

    var yAxis = this.yAxis = d3.svg.axis()
        .scale(y)
        .orient('left');

    var total = this.total = d3.svg.line()
        .x(function(d) { return x(d.name) })
        .y(function(d) { return y(d.cum_total_headaches) });

    var burnup_done = this.burnup_done = d3.svg.area()
        .x(function(d) { return x(d.name) })
        .y0(function(d) { return y(0) })
        .y1(function(d) { return y(d.cum_complete_headaches) });

    var burnup_at = this.burnup_at = d3.svg.area()
        .x(function(d) { return x(d.name) })
        .y0(function(d) { return y(d.cum_complete_headaches) })
        .y1(function(d) {
            return y(d.cum_complete_headaches + d.cum_maybe_done_headaches)
        });
  },

  load: function () {
    var self = this;

    redmine.load_versions(function (versions) {
      redmine.load_issues(function (issues) {

        /* group the data by version */
        var issues_grouped = d3.nest()
          .key(function(d) { return d.fixed_version })
          .map(issues);

        var cum_total_headaches = 0,
            cum_complete_headaches = 0,
            cum_maybe_done_headaches = 0;

        /* sort the versions */
        var format = d3.time.format('%Y-%m-%d');
        var today = new Date();
        today.setDate(today.getDate() + 14); /* include this iteration */

        versions.sort(function(a, b) {
            return d3.ascending(format.parse(a.due_date),
                                format.parse(b.due_date));
        });
        versions.forEach(function (version) {
          version.due_date = format.parse(version.due_date);

          version.issues = issues_grouped[version.name] || [];
          version.total_headaches = version.issues.reduce(sumHeadaches, 0);

          version.done_issues = version.issues.filter(doneIssues);
          version.done_headaches = version.done_issues.reduce(sumHeadaches, 0);

          version.maybe_done_issues = version.issues.filter(maybeDoneIssues);
          version.maybe_done_headaches =
              version.maybe_done_issues.reduce(sumHeadaches, 0);

          /* save some memory */
          delete version.issues;
          delete version.done_issues;
          delete version.maybe_done_issues;

          /* sum cumulative totals */
          cum_total_headaches += version.total_headaches;
          version.cum_total_headaches = cum_total_headaches;

          cum_complete_headaches += version.done_headaches;
          cum_maybe_done_headaches += version.maybe_done_headaches;

          if (today >= version.due_date) {
            version.cum_complete_headaches = cum_complete_headaches;
            version.cum_maybe_done_headaches = cum_maybe_done_headaches;
          }
        });

        self.visualise(versions);
      }, '*');
    });
  },

  visualise: function (data) {

    var x = this.x,
        y = this.y,
        svg = this.svg,
        xAxis = this.xAxis,
        yAxis = this.yAxis,
        width = this.width,
        height = this.height;

    x.domain(data.map(function(v) { return v.name }));
    y.domain([0,
              d3.max(data, function(d) { return d.cum_total_headaches })]);

    svg.append('g')
        .attr('class', 'x axis')
        .attr('transform', 'translate(0,' + height + ')')
        .call(xAxis);

    svg.append('g')
        .attr('class', 'y axis')
        .call(yAxis);

    svg.append('path')
        .datum(data)
        .attr('class', 'total line')
        .attr('d', this.total);

    svg.append('path')
        .datum(data.filter(completedIterations))
        .attr('class', 'burnup area done')
        .attr('d', this.burnup_done);

    svg.append('path')
        .datum(data.filter(completedIterations))
        .attr('class', 'burnup area AT')
        .attr('d', this.burnup_at);
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

function completedIterations (version) {
    return (version.cum_complete_headaches !== undefined);
}
