Redmine = {
  /**
   * load_issues:
   *
   * Retrieve the issues from the server
   */
  load_issues: function (callback) {
    /* specifying the key in the GET request is the only way to make this
     * work. Using the custom header will result in an OPTIONS request,
     * which Redmine does not support.
     *
     * Redmine must either be abled with CORS or JSONP to make a cross
     * domain request.
     */
    d3.json(REDMINE_URL + '/issues.json?key=' + API_KEY, callback);
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
    var projects = Redmine.projects(data);
    var statuses = Redmine.statuses(data);
    var output = {};

    /* build the array of all project/status pairs.
     * d3.nest() doesn't work usefully here because of the holes in the
     * dataset */
    projects.forEach(function(project) {
      output[project] = {};

      statuses.forEach(function(status) {
        output[project][status] = {
          status: status,
          project: project,
          tickets: 0
        };
      });
    });

    data.forEach(function(d) {
      output[d.project][d.status].tickets += 1;
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
