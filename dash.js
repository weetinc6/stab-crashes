var crashes;
var tableOptions = {
  'oom': false,
  'shutdownhang': false,
  'flash': false,
  'graphType': null,
};

var onLoad = new Promise(function(resolve, reject) {
  window.onload = resolve;
});

var loadCrashes = fetch('crashes.json')
.then(function(response) {
  return response.json();
})
.then(function(val) {
  crashes = val;
  console.log(crashes);
});

function agoString(val, str) {
  return val + ' ' + (val == 1 ? str : str + 's') + ' ago';
}

function prettyDate(date) {
  date = new Date(date);
  let today = new Date();

  var hoursDiff = Math.round((today.getTime() - date.getTime()) / 3600000);
  if (hoursDiff < 24) {
    return agoString(hoursDiff, 'hour');
  }

  var daysDiff = Math.round((today.getTime() - date.getTime()) / 86400000);
  if (daysDiff < 10) {
    return agoString(daysDiff, 'day');
  }

  var weeksDiff = Math.round((today.getTime() - date.getTime()) / (7 * 86400000));
  if (weeksDiff < 3) {
    return agoString(weeksDiff, 'week');
  }

  var monthsDiff = (today.getMonth() + 12 * today.getFullYear()) - (date.getMonth() + 12 * date.getFullYear());
  if (monthsDiff < 12) {
    return agoString(monthsDiff, 'month');
  }

  return agoString(today.getFullYear() - date.getFullYear(), 'year');
}

function createGraph(data) {
  let startDay = data.find(d => d == null) === undefined ? 1 : 2;
  data = data.filter(d => d != null);

  var margin = {top: 20, right: 20, bottom: 30, left: 50},
      width = 700 - margin.left - margin.right,
      height = 200 - margin.top - margin.bottom;

  var x = d3.time.scale()
      .range([0, width]);

  var y = d3.scale.linear()
      .range([height, 0]);

  var xAxis = d3.svg.axis()
      .scale(x)
      .tickFormat(d3.time.format('%d'))
      .ticks(data.length)
      .orient('bottom');

  var yAxis = d3.svg.axis()
      .scale(y)
      .orient('left');

  var line = d3.svg.line()
      .x(function(d, i) {
        var date = new Date();
        date.setHours(0, 0, 0, 0);
        date.setDate(date.getDate() - startDay - i);
        return x(date);
      })
      .y(function(d, i) { return y(d); });

  var svgElem = document.createElementNS(d3.ns.prefix.svg, 'svg');
  var svg = d3.select(svgElem)
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

  x.domain(d3.extent(data, function(d, i) {
    var date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - startDay - i);
    return date;
  }));

  y.domain([0, d3.max(data, function(d) { return d; })]);

  svg.append('g')
     .attr('class', 'x axis')
     .attr('transform', 'translate(0,' + height + ')')
     .call(xAxis);

  svg.append('g')
     .attr('class', 'y axis')
     .call(yAxis);

  svg.append('path')
     .attr('class', 'line')
     .attr('d', line(data));

  return svgElem;
}

function addRow(signature, obj) {
  var table = document.getElementById('table');

  var row = table.insertRow(table.rows.length);

  var rank = row.insertCell(0);
  rank.appendChild(document.createTextNode(obj.tc_rank));

  var key = row.insertCell(1);

  var startupImage = document.createElement('img');
  startupImage.title = (obj.startup_percent * 100).toFixed(2) + ' %';
  startupImage.src = 'rocket_fly.png';
  startupImage.width = 64 * obj.startup_percent;
  startupImage.height = 64 * obj.startup_percent;
  startupImage.style.paddingRight = 5;
  key.appendChild(startupImage);

  let signatureLink = document.createElement('a');
  signatureLink.appendChild(document.createTextNode(signature.length > 50 ? signature.substr(0, 49) + '…' : signature));
  signatureLink.href = 'https://crash-stats.mozilla.com/signature/?date=<%3D' + crashes.end_date + '&date=>%3D' + crashes.start_date + '&product=Firefox&' + crashes.versions.map(version => 'version=' + version).join('&') + '&signature=' + signature;
  key.appendChild(signatureLink);

  let today = new Date();
  let three_days_ago = new Date().setDate(today.getDate() - 3);
  let ten_days_ago = new Date().setDate(today.getDate() - 10);
  let bugs = row.insertCell(2);
  obj.bugs
  .sort((bug1, bug2) => new Date(bug2.last_change_time) - new Date(bug1.last_change_time))
  .forEach(function(bug) {
    let bugLink = document.createElement('a');
    bugLink.appendChild(document.createTextNode(bug.id));
    bugLink.title = (bug.resolution ? bug.resolution + ' - ' : '') + 'Last activity: ' + prettyDate(bug.last_change_time);
    bugLink.href = 'https://bugzilla.mozilla.org/show_bug.cgi?id=' + bug.id;
    bugLink.className = bug.resolution != '' ? 'resolved' : '';

    let bugDate = new Date(bug.last_change_time);
    if (bugDate > three_days_ago) {
      bugLink.style.color = 'green';
    } else if (bugDate > ten_days_ago) {
      bugLink.style.color = 'orange';
    } else {
      bugLink.style.color = 'red';
    }

    bugs.appendChild(bugLink);
    bugs.appendChild(document.createTextNode(' '));
  });

  let graph = row.insertCell(3);
  if (tableOptions['graphType'] === 'Crashes per usage hours') {
    let crashes_by_khours = obj.crash_by_day.map(function(crashNum, i) {
      return crashes.khours[i] ? (100 / crashes.throttle * crashNum * 1000 / crashes.khours[i]) : null;
    });

    graph.appendChild(createGraph(crashes_by_khours));
  } else if (tableOptions['graphType'] === 'Crashes per ADI') {
    let crashes_by_adi = obj.crash_by_day.map(function(crashNum, i) {
      return crashes.adi[i] ? (100 / crashes.throttle * crashNum * 1000000 / crashes.adi[i]) : null;
    });

    graph.appendChild(createGraph(crashes_by_adi));
  } else if (tableOptions['graphType'] === 'Crashes per total crashes') {
    let crashes_by_total_crashes = obj.crash_by_day.map(function(crashNum, i) {
      return crashes.crash_by_day[i] ? 100 * (100 / crashes.throttle * crashNum / crashes.crash_by_day[i]) : null;
    });

    graph.appendChild(createGraph(crashes_by_total_crashes));
  } else {
    graph.appendChild(createGraph(obj.crash_by_day));
  }
  
}

function buildTable() {
  // Order signatures by rank change or kairo's explosiveness.
  Object.keys(crashes.signatures)
  .sort((signature1, signature2) => crashes.signatures[signature1].tc_rank - crashes.signatures[signature2].tc_rank)
  .forEach(function(signature) {
    if (!tableOptions['oom'] && signature.toLowerCase().includes('oom')) {
      return;
    }

    if (!tableOptions['shutdownhang'] && signature.toLowerCase().includes('shutdownhang')) {
      return;
    }

    if (!tableOptions['flash'] && signature.match(/F_?[0-9]{10}_+/)) {
      return;
    }

    addRow(signature, crashes.signatures[signature]);
  });
}

function rebuildTable() {
  while(table.rows.length > 1) {
    table.deleteRow(table.rows.length - 1);
  }

  buildTable();
}

onLoad
.then(function() {
  Object.keys(tableOptions)
  .forEach(function(option) {
    var elem = document.getElementById(option);
    tableOptions[option] = elem.checked;

    elem.onchange = function() {
      tableOptions[option] = elem.checked;
      rebuildTable();
    };
  });

  var graphType = document.getElementById('graphType');
  tableOptions['graphType'] = graphType.options[graphType.selectedIndex].value;

  graphType.onchange = function() {
    tableOptions['graphType'] = graphType.options[graphType.selectedIndex].value;
    rebuildTable();
  };
})
.then(function() {
  return loadCrashes;
})
.then(function() {
  buildTable();
})
.catch(function(err) {
  console.error(err);
});
