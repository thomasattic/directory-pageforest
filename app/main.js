namespace.lookup('com.pageforest.directory.controller').defineOnce(function (ns) {
  var loggedin, username;

  var my = namespace.lookup("com.pageforest.directory");
  var IS_TOUCH = 'ontouchstart' in window;

  // Call the onReady function of the application when the page is loaded.
  $(document).ready(my.main);

  // If user has logged in and then logoff, we refresh the page to avoid any
  // leftover data from previous session.
  my.loggedin.push(function(newname) {
    loggedin = true;
    username = newname;
  });
  my.loggedout.push(function() {
    if (loggedin) window.location.reload();
    username = undefined;
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
    if (!appid) {
      console.error("appid is null");
    }
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

        itemjson.url = normalizeHost(appjson.url);
        itemjson.installurl = normalizeHost("http://my.pageforest.com/#installapp=" + appid);
        itemjson.signedin = loggedin;
        itemjson.icon = iconurl;
        itemjson.appid = appid;
        itemjson.title = appjson.title;
        itemjson.owner = appjson.owner;
        itemjson.next = '#z-detailpane';
        itemjson.featured = appjson.tags.indexOf("featured") >= 0;
        itemjson.dev = appid.length > 4 && Strings.endsWith(appid, "-dev");
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
          itemjson.screenshots = [];
          if (!!appjson.screenshots) {
            for (var i=0, len=appjson.screenshots.length; i<len; i++) {
              var ssurl = '/mirror/' + appid + '/' + appjson.screenshots[i].url;
              itemjson.screenshots.push({url: ssurl});
            }
          }

          console.warn("detail found: " + JSON.stringify(itemjson));
          fn({id: appid, item: itemjson});
        },
        error: function(request, textStatus, errorThrown) {
          var exception = {datasetname: 'directory.pageforest', status: request.status, message: request.statusText, url: apppath, method: "read", kind: textStatus};
          exception.nested = {request: request, status: textStatus, exception: errorThrown};
          console.warn("detail error: " + JSON.stringify(exception));

          // detail.json is optional. we simple skip it
          itemjson.description = "<< no description >>";
          itemjson.screenshots = [];
          fn({id: appid, item: itemjson});
        }
      });
    }, err);
  };

  function getAllApps(appid, fn, err) {
    var apppath = '/mirror/' + appid + '/apps';
    $.ajax({
      type: 'GET',
      url: apppath,
      dataType: 'html',
      beforeSend: function(xhr) {},
      success: fn,
      error: function(request, textStatus, errorThrown) {
        var exception = {datasetname: 'directory.pageforest', status: request.status, message: request.statusText, url: apppath, method: "read", kind: textStatus};
        exception.nested = {request: request, status: textStatus, exception: errorThrown};
        if (err) {
          err(exception);
        }
      },
      async: true
    });
  };

  function getInstalled(appid, options, fn, err) {
    var apppath = '/mirror/' + appid + '/docs/' + username + '/';
    $.ajax({
      type: 'GET',
      url: apppath,
      dataType: 'json',
      beforeSend: function(xhr) {},
      success: function(appjson) {
        fn({id: appid, item: appjson});
      },
      error: function(request, textStatus, errorThrown) {
        var exception = {datasetname: 'directory.pageforest', status: request.status, message: request.statusText, url: apppath, method: "read", kind: textStatus};
        exception.nested = {request: request, status: textStatus, exception: errorThrown};
        if (err) {
          err(exception);
        }
      },
      async: true
    });
  };

  // Map Pageforest URL's to be relative to current domain (for non-pageforest.com hosting).
  function normalizeHost(url) {
      var appHost = window.location.host;
      url = url.replace(/\.pageforest\.com/, appHost.substr(appHost.indexOf('.')));
      return url;
  }

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
  my.loggedin.push(function(newname) {
    $("#jqt").removeClass("initstate");
    $("#jqt").removeClass("nouserstate");

    $(".welcome-message").text("Pageforest id: " + newname);
  });

  var resizeTimer;
  var KEY_ISCROLL_OBJ = 'iscroll_object';
  $(document).ready(function() {
    getAllApps("www", function(html) {
      var $dom = $(html);
      var $appanchor = $dom.find("table:first-of-type tr td:first-of-type a:first-of-type");
      $appanchor.each(function(i, item) {
        var appid = $(item).attr("href").substring(6).slice(0, -1);
        console.warn("a.href: " + appid);
        if (appid) {
          loadApp(appid);
        }
      });
    }, function(exception) {
      console.warn("Error loading list of application." + JSON.stringify(exception));
    });

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

    // workaround to get sign-in button working
    // (iOS fullscreen mode must launch page using default <a> handler
    var loginurl = "http://www.pageforest.com/sign-in/" + my.items.appid;
    $(".sign-in-anchor").attr("href", normalizeHost(loginurl));

    $("#z-detailpane").bind("pagein", function(event, info) {
      getDetail(info.search.appid, {}, function(data) {
        var $newitem = $("#dirdetail-template").tmpl(data.item);
        var $container = $("#z-detailpane #appdetail");
        $container.children().remove();
        $container.children().die();
        $container.append($newitem);

        //@TODO -- <untested> code (can't test because of bug in /mirror on getting docs of another app
        if (!!username) {
          getInstalled("my", {}, function(json) {
            var order = json.item.blob.order;
            var found = order.indexOf(info.search.appid) >= 0;
            if ($container.closest('html').length) {
              $container.addClass("installed");
            }
          }, function(error) {
            console.error(JSON.stringify(error));
          });
        }
        // </untested>

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
                  var target = document.querySelector('#jqt .carousel ul.indicator > li:nth-child(' + (this.currPageX+1) + ')'); 
                  if (active) active.className = '';
                  if (target) target.className = 'on';
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
        resizeTimer = setTimeout(resizeCarousel, 150);
      }
    });

    $("#z-detailpane #appdetail").append($("#emptydetail-template").tmpl());
    $("#z-detailpane").bind("pageout", function(event, info) {
      var $container = $("#z-detailpane #appdetail");
      $container.find('.s-scrollwrapper, .s-innerscrollwrapper').each(function (i, wrap) {
        var $wrapper = $(wrap);
        var scroll = $wrapper.data(KEY_ISCROLL_OBJ);
        scroll.destroy();
        $wrapper.removeData(KEY_ISCROLL_OBJ);
      });
      $container.children().die();
      $container.children().remove();
      var $newitem = $("#emptydetail-template").tmpl();
      $container.append($newitem);
    });

    $("#backbutton").bind("click", function(event) {
      jqt.goBack();
    });

    $("#z-listpane ul").removeClass("on");
    $("#z-listpane ul#featured-applist").addClass("on");
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

    $(".sign-out").live("click", function(e) {
      // use live to handle both detail (dynamic) and list page
      e.preventDefault();
      e.stopPropagation();
      my.signOut();
    });

    $(window).bind("resize", function() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resizeCarousel, 150);
    });
  });

  // Items handler listens to CRUD events from model
  my.items.handler = {
    added: function(event) {
      var $newitem, $container;

      if (!event.item.dev) {
        if (event.item.featured) {
          $newitem = $("#diritem-template").tmpl(event.item);
          $container = $("#z-listpane ul#featured-applist");
          $container.append($newitem);
        }
        $newitem = $("#diritem-template").tmpl(event.item);
        $container = $("#z-listpane ul#applist");
        $container.append($newitem);
      }
    },
    removed: function(event) {
    },
    updated: function(event) {
    }
  };
});
