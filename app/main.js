namespace.lookup('com.pageforest.directory.controller').defineOnce(function (ns) {
  var my = namespace.lookup("com.pageforest.directory");

  var IS_TOUCH = 'ontouchstart' in window;

  var conf = {
    tapholdThreshold: 1000
  }

  // Call the onReady function of the application when the page is loaded.
  $(document).ready(my.onReady);

  // If user has logged in and then logoff, we refresh the page to avoid any
  // leftover data from previous session.
  var loggedin;
  my.loggedin.push(function() {
    loggedin = true;
  });
  my.loggedout.push(function() {
    if (loggedin) window.location.reload();
  });

  var jqt = $.jQTouch({
    updatehash: false,
    hashquery: true,
    clearInitHash: false
  });

  // <Application Adding>
  // Add application should wait until setDoc() is first called
  var modelReadyLatch = Threads.latchbinder();
  my.modelReady.push(modelReadyLatch.latch);

  function loadApp(appid, options, fn, err) {
    var apppath = '/mirror/' + appid + '/app.json';
    $.ajax({
      type: 'GET',
      url: apppath,
      dataType: 'json',
      beforeSend: function(xhr) {},
      success: function(appjson) {
        var itemjson = {};
        var iconurl = '/static/images/icon.png';
        if (appjson.icon) {
            iconurl = '/mirror/' + appid + '/' + appjson.icon;
        }

        itemjson.icon = iconurl;
        itemjson.appid = appid;
        itemjson.title = appjson.title;
        itemjson.owner = appjson.owner;
        itemjson.next = '#z-detailpane';
        itemjson.tag = Strings.join(", ", appjson.tags);

        //@TODO -- for UI work, we just by pass the model and call handler directly
        my.items.handler.added({id: appid, item: itemjson});
      },
      error: function(request, textStatus, errorThrown) {
        var exception = {datasetname: 'my.pageforest', status: request.status, message: request.statusText, url: apppath, method: "read", kind: textStatus};
        exception.nested = {request: request, status: textStatus, exception: errorThrown};
        if (err) {
          err(exception);
        }
      }
    });
  };

  function loadDetail(appid, options, fn, err) {
    var apppath = '/mirror/' + appid + '/detail.json';
    $.ajax({
      type: 'GET',
      url: apppath,
      dataType: 'json',
      beforeSend: function(xhr) {},
      success: function(appjson) {
        var itemjson = {};
        var iconurl = '/static/images/icon.png';
        if (appjson.icon) {
            iconurl = '/mirror/' + appid + '/' + appjson.icon;
        }

        itemjson.icon = iconurl;
        itemjson.appid = appid;
        itemjson.title = appjson.title;
        itemjson.owner = appjson.owner;
        itemjson.tag = Strings.join(", ", appjson.tags);
        itemjson.description = appjson.description;
        fn(itemjson);
      },
      error: function(request, textStatus, errorThrown) {
        var exception = {datasetname: 'my.pageforest', status: request.status, message: request.statusText, url: apppath, method: "read", kind: textStatus};
        exception.nested = {request: request, status: textStatus, exception: errorThrown};
        if (err) {
          err(exception);
        }
      }
    });
  };

  // Map Pageforest URL's to be relative to current domain (for non-pageforest.com hosting).
  function normalizeHost(url) {
      var appHost = window.location.host;
      url = url.replace(/\.pageforest\.com/, appHost.substr(appHost.indexOf('.')));
      return url;
  }

  // reference: http://code.google.com/p/pageforest/source/browse/appengine/auth/middleware.py::referer_is_trusted
  var referers;
  function check(allowed, referer) {
    var i, len;
    for (i=0, len=allowed.length; i<len; i++) {
       var prefix = allowed[i];
       if (Strings.startsWith(referer, prefix)
           || Strings.startsWith(referer.replace('http://', 'https://'), prefix)) {
         return true;
       }
    }
    return false;
  }

  function checkReferers(referer, fn, err) {
    var appid = my.items.appid;
    if (!referers) {
      // ajax on that:
      var apppath = '/mirror/' + appid + '/app.json';
      $.ajax({
        type: 'GET', url: apppath, dataType: 'json', async: false,
        success: function(appjson) {
          referers = appjson.referers;
          if (check(referers, referer)) {
            fn();
          } else {
            err();
          }
        },
        error: function(request, textStatus, errorThrown) {
          err();
        }
      });
    } else {
      if (check(referers, referer)) {
        fn();
      } else {
        err();
      }
    } // these method can look much simpler if we use library such as "Promise".
  }
  // </Application Adding>

  // Manage display to indicate state
  modelReadyLatch.bind(function() {
    $("#jqt").removeClass("initstate");
    $("#jqt").removeClass("nouserstate");
  });
  my.loggedout.push(function() {
    if (!loggedin) {
      $("#jqt").removeClass("initstate");
      $("#jqt").addClass("nouserstate");
    }
  });

  $(document).ready(function() {
    loadApp("editor");
    loadApp("my");
    loadApp("beedesk-test");
    loadApp("chess");
    loadApp("directory-dev");

    $("#z-detailpane").bind("pagein", function(event, info) {
      loadDetail(info.search.appid, {}, function(data) {
        var $newitem = $("#dirdetail-template").tmpl(data);
        var $container = $("#z-detailpane #appdetail");
        $container.append($newitem);
      }, function(error) {
        console.error(JSON.stringify(error));
      })
    });
    $("#z-detailpane").bind("pageout", function(event, info) {
      var $container = $("#z-detailpane #appdetail");
      $container.children().remove();
    });

    $("#backbutton").bind("click", function(event) {
      jqt.goBack();
    });
  });

  // Items handler listens to CRUD events from model
  my.items.handler = {
    added: function(event) {
      var $newitem = $("#diritem-template").tmpl(event.item);
      var $container = $("#z-listpane ul#applist");
      if ("after" in event) {
        if (event.after !== undefined) {
          var $leader = $container.find("li[data-id=" + event.after + "]");
          if ($leader.length > 0) {
            $leader.after($newitem);
          } else {
            console.error("Could not find peer, '" + event.after + "'");
            $container.append($newitem);
          }
        } else {
          $container.prepend($newitem);
        }
      } else {
        $container.append($newitem);
      }
    },
    removed: function(event) {
    },
    updated: function(event) {
    }
  };
});
