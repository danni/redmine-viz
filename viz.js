'use strict';

function Viz () {
  this.init();
}

Viz.prototype = {

  init: function () {
    /* set up */
    var margin = {
      top: 10,
      right: 10,
      bottom: 10,
      left: 120
    };
    var width = 1000 - margin.left - margin.right;
    var height = 300 - margin.top - margin.bottom;

    var x = this.x = d3.scale.linear()
        .range([0, width]);
    var y = this.y = d3.scale.ordinal()
        .rangeRoundBands([0, height], 0.2);

    var svg = this.svg = d3.select('body').append('svg')
      .append('g')
        .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

    /* specify the domain of the axes */
    // FIXME: x domain is hard coded
    x.domain([0, 100]);
    y.domain(FILTER_STATUSES);

    this.labels = svg.append('g')
        .attr('class', 'labels')
      .selectAll('text')
        .data(y.domain())
      .enter().append('text')
        .attr('class', 'label')
        .attr('x', -3)
        .attr('y', function(d) { return y(d) + y.rangeBand() / 2; })
        .text(function (d) { return d });
  },

  visualise: function (data) {

    var x = this.x,
        y = this.y,
        svg = this.svg;

    data = d3.map(data).values();

    /* calculate the stacking */
    var y0 = 0;
    data.forEach(function(d) {
      d.y0 = y0;
      d.y = y0 + d.tickets;

      y0 = d.y;
    });

    /* create a single bar */
    var projects = svg.append('g')
        .attr('class', 'status')
      .selectAll('rect')
        .data(data)
      .enter().append('rect')
        .attr('class', function(d) {
          return cleanup(d.status) + ' ' + cleanup(d.project);
        })
        .attr('x', function(d) { return x(d.y0); })
        .attr('y', function(d) { return y(d.status); })
        .attr('width', function(d) { return x(d.y) - x(d.y0); })
        .attr('height', y.rangeBand())
        .attr('data-tickets', function(d) { return d.tickets });
  },
}

function cleanup (name) {
  return name.replace(/[^A-Za-z0-9]+/g, '_');
}
