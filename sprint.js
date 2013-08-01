'use strict';

function Sprint (redmine) {
  var self = this;

  self.redmine = redmine;

  self.init();
}

Sprint.prototype = {

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
    var ideal_burndown = this.ideal_burndown = d3.svg.line()
        .x(function(d) { return x(d.date) })
        .y(function(d) { return y(d.headaches) });

    /* the cumulative burnup */
    // var burnup_done = this.burnup_done = d3.svg.area()
    //     .x(function(d) { return x(d.date) })
    //     .y0(function(d) { return y(0) })
    //     .y1(function(d) { return y(d.cum_headaches) });

    // var regression = this.regression = d3.svg.line()
    //     .x(function(d) { return d.x })
    //     .y(function(d) { return d.y });
  },

  load: function () {
    var self = this;

    redmine.load_versions(function (versions) {

        /* find the current sprint */
        var today = new Date();
        versions = versions.filter(function(v) {
            parse_date(v);

            return v.due_date > today;
        }).sort(function(v1, v2) {
            return d3.ascending(v1.due_date, v2.due_date);
        });

        var version = versions[0];

        console.log("Iteration:", version.name);

        /* FIXME: can I request just this version? */
        redmine.load_issues(function (issues) {

            /* find all issues assigned to this version */
            issues = issues.filter(function(i) {
                return i.fixed_version === version.name;
            });

            /* calculate the total headaches */
            var headaches = d3.sum(issues, function(i) {
                return i.headaches;
            });

            console.log("Total headaches:", headaches);
            self.visualise_sprint(version, headaches);
        });
    });
  },

//        /* group the data by version */
//        var issues_grouped = d3.nest()
//          .key(function(d) { return d.fixed_version })
//          .map(issues);
//
//        var cum_total_headaches = 0;
//
//        /* sort the versions */
//
//        versions.sort(function(a, b) {
//            parse_date(a);
//            parse_date(b);
//
//            return d3.ascending(a.due_date, b.due_date);
//        });
//        versions.forEach(function (version) {
//          parse_date(version);
//          version.start_date = start_date;
//          start_date = version.due_date;
//
//          version.issues = issues_grouped[version.name] || [];
//          version.total_headaches = version.issues.reduce(sumHeadaches, 0);
//
//          /* save some memory */
//          delete version.issues;
//
//          /* sum cumulative totals */
//          cum_total_headaches += version.total_headaches;
//          version.cum_total_headaches = cum_total_headaches;
//        });
//
//        /* remove any versions off the front with 0 headaches,
//         * these screw up our regressions */
//        versions = versions.filter(function(v) {
//            return v.cum_total_headaches > 0;
//        })
//
//        self.first_date = versions[0].start_date;
//        self.last_date = versions[versions.length-1].due_date;
//
//        /* group the issues by date closed, then apply a rollup to count
//         * the number of headaches closed on each date */
//        var format = d3.time.format.iso;
//        var issues_grouped = d3.nest()
//            .key(function(d) {
//                d.closed_date = d3.time.day.floor(format.parse(d.closed_on));
//                return d.closed_date;
//            })
//            .rollup(function(leaves) {
//                return {
//                    date: leaves[0].closed_date,
//                    headaches: leaves.reduce(sumHeadaches, 0)
//                }
//            })
//            .map(issues.filter(issueClosed), d3.map)
//            .values()
//            .sort(function(d1, d2) {
//                return d3.ascending(d1.date, d2.date);
//            }).filter(function(d) {
//                return d.headaches > 0;
//            });
//
//        var cum_complete_headaches = 0;
//        issues_grouped.forEach(function(d) {
//            d.cum_headaches =
//                cum_complete_headaches += d.headaches;
//        });
//
//        /* add today */
//        issues_grouped.push({
//            date: new Date(),
//            cum_headaches: cum_complete_headaches
//        });
//
//        self.visualise_iterations(versions);
//        self.visualise_burnup(issues_grouped);
//      }, '*');
//    });
//  },

  visualise_sprint: function (version, headaches) {

    var x = this.x,
        y = this.y,
        svg = this.svg,
        xAxis = this.xAxis,
        yAxis = this.yAxis,
        width = this.width,
        height = this.height;

    /* assume the sprint starts 2 weeks before the due date */
    var start_date = d3.time.day.offset(version.due_date, -13);
    var end_date = d3.time.day.offset(version.due_date, 1);

    /* set the domain and range */
    x.domain([start_date, end_date]);
    y.domain([0, headaches]);

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

    /* calculate the ideal burndown -
     * in 2 weeks we will have 2 weekends, include this in our data */
    var first_fri = d3.time.saturday.ceil(start_date),
        days_to_first_fri = d3.time.days(start_date, first_fri).length,
        headaches_per_work_day = headaches / 10,
        headaches_by_first_weekend = headaches - headaches_per_work_day * days_to_first_fri,

        second_week = d3.time.monday.ceil(first_fri),
        second_fri = d3.time.saturday.ceil(second_week),
        headaches_by_second_weekend = headaches_by_first_weekend - headaches_per_work_day * 5,

        third_week = d3.time.monday.ceil(second_fri),

        burndown = [
        { date: start_date, headaches: headaches },
        { date: first_fri, headaches: headaches_by_first_weekend },
        { date: second_week, headaches: headaches_by_first_weekend },
        { date: second_fri, headaches: headaches_by_second_weekend },
        { date: third_week, headaches: headaches_by_second_weekend },
        { date: end_date, headaches: 0 }
    ];

    /* plot ideal burndown */
    svg.append('path')
        .datum(burndown)
        .attr('class', 'total line')
        .attr('d', this.ideal_burndown);

    /* plot today */
    var today = d3.time.day.floor(new Date()),
        data = [
        { date: today, headaches: headaches },
        { date: today, headaches: 0 }
    ];
    
    svg.append('path')
        .datum(data)
        .attr('class', 'today line')
        .attr('d', this.ideal_burndown);

//    /* append a 0 value */
//    data.unshift({
//        due_date: data[0].start_date,
//        cum_total_headaches: 0
//    });
//
//    /* the scope */
//
//    /* labels */
//    var last_version = data[data.length-1];
//    svg.append('text')
//        .attr('class', 'burnup scope marker')
//        .attr('x', x(last_version.due_date))
//        .attr('y', y(last_version.cum_total_headaches))
//        .attr('dx', '.3em')
//        .attr('dy', '.3em')
//        .text("Scope");
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

function parse_date(v) {
    var format = d3.time.format('%Y-%m-%d');

    if (v.due_date === undefined) {
        /* make a date 1 year in the future */
        v.due_date = d3.time.year.offset(new Date(), 1);
    } else if (!(v.due_date instanceof Date)) {
        v.due_date = format.parse(v.due_date);
    }

    return v.due_date;
}
