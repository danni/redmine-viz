'use strict';

function Redmine (project) {
  this.project = project || REDMINE_PROJECT;
  this.cache_key = 'rmviz.' + self.project;
  
  if (Modernizr.localstorage) {
    this.cache = localStorage;
  } else {
    this.cache = {};
  }

  console.log("Connected to Redmine project " + this.project);
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
    var self = this;

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
    var cache_key = self.cache_key + '.issues';

    var records = [];

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

    var updated = self._get_cached_issues_updated();
    if (typeof updated != 'undefined') {
      updated = new Date(updated);
      updated =
        updated.getFullYear() + '-' +
        updated.getMonth() + '-' +
        updated.getDay();
      uri.addSearch('updated_on', '>=' + updated);
    }

    function get_all_data(data) {
      records = records.concat(data.issues);

      for (var i = 0; i < data.issues.length; i++) {
        var issue = data.issues[i];
        self._put_cached_issue(issue.id, issue);
      }

      console.log("Have " + records.length + " records");

      if (records.length < data.total_count) {
        d3.jsonp(uri.addSearch('offset', records.length).normalize(),
                 get_all_data);
      } else {
        console.log("Done");
        callback(self.flatten(self._get_cached_issues()));
      }
    }

    /* make the first request */
    console.log("Downloading");
    d3.jsonp(uri.normalize(), get_all_data);
  },
  _get_cached_issue: function(issue) {
    var data = this.cache[this.cache_key + '.issues.' + issue];
    if (typeof data == 'undefined') return undefined;
    return JSON.parse(data);
  },
  _put_cached_issue: function(issue, data) {
    var isset = typeof this._get_cached_issue(issue) != 'undefined';
    this.cache[this.cache_key + '.issues.' + issue] = JSON.stringify(data);

    // Update the last updated
    var updated = Date.parse(data.updated_on);
    var cache_updated = this._get_cached_issues_updated();
    if (typeof cache_updated == 'undefined') cache_updated = 0;
    if (updated > cache_updated) {
      this.cache[this.cache_key + '.issues.updated'] = updated;
    }

    // Update the ids list
    if (!isset) {
      var list = this._get_cached_issues_ids();
      list[list.length] = data.id;
      this.cache[this.cache_key + '.issues.list'] = JSON.stringify(list);
    }
  },
  _get_cached_issues_ids: function() {
    var list = this.cache[this.cache_key + '.issues.list'];
    if (typeof list == 'undefined') return [];
    return JSON.parse(list);
  },
  _get_cached_issues: function() {
    var issues = [];
    var ids    = this._get_cached_issues_ids();
    for (var i = 0; i < ids.length; i++) {
      issues[issues.length] = this._get_cached_issue(ids[i]);
    }
    return issues;
  },
  _count_cached_issues: function() {
    return this._get_cached_issues().length;
  },
  _get_cached_issues_updated: function() {
    var updated = this.cache[this.cache_key + '.issues.updated'];
    if (typeof updated == 'undefined') return undefined;
    return parseInt(updated);
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

              self.status_map = d3.map(statuses);

              callback(self.status_map);
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
