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

    this.x = d3.scale.linear()
        .range([0, width]);
    this.y = d3.scale.ordinal()
        .rangeRoundBands([0, height], 0.2);

    this.svg = d3.select('body').append('svg')
      .append('g')
        .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

    /* specify the domain of the axes */
    // FIXME: x domain is hard coded
    this.x.domain([0, 100]);
    this.y.domain(FILTER_STATUSES);
  },

  visualise: function (data) {

    var x = this.x,
        y = this.y,
        svg = this.svg;

    data = d3.map(data).entries()
      .map(function(d) {
        return { key: d.key, value: d3.map(d.value).entries() };
    });

    var stack = d3.layout.stack()
        .offset('zero')
        .values(function(d) { return d.value; })
        .x(function(d) { return d.key; })
        .y(function(d) { return d.value.tickets; });

    var layers = stack(data);

    /* creates the bars */
    var project = svg.selectAll('g.project')
        .data(layers)
      .enter().append('g')
        .attr('class', function(d) { return 'project ' + cleanup(d.key); })

    var rect = project.selectAll('rect.status')
        .data(function(d) { return d.value; })
      .enter().append('rect')
        .attr('class', function(d) { return 'status ' + cleanup(d.key); })
        .attr('x', function(d) { return x(d.y0); })
        .attr('y', function(d) { return y(d.key); })
        .attr('width', function(d) { return x(d.y); })
        .attr('height', y.rangeBand())

    var labels = svg.append('g')
        .attr('class', 'labels')
      .selectAll('text')
        .data(y.domain())
      .enter().append('text')
        .attr('class', 'label')
        .attr('x', -3)
        .attr('y', function(d) { return y(d) + y.rangeBand() / 2; })
        .text(function (d) { return d });
  },
}

function cleanup (name) {
  return name.replace(/[^A-Za-z0-9]+/g, '_');
}
