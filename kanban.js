'use strict';

function Kanban (redmine) {
  this.redmine = redmine;

  this.init();
}

Kanban.prototype = {

  init: function () {
    var margin = this.margin = {
      top: 25,
      right: 10,
      bottom: 10,
      left: 10
    };

    var x = this.x = d3.scale.ordinal()

    var svg = this.svg = d3.select('#kanban')
      .append('g')
        .attr('class', 'board')
        .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

    x.domain(FILTER_STATUSES);
    this.allocate();

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

  allocate: function () {
    var self = this,
        x = this.x,
        margin = this.margin;
    
    var width = this.width = window.innerWidth - margin.left - margin.right;
    var height = this.height = window.innerHeight - margin.top - margin.bottom;

    x.rangeRoundBands([0, width], 0.2);

    d3.selectAll('.status')
        .each(function() {
            self.allocate_status(this);
        });
  },

  allocate_status: function (statusgroup, transition) {
      if (!(statusgroup instanceof d3.selection))
          statusgroup = d3.select(statusgroup);

      var issues = statusgroup.selectAll('.issue'),
          len = issues.size();

      var x = this.x,
          height = this.height,
          GOLDEN_RATIO = 1.61803398875,
          CARD_WIDTH = x.rangeBand(),
          CARD_HEIGHT = CARD_WIDTH / GOLDEN_RATIO,
          SPACING = d3.min([(height - CARD_HEIGHT) / len,
                            CARD_HEIGHT + 2]);

      if (transition === true || transition === undefined)
          issues = issues.transition();

      issues
          .attr('x', function(d) { return x(d.status); })
          .attr('y', function(d, i) { return i * SPACING; })
          .attr('data-y', function(d, i) { return i * SPACING; })
          .attr('data-spacing', SPACING)
          .attr('width', CARD_WIDTH)
          .attr('height', CARD_HEIGHT);
  },

  process: function (issues, status) {
    var self = this;

    var svg = this.svg,
        x = this.x,
        margin = this.margin;
    
    issues.sort(function(i1, i2) {
        return d3.ascending(i1.id, i2.id);
    });

    var statusgroup = svg.append('g')
        .attr('class', 'status ' + status);

    statusgroup.selectAll('.issue')
        .data(issues)
      .enter().append('foreignObject')
        .attr('class', function(d) { return 'issue P_' + cleanup(d.project); })
        .attr('opacity', 0)
      .each(function(d) {
          var card = d3.select(this)
            .append('xhtml:body')
            .append('a')
              .attr('href', self.redmine.get_uri()
                                    .directory('issues')
                                    .filename(d.id + '.html')
                                    .normalize())
            .append('div')
              .attr('class', 'card');

          card.append('p')
            .attr('class', 'issuename')
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

          self.redmine.load_user(d.assigned_to_id, function(user) {
              if (!user)
                  return;

              card.append('img')
                  .attr('class', 'avatar')
                  .attr('src', get_gravatar(user.mail, 30))
                  .attr('alt', d.assigned_to)
                  .attr('title', d.assigned_to)
                  .style('opacity', 0)
                .transition().duration(500)
                  .style('opacity', 1);
          });
      })
      .on('mouseenter', function(d, i) {
          var p = i;

          statusgroup.selectAll('.issue')
              .transition()
            .attr('y', function(d,i) {
                var card = d3.select(this),
                    y = +card.attr('data-y'),
                    height = +card.attr('height'),
                    spacing = +card.attr('data-spacing');

                if (i <= p) {
                    return y;
                } else if (i > p) {
                    return y + height - spacing + 2;
                }
            });
      })
      .transition().duration(750)
        .attr('opacity', 1);

    self.allocate_status(statusgroup, false);
  },
}

function cleanup (name) {
  return name.replace(/[^A-Za-z0-9]+/g, '_');
}
