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

    /* specify the domain of the axes */
    // FIXME: x domain is hard coded
/*
    x.domain([0, 30]);
    y.domain(FILTER_STATUSES);
*/

/*
    this.labels = svg.append('g')
        .attr('class', 'labels')
      .selectAll('text')
        .data(y.domain())
      .enter().append('text')
        .attr('class', 'label')
        .attr('x', -6)
        .attr('y', function(d) { return y(d) + y.rangeBand() / 2; })
        .text(function (d) { return d })
      .transition().duration(750)
        .attr('opacity', 1);
*/
  },

  load: function () {
    redmine.load_versions(function (versions) {
      redmine.load_issues(function (issues) {

        /* group the data by version */
        var issues_grouped = d3.nest()
          .key(function(d) { return d.fixed_version })
          .map(issues);

        console.log(issues);

        /* sort the versions */
        versions.forEach(function (version) {
          version.issues = issues_grouped[version.name];
        });

        console.log(versions[0]);
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
