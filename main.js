'use strict';

function main() {
  var viz = new Viz();
  var redmine = new Redmine(viz.visualise.bind(viz));
}
