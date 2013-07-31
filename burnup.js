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
      top: 50,
      right: 100,
      bottom: 100,
      left: 50
    };
    var width = this.width = window.innerWidth - margin.left - margin.right;
    var height = this.height = window.innerHeight - margin.top - margin.bottom;

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

    var burnup_failing = this.burnup_failing = d3.svg.area()
        .x(function(d) { return x(d.name) })
        .y0(function(d) {
            return y(d.cum_complete_headaches + d.cum_maybe_done_headaches)
        })
        .y1(function(d) {
            return y(d.cum_complete_headaches +
                     d.cum_maybe_done_headaches +
                     d.cum_failed_at_headaches)
        });

    var regression = this.regression = d3.svg.line()
        .x(function(d) { return d.x })
        .y(function(d) { return d.y });
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
            cum_maybe_done_headaches = 0,
            cum_failed_at_headaches = 0;

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

          version.done_headaches = version.issues.filter(doneIssues)
                                                 .reduce(sumHeadaches, 0);
          version.maybe_done_headaches = version.issues.filter(maybeDoneIssues)
                                                       .reduce(sumHeadaches, 0);
          version.failed_at_headaches = version.issues.filter(failedATissues)
                                                      .reduce(sumHeadaches, 0);

          /* save some memory */
          delete version.issues;

          /* sum cumulative totals */
          cum_total_headaches += version.total_headaches;
          version.cum_total_headaches = cum_total_headaches;

          if (today >= version.due_date) {
            cum_complete_headaches += version.done_headaches;
            cum_maybe_done_headaches += version.maybe_done_headaches;
            cum_failed_at_headaches += version.failed_at_headaches;

            version.cum_complete_headaches = cum_complete_headaches;
            version.cum_maybe_done_headaches = cum_maybe_done_headaches;
            version.cum_failed_at_headaches = cum_failed_at_headaches;
          }
        });

        /* remove any versions off the front with 0 headaches,
         * these screw up our regressions */
        versions = versions.filter(function(v) {
            return v.cum_total_headaches > 0;
        })

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
        .call(xAxis)
      .append('text')
        .attr('class', 'label')
        .attr('x', width / 2)
        .attr('y', 40)
        .text("Iteration");

    svg.append('g')
        .attr('class', 'y axis')
        .call(yAxis)
      .append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', 6)
        .attr('dy', '.71em')
        .text("Headaches");

    var data_so_far = data.filter(completedIterations);

    svg.append('path')
        .datum(data_so_far)
        .attr('class', 'burnup area done')
        .attr('d', this.burnup_done);

    svg.append('path')
        .datum(data_so_far)
        .attr('class', 'burnup area AT')
        .attr('d', this.burnup_at);
    
    svg.append('path')
        .datum(data_so_far)
        .attr('class', 'burnup area failed')
        .attr('d', this.burnup_failing);

    /* compute regressions */
    function compute_regression(datain, key) {
        var lin = ss.linear_regression()
            .data(datain.map(function(d) {
                return [x(d.name), key(d)]
            }))
            .line();
        var out = data.map(function(d) {
            var x0 = x(d.name);

            return {
                x: x0,
                y: y(lin(x0))
            }
        });

        return out;
    }

    /* completed work */
    var regr = compute_regression(data_so_far,
            function(d) { return d.cum_complete_headaches });
    svg.append('path')
        .datum(regr)
        .attr('class', 'burnup regression done')
        .attr('d', this.regression);

    /* AT work */
    var regr = compute_regression(data_so_far, function(d) {
        return d.cum_complete_headaches + d.cum_maybe_done_headaches;
    });
    svg.append('path')
        .datum(regr)
        .attr('class', 'burnup regression AT')
        .attr('d', this.regression);
    
    /* Failed work */
    var regr = compute_regression(data_so_far, function(d) {
        return d.cum_complete_headaches +
               d.cum_maybe_done_headaches +
               d.cum_failed_at_headaches;
    });
    svg.append('path')
        .datum(regr)
        .attr('class', 'burnup regression failed')
        .attr('d', this.regression);

    svg.append('path')
        .datum(data)
        .attr('class', 'total line')
        .attr('d', this.total);

    /* labels */
    var last_version = data[data.length-1];
    svg.append('text')
        .attr('class', 'scope marker')
        .attr('x', x(last_version.name))
        .attr('y', y(last_version.cum_total_headaches))
        .attr('dx', '.3em')
        .attr('dy', '.3em')
        .text("Scope");
    
  }

}

function cleanup (name) {
  return name.replace(/[^A-Za-z0-9]+/g, '_');
}

function sumHeadaches (val1, val2) {
    return val1 + (+val2.headaches || 0);
}

function doneIssues (issue) {
    return ['Closed',
            'Resolved',
            'Acceptance Test Passed'
           ].indexOf(issue.status) != -1;
}

function failedATissues (issue) {
    return ['Acceptance Test Failed'].indexOf(issue.status) != -1;
}

function maybeDoneIssues (issue) {
    return ['Acceptance Test'].indexOf(issue.status) != -1;
}

function completedIterations (version) {
    return (version.cum_complete_headaches !== undefined);
}
