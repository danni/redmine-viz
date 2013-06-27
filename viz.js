function main() {

  var margin = {
    top: 10,
    right: 10,
    bottom: 10,
    left: 120
  };
  var width = 1000 - margin.left - margin.right;
  var height = 300 - margin.top - margin.bottom;

  var x = d3.scale.linear()
      .range([0, width]);
  var y = d3.scale.ordinal()
      .rangeRoundBands([0, height], 0.2);

  var stack = d3.layout.stack()
      .offset('zero')
      .values(function(d) { return d.value; })
      .x(function(d) { return d.key; })
      .y(function(d) { return d.value.tickets; });

  var svg = d3.select('body').append('svg')
    .append('g')
      .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

  Redmine.load_issues(function (error, data) {
    console.log("ERROR", error);

    data = Redmine.filter(data);
    var statuses = Redmine.statuses(data);

    data = Redmine.collate(data);
    data = d3.map(data).entries()
      .map(function(d) {
        return { key: d.key, value: d3.map(d.value).entries() };
    });

    var layers = stack(data);

    /* specify the domain of the axes */
    // FIXME: x domain is hard coded
    x.domain([0, 100]);
    y.domain(statuses);

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

    var labels = svg.selectAll('text')
        .data(y.domain())
      .enter().append('text')
        .attr('class', 'label')
        .attr('x', -3)
        .attr('y', function(d) { return y(d) + y.rangeBand() / 2; })
        .text(function (d) { return d });
  });
}

function cleanup(name) {
  return name.replace(/[^A-Za-z0-9]+/g, '_');
}
