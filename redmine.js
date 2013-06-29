'use strict';

function Redmine (visualise_callback) {
  this.callback = visualise_callback;
  this.init();
}

Redmine.prototype = {
  init: function () {
    var self = this;

    self.load_statuses(function (data) {
      self.status_map = d3.map(data);

      self.refresh_data();
    });
  },

  refresh_data: function () {
    var self = this;

    self.status_map.values().forEach(function(d) {
      console.log("Loading " + d);
      self.load_issues(d, function (data) {
        console.log("loaded " + d, data);
        self.callback(self.collate(self.filter(data)));
      });
    });
  },

  /**
   * load_statuses:
   *
   * Retrieve the IDs for the statuses in the config key FILTER_STATUSES.
   */
  load_statuses: function (callback) {
    var set = d3.set(FILTER_STATUSES),
        statuses = {};

    d3.jsonp(URI(REDMINE_SERVER + '/issue_statuses.json')
              .addSearch('key', API_KEY),
             function (data) {

              data.issue_statuses.forEach(function(d) {

                if (set.has(d.name)) {
                   statuses[d.name] = d.id;
                }
              });

              callback(statuses);
             });
  },

  /**
   * load_issues:
   *
   * Retrieve the issues from the server
   */
  load_issues: function (status, callback) {
    /* specifying the key in the GET request is the only way to make this
     * work. Using the custom header will result in an OPTIONS request,
     * which Redmine does not support.
     *
     * Redmine must either be abled with CORS or JSONP to make a cross
     * domain request.
     */

    d3.jsonp(URI(REDMINE_SERVER + REDMINE_PROJECT + '/issues.json')
              .addSearch({
                key: API_KEY,
                'status_id': status,
                limit: 100
              }),
             callback);
  },

  /**
   * filter:
   *
   * Filter the data down to an interesting set of tasks and useful data.
   */
  filter: function (data) {
    data = data.issues;

    return data.map(function (d) {
      return {
        project: d.project.name,
        tracker: d.tracker.name,
        status: d.status.name,
        updated: d.updated_on,
      }
    });
  },

  /**
   * collate:
   *
   * Collate the project tasks by status.
   *
   * Returns: a 2-d mapping of data
   */
  collate: function(data) {
    var self = this;
    var output = {};

    data.forEach(function(d) {
      try {
        output[d.project].tickets += 1;
      } catch (e) {
        output[d.project] = {
          project: d.project,
          status: d.status,
          tickets: 1
        };
      }
    });

    return output;
  },

  /**
   * projects:
   *
   * List the projects in the data.
   *
   * Returns: an array of projects
   */
  projects: function(data) {
    return d3.nest()
        .key(function(d) { return d.project; })
        .entries(data)
      .map(function(d) { return d.key });
  },

  /**
   * statuses:
   *
   * List the statuses in the data.
   *
   * Returns: an array of statuses
   */
  statuses: function(data) {
    return d3.nest()
        .key(function(d) { return d.status; })
        .entries(data)
      .map(function(d) { return d.key });
  },
}
