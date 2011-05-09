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

  function loadApp(appid) {
    getApp(appid, {}, function(event) {
      //@TODO -- for UI work, we just by pass the model and call handler directly
      my.items.handler.added(event);
    }, function(exception) {
      console.error(JSON.stringify(exception));
    });
  }

  function getApp(appid, options, fn, err) {
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

        fn({id: appid, item: itemjson});
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

  function getDetail(appid, options, fn, err) {
    var apppath = '/mirror/' + appid + '/detail.json';
    getApp(appid, options, function(event) {
      var itemjson = event.item;
      $.ajax({
        type: 'GET',
        url: apppath,
        dataType: 'json',
        beforeSend: function(xhr) {},
        success: function(appjson) {
          itemjson.description = appjson.description;
          //itemjson.screenshots = [{url: }, {url: iconurl}];
          itemjson.screenshots = [];
          fn({id: appid, item: itemjson});
        },
        error: function(request, textStatus, errorThrown) {
          // detail.json is optional. we simple skip it
          itemjson.description = "<< no description >>";
          itemjson.screenshots = [];
          fn({id: appid, item: itemjson});
        }
      });
    }, err);
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

  var resizeTimer;
  var KEY_ISCROLL_OBJ = 'iscroll_object';
  $(document).ready(function() {
    loadApp("editor");
    loadApp("my");
    loadApp("beedesk-test");
    loadApp("chess");
    loadApp("directory-dev");

    function refreshScroll($pane) {
      $pane.find('.s-scrollwrapper, .s-innerscrollwrapper').each(function (i, wrap) {
        var $wrapper = $(wrap);
        var scroll = $wrapper.data(KEY_ISCROLL_OBJ);
        if (scroll !== undefined && scroll !== null) {
          scroll.refresh();
        }
      });
    }

    function resizeCarousel() {
      console.warn("resizing... carousel");
      var $container = $("#jqt > .current .carousel");
      if ($container.length > 0) {
        var $ul = $container.find("> .scroller");
        var $items = $ul.find("> li");

        if ($items.length > 0) {
          var width = $(window).width();
          $items.width((width) + "px");
          $ul.width(($items.length * width) + "px");
        }
      }
      refreshScroll($("#jqt > .current"));
    }

    $("#z-detailpane").bind("pagein", function(event, info) {
      getDetail(info.search.appid, {}, function(data) {
        var $newitem = $("#dirdetail-template").tmpl(data.item);
        var $container = $("#z-detailpane #appdetail");
        $container.children().remove();
        $container.append($newitem);

        $container.find('.s-scrollwrapper, .s-innerscrollwrapper').each(function (i, wrap) {
          var $wrapper = $(wrap);
          var data = $wrapper.data(KEY_ISCROLL_OBJ);
          if (data === undefined || data === null) {
            var scroll;
            var options = {};
            if ($wrapper.hasClass("scrollrefresh")) {
              options = {
                pullToRefresh: "down"
              };
            } else if ($wrapper.hasClass("carousel")) {
              options = {
                snap: true,
                momentum: false,
                hScrollbar: false,
                onScrollEnd: function () {
                  var active = document.querySelector('#jqt .carousel ul.indicator > li.on');
                  if (active) active.className = '';
                  document.querySelector('#jqt .carousel ul.indicator > li:nth-child(' + (this.currPageX+1) + ')').className = 'on';
                }
              }
            }
            scroll = new iScroll(wrap, options);
            $wrapper.data(KEY_ISCROLL_OBJ, scroll);
            scroll.refresh();
          }
        });
      }, function(error) {
        console.error(JSON.stringify(error));
      });

      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resizeCarousel, 150);
    });

    $("#jqt > *").bind('pageAnimationEnd', function(event, info) {
      if (info.direction == 'in') {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(resizeCarousel, 50);
      }
    });

    $("#z-detailpane").bind("pageout", function(event, info) {
      var $container = $("#z-detailpane #appdetail");
      $container.children().remove();
      var $newitem = $("#emptyitem-template").tmpl();
      $container.append($newitem);
    });

    $("#backbutton").bind("click", function(event) {
      jqt.goBack();
    });

    $("#z-listpane input[type='radio'][name='categories']").bind("click", function(event) {
      var $target = $(this);
      var val = $target.val();
      if (val === "Featured") {
        if (!$("#z-listpane ul#featured-applist").hasClass("on")) {
          $("#z-listpane ul").removeClass("on");
          $("#z-listpane ul#featured-applist").addClass("on");
        }
      } else if (val === "All") {
        if (!$("#z-listpane ul#applist").hasClass("on")) {
          $("#z-listpane ul").removeClass("on");
          $("#z-listpane ul#applist").addClass("on");
        }
      } else {
        console.error("Unexpected radio button value: " + val);
      }
    });

    $(window).bind("resize", function() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resizeCarousel, 50);
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
