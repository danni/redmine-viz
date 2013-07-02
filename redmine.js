'use strict';

function Redmine (project) {
  this.init(project || REDMINE_PROJECT);
}

Redmine.prototype = {
  init: function (project) {
    var self = this;

    self.project = project;
  },

  /**
   * load_issues:
   *
   * Load the issues for the project this Redmine was constructed with.
   */
  load_issues: function (callback, status) {

    var self = this;
    var LIMIT = 100;

    self.load_statuses(function (data) {

      self.status_map = d3.map(data);

      /* specifying the key in the GET request is the only way to make this
       * work. Using the custom header will result in an OPTIONS request,
       * which Redmine does not support.
       *
       * Redmine must either be enabled with JSONP to make a cross
       * domain request.
       */
      var uri = URI(REDMINE_SERVER + '/projects/' + self.project + '/issues.json')
          .addSearch('key', API_KEY)
          .addSearch('limit', LIMIT);

      if (status) {
        uri.addSearch('status_id', status);
      }

      var records = [];

      function get_all_data(data) {
        records = records.concat(data.issues);

        console.log("Have " + records.length + " records");

        if (records.length < data.total_count) {
          d3.jsonp(uri.addSearch('offset', records.length).normalize(),
                   get_all_data);
        } else {
          console.log("Done");
          callback(self.flatten(records));
        }
      }

      /* make the first request */
      console.log("Downloading");
      d3.jsonp(uri.normalize(), get_all_data);
    });
  },

  /**
   * load_statuses:
   *
   * Retrieve the IDs for the statuses in the config key FILTER_STATUSES.
   */
  load_statuses: function (callback) {

    /* short circuit the request */
    if (this.status_map) {
      callback(this.status_map);
      return;
    }

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
