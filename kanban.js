'use strict';

function Kanban (redmine) {
  this.redmine = redmine;

  this.init();
}

Kanban.prototype = {

  init: function () {
    /* set up */
    var margin = {
      top: 25,
      right: 10,
      bottom: 10,
      left: 10
    };

    var width = this.width = window.innerWidth - margin.left - margin.right;
    var height = this.height = window.innerHeight - margin.top - margin.bottom;

    var x = this.x = d3.scale.ordinal()
        .rangeRoundBands([0, width], 0.2);

    var svg = this.svg = d3.select('#kanban')
      .append('g')
        .attr('class', 'board')
        .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

    x.domain(FILTER_STATUSES);

    /* create the table header labels */
    this.labels = svg.append('g')
        .attr('class', 'labels')
      .selectAll('text')
        .data(x.domain())
      .enter().append('text')
        .attr('class', 'label')
        .attr('x', function(d) { return x(d) + x.rangeBand() / 2; })
        .attr('y', '-2pt')
        .text(function (d) { return d; })
        .attr('opacity', 0)
      .transition().duration(750)
        .attr('opacity', 1);
  },

  load: function () {
    var self = this;

    self.redmine.load_statuses(function (statuses) {

      statuses.forEach(function (k, v) {
        console.log("Loading " + k);
        self.redmine.load_issues(function (issues) {
          console.log(k + ": " + issues.length);

          self.process(issues, k);
        }, v);
      });
    });
  },

  process: function (issues, status) {
    var self = this;

    var svg = this.svg,
        x = this.x;

    issues.sort(function(i1, i2) {
        return d3.ascending(i1.id, i2.id);
    });

    var GOLDEN_RATIO = 1.61803398875,
        CARD_WIDTH = x.rangeBand(),
        CARD_HEIGHT = CARD_WIDTH / GOLDEN_RATIO,
        SPACING = d3.min([(self.height - CARD_HEIGHT) / issues.length,
                          CARD_HEIGHT + 2]);

    svg.append('g')
        .attr('class', 'status ' + status)
      .selectAll('rect')
        .data(issues)
      .enter().append('foreignObject')
        .attr('class', function(d) { return 'issue P_' + cleanup(d.project); })
        .attr('opacity', 0)
        .attr('x', function(d) { return x(d.status); })
        .attr('y', function(d, i) { return i * SPACING; })
        .attr('width', CARD_WIDTH)
        .attr('height', CARD_HEIGHT)
      .each(function(d) {
          var card = d3.select(this)
            .append('xhtml:body')
            .append('div')
              .attr('class', 'card');

          card.append('p')
            .attr('class', 'issuename')
            /* FIXME: add link to issue in RM */
            .text(d.tracker + ' #' + d.id);

          card.append('p')
            .attr('class', 'version')
            .text(d.fixed_version);

          card.append('p')
            .attr('class', 'desc')
            .text(d.subject);

          card.append('p')
            .attr('class', 'project')
            .text(d.project);
      })
      .transition().duration(750)
        .attr('opacity', 1);

    console.log(issues[0]);
  },
}

function cleanup (name) {
  return name.replace(/[^A-Za-z0-9]+/g, '_');
}
