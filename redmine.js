'use strict';

function Redmine (project) {
  this.project = project || REDMINE_PROJECT;
  this.users = {};
  this.cache_key = 'rmviz.' + this.project;
  
  /* Set the cache object here. Either localStorage or a "fake"
   * cache for compatibility
   */
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
    var total_read = 0;


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

    /* Add filter to disclude results that are in the cache */
    var updated = self._get_cached_issues_updated();
    if (typeof updated != 'undefined') {
      /* Create the date string for redmine */
      updated = d3.time.format('%Y-%m-%d')(new Date(updated));

      /* This is not perfect. It does not do time, so there is usually 1 day
       * worth of overlap
       */
      uri.addSearch('updated_on', '>=' + updated);

      console.log(
        this._count_cached_issues() + " cached records available from before " +
        updated
      );
    } else {
      console.log('No cached data available');
    }

    function get_all_data(data) {
      total_read += data.issues.length;
      for (var i = 0; i < data.issues.length; i++) {
        var issue = data.issues[i];
        self._put_cached_issue(issue);
      }

      console.log("Have " + total_read + " new or updated records");

      if (total_read < data.total_count) {
        d3.jsonp(uri.addSearch('offset', total_read).normalize(),
                 get_all_data);
      } else {
        console.log("Done (" + self._count_cached_issues() + " records total)");
        callback(self.flatten(self._get_cached_issues(status)));
      }
    }

    /* make the first request */
    console.log("Downloading");
    d3.jsonp(uri.normalize(), get_all_data);
  },

  /**
   * _put_cached_issue:
   *
   * Puts an issue into the cache and updates the cache updated value and the
   * IDs list as necessary.
   */
  _put_cached_issue: function(issue) {
    var isset = typeof this._get_cached_issue(issue.id) != 'undefined';
    this._put_cached('issues.' + issue.id, issue);

    /* Update the last updated */
    this._update_last_updated(Date.parse(issue.updated_on));
    
    /* Update the ids list */
    if (!isset) {
      this._update_ids_list(issue.id);
    }
  },

  /**
   * _update_last_updated:
   *
   * Updates the latest cached update date if it's newer. And returns true if
   * this was a new latest update or false if the cached date was newer.
   */
  _update_last_updated: function(updated_on) {
    var cache_updated = this._get_cached_issues_updated();
    if (typeof cache_updated == 'undefined') cache_updated = 0;
    if (updated_on > cache_updated) {
      this._put_cached('issues.updated', updated_on);
      return true;
    }
    return false;
  },

  /**
   * _update_ids_list:
   *
   * Updates the issues ID list to add the new ID.
   */
  _update_ids_list: function(issue_id) {
      var list = this._get_cached_issues_ids();
      list[list.length] = issue_id;
      this._put_cached('issues.list', list);
  },

  /**
   * _put_cached:
   *
   * Put an object into the cache under the root cache key.
   */
  _put_cached: function(key, data) {
    this.cache[this.cache_key + '.' + key] = JSON.stringify(data);
  },

  /**
   * _get_cached:
   *
   * Get either a JSON-parsed cached or default value under the root cache key.
   */
  _get_cached: function(key, def) {
    var data = this.cache[this.cache_key + '.' + key];
    if (typeof data == 'undefined') return def;
    return JSON.parse(data);
  },

  /**
   * _get_cached_issue:
   *
   * Single cached issue by it's issue ID, or undefined if it does not exist in
   * the cache.
   */
  _get_cached_issue: function(issue_id) {
    return this._get_cached(
      'issues.' + issue_id,
      undefined
    );
  },

  /**
   * _get_cached_issues_ids:
   *
   * Full list of IDs for issues in the cache.
   */
  _get_cached_issues_ids: function() {
    return this._get_cached(
      'issues.list',
      []
    );
  },

  /**
   * _get_cached_issues:
   *
   * All issues in the cache.
   */
  _get_cached_issues: function(status) {
    var issues = [];
    var ids = this._get_cached_issues_ids();

    for (var i = 0; i < ids.length; i++) {
      var issue = this._get_cached_issue(ids[i]);

      if (status !== undefined && status !== '*') {
          if (status != issue.status.id) {
              continue;
          }
      }

      issues.push(issue);
    }

    return issues;
  },

  /**
   * _count_cached_issues:
   *
   * A count of all issues in the cache.
   */
  _count_cached_issues: function() {
    return this._get_cached_issues_ids().length;
  },

  /**
   * _get_cached_issues_updated:
   *
   * Integer representation compatible with Date objects for the last update on
   * issues in the cache.
   */
  _get_cached_issues_updated: function() {
    var updated = this._get_cached(
      'issues.updated',
      undefined
    );
    return updated == undefined ? undefined : parseInt(updated);
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

  load_user: function (user, callback) {
      var self = this;

      if (user === undefined) {
          callback(undefined);
          return;
      }

      /* look to see if this user is already in the cache */
      if (user in self.users) {
          callback(self.users[user]);
          return;
      }

      d3.jsonp(self.get_uri()
          .directory('users')
          .filename(user + '.json')
          .normalize(),
          function (data) {
              self.users[user] = data.user;
              callback(data.user);
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
          record[k + '_id'] = v.id;
        }
      });
    });

    return data;
  },
}
