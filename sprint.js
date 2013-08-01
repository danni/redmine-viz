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

    var svg = this.svg = d3.select('#burndown')
      .append('g')
        .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

    /* add the clip path */
    d3.select('#burndown defs')
      .append('clipPath')
        .attr('id', 'clipRegion')
      .append('rect')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', width)
        .attr('height', height);

    
    var xAxis = this.xAxis = d3.svg.axis()
        .scale(x)
        .orient('bottom');

    var yAxis = this.yAxis = d3.svg.axis()
        .scale(y)
        .orient('left');

    var burndown = this.burndown = d3.svg.line()
        .x(function(d) { return x(d.date) })
        .y(function(d) { return y(d.headaches) });
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

            /* filter the issues to only consider closed issues
             * and sort by close date */
            issues = issues.filter(function(i) {
                if (i.closed_on === undefined)
                    return false;

                i.closed_on = d3.time.format.iso.parse(i.closed_on);
                return true;
            }).sort(function(i1, i2) {
                return d3.ascending(i1.closed_on, i2.closed_on);
            });

            /* calculate the cumulative sum */
            var burndown = issues.map(function(i) {
                return {
                    date: i.closed_on,
                    headaches: headaches -= +i.headaches
                }
            });
            /* add a point for right now */
            burndown.push({
                date: new Date(),
                headaches: headaches
            });
            console.log(burndown);

            self.visualise_burndown(burndown);
        });
    });
  },


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
        .attr('d', this.burndown)
        .attr('clip-path', 'url(#clipRegion)');
  },

  visualise_burndown: function (data) {

    var x = this.x,
        y = this.y,
        svg = this.svg,
        xAxis = this.xAxis,
        yAxis = this.yAxis,
        width = this.width,
        height = this.height;
    
    /* plot the burndown */
    svg.append('path')
        .datum(data)
        .attr('class', 'line done')
        .attr('marker-end', 'url(#Circle)')
        .attr('clip-path', 'url(#clipRegion)')
        .attr('d', this.burndown);
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
