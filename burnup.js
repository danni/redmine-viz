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

    var x = this.x = d3.time.scale()
        .range([0, width]);
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

    /* the total scope:
     * the line rises over the iteration from the value at the end of the
     * last iteration to the final value it should be at the end of the
     * iteration */
    var total = this.total = d3.svg.line()
        .x(function(d) { return x(d.due_date) })
        .y(function(d) { return y(d.cum_total_headaches) });

    /* the cumulative burnup */
    var burnup_done = this.burnup_done = d3.svg.area()
        .x(function(d) { return x(d.date) })
        .y0(function(d) { return y(0) })
        .y1(function(d) { return y(d.cum_headaches) });

    // var burnup_at = this.burnup_at = d3.svg.area()
    //     .x(function(d) { return x(d.name) })
    //     .y0(function(d) { return y(d.cum_complete_headaches) })
    //     .y1(function(d) {
    //         return y(d.cum_complete_headaches + d.cum_maybe_done_headaches)
    //     });

    // var burnup_failing = this.burnup_failing = d3.svg.area()
    //     .x(function(d) { return x(d.name) })
    //     .y0(function(d) {
    //         return y(d.cum_complete_headaches + d.cum_maybe_done_headaches)
    //     })
    //     .y1(function(d) {
    //         return y(d.cum_complete_headaches +
    //                  d.cum_maybe_done_headaches +
    //                  d.cum_failed_at_headaches)
    //     });

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

        var cum_total_headaches = 0;

        /* sort the versions */
        var format = d3.time.format('%Y-%m-%d'),
            start_date = undefined;

        function parse_date(v) {
            if (v.due_date === undefined) {
                /* make a date 1 year in the future */
                v.due_date = d3.time.year.offset(new Date(), 1);
            } else if (!(v.due_date instanceof Date)) {
                v.due_date = format.parse(v.due_date);
            }

            return v.due_date;
        }

        versions.sort(function(a, b) {
            parse_date(a);
            parse_date(b);

            return d3.ascending(a.due_date, b.due_date);
        });
        versions.forEach(function (version) {
          parse_date(version);
          version.start_date = start_date;
          start_date = version.due_date;

          version.issues = issues_grouped[version.name] || [];
          version.total_headaches = version.issues.reduce(sumHeadaches, 0);

          /* save some memory */
          delete version.issues;

          /* sum cumulative totals */
          cum_total_headaches += version.total_headaches;
          version.cum_total_headaches = cum_total_headaches;
        });

        /* remove any versions off the front with 0 headaches,
         * these screw up our regressions */
        versions = versions.filter(function(v) {
            return v.cum_total_headaches > 0;
        })

        self.first_date = versions[0].start_date;
        self.last_date = versions[versions.length-1].due_date;

        /* group the issues by date closed, then apply a rollup to count
         * the number of headaches closed on each date */
        var format = d3.time.format.iso;
        var issues_grouped = d3.nest()
            .key(function(d) {
                d.closed_date = d3.time.day.floor(format.parse(d.closed_on));
                return d.closed_date;
            })
            .rollup(function(leaves) {
                return {
                    date: leaves[0].closed_date,
                    headaches: leaves.reduce(sumHeadaches, 0)
                }
            })
            .map(issues.filter(issueClosed), d3.map)
            .values()
            .sort(function(d1, d2) {
                return d3.ascending(d1.date, d2.date);
            }).filter(function(d) {
                return d.headaches > 0;
            });

        var cum_complete_headaches = 0;
        issues_grouped.forEach(function(d) {
            d.cum_headaches =
                cum_complete_headaches += d.headaches;
        });

        /* add today */
        issues_grouped.push({
            date: new Date(),
            cum_headaches: cum_complete_headaches
        });

        self.visualise_iterations(versions);
        self.visualise_burnup(issues_grouped);
      }, '*');
    });
  },

  visualise_iterations: function (data) {

    var x = this.x,
        y = this.y,
        svg = this.svg,
        xAxis = this.xAxis,
        yAxis = this.yAxis,
        width = this.width,
        height = this.height;

    x.domain([data[0].start_date,
              data[data.length-1].due_date]);
    y.domain([0,
              d3.max(data, function(d) { return d.cum_total_headaches })]);

    /* colour the iterations */
    svg.append('g')
        .attr('class', 'iterations')
      .selectAll('rect')
        .data(data)
        .enter().append('rect')
          .attr('class', 'iteration')
          .attr('x', function(d) {
              return x(d.start_date);
          })
          .attr('y', 0)
          .attr('width', function(d) {
              return x(d.due_date) - x(d.start_date);
          })
          .attr('height', y(0))
    svg.select('g.iterations')
        .selectAll('text')
        .data(data)
        .enter().append('text')
          .attr('x', function(d) {
              return (x(d.due_date) + x(d.start_date)) / 2
          })
          .attr('y', 0)
          .attr('dy', -3)
          .text(function(d) { return d.name });

    /* x axis */
    svg.append('g')
        .attr('class', 'x axis')
        .attr('transform', 'translate(0,' + height + ')')
        .call(xAxis)

    /* y axis */
    svg.append('g')
        .attr('class', 'y axis')
        .call(yAxis)
      .append('text')
        .attr('transform', 'rotate(-90)')
        .attr('x', -10)
        .attr('y', 6)
        .attr('dy', '.71em')
        .text("Headaches");

    // var data_so_far = data.filter(completedIterations);

    // svg.append('path')
    //     .datum(data_so_far)
    //     .attr('class', 'burnup area AT')
    //     .attr('d', this.burnup_at);
    // 
    // svg.append('path')
    //     .datum(data_so_far)
    //     .attr('class', 'burnup area failed')
    //     .attr('d', this.burnup_failing);

    // /* compute regressions */

    // /* AT work */
    // var regr = compute_regression(data_so_far, function(d) {
    //     return d.cum_complete_headaches + d.cum_maybe_done_headaches;
    // });
    // svg.append('path')
    //     .datum(regr)
    //     .attr('class', 'burnup regression AT')
    //     .attr('d', this.regression);
    // 
    // /* Failed work */
    // var regr = compute_regression(data_so_far, function(d) {
    //     return d.cum_complete_headaches +
    //            d.cum_maybe_done_headaches +
    //            d.cum_failed_at_headaches;
    // });
    // svg.append('path')
    //     .datum(regr)
    //     .attr('class', 'burnup regression failed')
    //     .attr('d', this.regression);

    /* append a 0 value */
    data.unshift({
        due_date: data[0].start_date,
        cum_total_headaches: 0
    });

    /* the scope */
    svg.append('path')
        .datum(data)
        .attr('class', 'total line')
        .attr('d', this.total);

    /* labels */
    var last_version = data[data.length-1];
    svg.append('text')
        .attr('class', 'burnup scope marker')
        .attr('x', x(last_version.due_date))
        .attr('y', y(last_version.cum_total_headaches))
        .attr('dx', '.3em')
        .attr('dy', '.3em')
        .text("Scope");

    // var last_version = data_so_far[data_so_far.length-1];
    // 
    // svg.append('text')
    //     .attr('class', 'burnup AT marker')
    //     .attr('x', x(last_version.name))
    //     .attr('y', y(last_version.cum_complete_headaches + last_version.cum_maybe_done_headaches))
    //     .attr('dx', '.3em')
    //     .attr('dy', '.3em')
    //     .text("Awaiting AT");
    // 
    // svg.append('text')
    //     .attr('class', 'burnup failed marker')
    //     .attr('x', x(last_version.name))
    //     .attr('y', y(last_version.cum_complete_headaches + last_version.cum_maybe_done_headaches + last_version.cum_failed_at_headaches))
    //     .attr('dx', '.3em')
    //     .attr('dy', '.3em')
    //     .text("Failed AT");
  },

  visualise_burnup: function (data) {

    var x = this.x,
        y = this.y,
        svg = this.svg,
        xAxis = this.xAxis,
        yAxis = this.yAxis,
        width = this.width,
        height = this.height;
    
    var last = data[data.length-1];

    /* plot the burnup */
    svg.append('path')
        .datum(data)
        .attr('class', 'burnup area done')
        .attr('d', this.burnup_done);

    /* label the burnup */
    svg.append('text')
        .attr('class', 'burnup done marker')
        .attr('x', x(last.date))
        .attr('y', y(last.cum_headaches))
        .attr('dx', '.3em')
        .attr('dy', '.3em')
        .text("Completed");

    svg.append('path')
        .datum(this.compute_regression(data,
                                       function(d) { return d.cum_headaches }))
        .attr('class', 'burnup regression done')
        .attr('d', this.regression);
  },

  compute_regression: function (datain, key) {
      var x = this.x,
          y = this.y,
          start_date = this.first_date,
          end_date = this.last_date;

      var lin = ss.linear_regression()
          .data(datain.map(function(d) {
              return [x(d.date), key(d)]
          }))
          .line();

      /* calculate the iteration velocity */
      var next_date = d3.time.week.offset(start_date, 2),
          velocity = lin(x(next_date)) - lin(x(start_date));
      console.log("Velocity (per 14 day iteration):", velocity);

      var a = [{ x: x(start_date), y: y(lin(x(start_date))) },
               { x: x(end_date), y: y(lin(x(end_date))) }];
      return a;
  }
}

function cleanup (name) {
  return name.replace(/[^A-Za-z0-9]+/g, '_');
}

function sumHeadaches (val1, val2) {
    return val1 + (+val2.headaches || 0);
}

function issueClosed (issue) {
    return issue.closed_on !== undefined;
}

function failedATissues (issue) {
    return ['Acceptance Test Failed'].indexOf(issue.status) != -1;
}

function maybeDoneIssues (issue) {
    return ['Acceptance Test'].indexOf(issue.status) != -1;
}
