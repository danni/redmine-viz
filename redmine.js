'use strict';

function Redmine (project) {
  this.project = project || REDMINE_PROJECT;
}

Redmine.prototype = {

  /**
   * get_uri:
   *
   * Get a URI object for talking to the server.
   *
   * The object will have a path for the project set (you can unset this
   * with uri.directory('') and the API key set.
   */
  get_uri: function () {
    return URI(REDMINE_SERVER + '/projects/' + self.project + '/')
        .addSearch('key', API_KEY);
  },

  /**
   * load_issues:
   *
   * Load the issues for the project this Redmine was constructed with.
   */
  load_issues: function (callback, status) {

    var self = this;
    var LIMIT = 100;

    /* specifying the key in the GET request is the only way to make this
     * work. Using the custom header will result in an OPTIONS request,
     * which Redmine does not support.
     *
     * Redmine must either be enabled with JSONP to make a cross
     * domain request.
     */
    var uri = self.get_uri()
        .filename('issues.json')
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
  },

  /**
   * load_statuses:
   *
   * Retrieve the IDs for the statuses in the config key FILTER_STATUSES.
   */
  load_statuses: function (callback) {

    var self = this;

    /* short circuit the request */
    if (self.status_map) {
      callback(self.status_map);
      return;
    }

    var set = d3.set(FILTER_STATUSES),
        statuses = {};

    d3.jsonp(self.get_uri()
              .directory('')
              .filename('issue_statuses.json')
              .normalize(),
             function (data) {

              data.issue_statuses.forEach(function(d) {

                if (set.has(d.name)) {
                   statuses[d.name] = d.id;
                }
              });

              self.status_map = statuses;

              callback(statuses);
             });
  },

  /**
   * load_versions:
   */
  load_versions: function (callback) {
    var self = this;

    d3.jsonp(self.get_uri()
        .filename('versions.json')
        .normalize(),
        function (data) {
          callback(data.versions);
        });
  },

  /**
   * flatten:
   *
   * Flatten the data to something that makes sense
   */
  flatten: function (data) {
    data.forEach(function (record) {

      /* flatten out the custom fields */
      record.custom_fields.forEach(function(d) {
        record[d.name.toLowerCase()] = d.value;
      });

      delete record['custom_fields'];

      /* flatten all fields of type Object */
      d3.map(record).forEach(function (k, v) {
        if (v instanceof Object) {
          record[k] = v.name;
        }
      });
    });

    return data;
  },
}
