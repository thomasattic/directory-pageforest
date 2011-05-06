//
//
//
namespace.lookup('com.pageforest.directory').defineOnce(function (ns) {

    // state callbacks
    var modelReadyCallbacks = [], loggedin = [], loggedout = [];

    // model items
    var appid;
    var displayedorder = [];
    var displayeditems = {};

    // internal state helper
    var modelReadyLatch = Threads.latchbinder();

    var items = {
        name: "directory.pageforest",
        username: undefined,
        handler: {added: function() {}, removed: function() {}, updated: function() {}},
        appid: undefined,
        read: function(id, fn, err) {
            if (displayeditems[id] !== undefined) {
              fn(id, displayeditems[id]);
            } else if (!!err) {
              err();
            } else {
              console.error("[" + items.name + "] Cannot find item, '" + id + "'."); 
            }
        },
        create: function(id, item, fn, err) {
            modelReadyLatch.bind(function() {
                var after;
                if (!ns.client.username) {
                    if (err) {
                      var exception = {datasetname: items.name, status: '401', message: 'Not signed in.', url: '', method: 'create', kind: ''};
                      err(exception);
                    }
                } else if (!displayeditems[id]) {
                    if ("after" in item) {
                      after = item.after;
                      if (displayedorder.indexOf(after) < 0) {
                        after = displayedorder[displayedorder.length - 1];
                      }
                      delete item.after;
                    } else {
                      after = displayedorder[displayedorder.length - 1];
                    }

                    displayeditems[id] = item;
                    displayedorder.splice(displayedorder.indexOf(after) + 1, 0, id);

                    ns.client.setDirty();
                    ns.client.save();

                    items.handler.added({id: id, item: item, after: after});
                } else {
                    console.warn("app '" + id + "' already added!");
                }
            });
        },
        remove: function(id, olditem, fn, err) {
            modelReadyLatch.bind(function() {
                if (displayeditems[id]) {
                    delete displayeditems[id];
                    Arrays.remove(displayedorder, displayedorder.indexOf(id));

                    ns.client.setDirty();
                    ns.client.save();

                    items.handler.removed({id: id, olditem: olditem});
                } else {
                    console.warn("app is not known! known app: " + JSON.stringify(displayeditems));
                }
            });
        },
        update: function(id, item, olditem, fn, err) {
            var event;
            if (typeof olditem === "function") {
              err = fn;
              fn = olditem;
            }
            modelReadyLatch.bind(function() {
                event = {id: id, item: item, olditem: olditem};
                if ("after" in item) {
                  var after = item.after;
                  if (after !== undefined && displayedorder.indexOf(after) < 0) {
                    after = displayedorder[displayedorder.length - 1];
                    if (after === id) {
                      after = undefined;
                    }
                  }
                  delete item.after;

                  Arrays.remove(displayedorder, displayedorder.indexOf(id));
                  displayedorder.splice(displayedorder.indexOf(after) + 1, 0, id);
                  event.after = after;
                }

                //ns.client.setDirty();
                //ns.client.save();

                if (fn) {
                  fn();
                }
                items.handler.updated(event);
            });
        }
    };

    ns.extend({
        'onReady': onReady,
        'onUserChange': onUserChange,
        /*
        'getDoc': getDoc,
        'getDocid': getDocid,
        'setDocid': setDocid,
        */
        'setDoc': setDoc,
        'items': items,
        'modelReady': modelReadyCallbacks,
        'loggedin': loggedin,
        'loggedout': loggedout,
        'appid': appid,
        'confirmDiscard': confirmDiscard,
        'onError': onError
    });

    // This function is called when pageforest client code polled for
    // the first time.
    function onUserChange(newname) {
        var id;

        username = newname;

        items.username = username;

        var fn = !!username? loggedin: loggedout;
        for (i=0, len=fn.length; i<len; i++) {
          fn[i]();
        }

        if (!username) {
          for (id in displayeditems) {
            items.handler.removed({id: id, olditem: displayeditems[id]});
          }
        }
    }

    function onSaveSuccess(result) {
    }

    // This function is called when the index.html home page
    // is loaded.  Use it to initialize your application and
    // set up the Pageforest Client Library App Bar user interface.
    function onReady() {

        var clientLib = namespace.lookup('com.pageforest.client');

        // Client library for Pageforest
        ns.client = new clientLib.Client(ns);

        // Use the standard Pageforest UI widget.
        ns.client.addAppBar();

        // This app demonstrates auto-loading - will reload the doc if
        // it is changed by another user.
        ns.client.autoLoad = true;

        // Quick call to poll - don't wait a whole second to try loading
        // the doc and logging in the user.
        ns.client.poll();

    }

    function getDocid() {
        return ns.client.username;
    }

    function setDocid() {
    }

    // setDoc is called whenever your document is be reloaded.
    function setDoc(json) {
        modelReadyLatch.latch();

        // Expose appid
        items.appid = ns.client.appid;

        for (i=0, len=modelReadyCallbacks.length; i<len; i++) {
          modelReadyCallbacks[i]();
        }
    }

    // getDoc is called to read the state of the current document.
    function getDoc() {
        return {};
    }

    function confirmDiscard() {
    }

    function onError() {
    }
});
