Redmine = {
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
   * Collate the project tasks by status
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

  projects: function(data) {
    return d3.nest()
        .key(function(d) { return d.project; })
        .entries(data)
      .map(function(d) { return d.key });
  },

  statuses: function(data) {
    return d3.nest()
        .key(function(d) { return d.status; })
        .entries(data)
      .map(function(d) { return d.key });
  },
}
