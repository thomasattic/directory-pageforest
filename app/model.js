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
        'getDoc': getDoc,
        'setDoc': setDoc,
        'getDocid': getDocid,
        'setDocid': setDocid,
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
        // doc schema: {blob: {schema: 1, items: {<appid>: {icon: '', url: '', title: ''}, order: []}}}
        var i, len;
        var id, item, olditem, event, after;

        var hasitem = !!json && !!json.blob && !!json.blob.items;
        if (!hasitem) {
            return;
        }

        var data = json.blob;

        var commonTheirOrder = Arrays.clone(data.order);
        var theirs = Arrays.clone(data.order).sort();

        var commonMyOrder = Arrays.clone(displayedorder);
        var mine = Arrays.clone(displayedorder).sort();

        var diff = Arrays.intersect(mine, theirs, false);
        for (i=0, len=diff.left.length; i<len; i++) {
          // item removed
          id = diff.left[i];
          olditem = displayeditems[id];
          items.handler.removed({id: id, olditem: olditem});
          Arrays.remove(commonMyOrder, commonMyOrder.indexOf(id));
        }
        for (i=0, len=diff.right.length; i<len; i++) {
          id = diff.right[i];
          Arrays.remove(commonTheirOrder, commonTheirOrder.indexOf(id));
        }
        for (i=0, len=diff.middle.length; i<len; i++) {
          id = commonTheirOrder[i];
          item = data.items[id];
          olditem = displayeditems[id];

          event = {id: id, item: item, olditem: olditem};
          var theirPrev, myPrev, cur;
          if (i>0) {
            theirPrev = commonTheirOrder[i-1];
            cur = commonMyOrder.indexOf(id);
            myPrev = commonMyOrder[cur-1];
            if (myPrev !== theirPrev) {
              event.after = theirPrev;
            }
          } else {
            theirPrev = null;
            cur = commonMyOrder.indexOf(id);
            if (cur !== 0) {
              event.after = null;
            }
          }
          if (!Hashs.isEquals(item, olditem) || after === undefined) {
            // item updated
            if (after === null) {
              after = undefined;
            }
            items.handler.updated(event);
          }
        }
        for (i=0, len=data.order.length; i<len; i++) {
          // item added
          id = data.order[i];
          item = data.items[id];
          if (diff.right.indexOf(id) >= 0) {
            if (i === 0) {
              after = undefined;
            } else {
              after = data.order[i-1];
            }
            items.handler.added({id: id, item: item, after: after});
          }
        }

        displayedorder = data.order;
        displayeditems = data.items;

        modelReadyLatch.latch();

        // Expose appid
        items.appid = ns.client.appid;

        for (i=0, len=modelReadyCallbacks.length; i<len; i++) {
          modelReadyCallbacks[i]();
        }
    }

    // getDoc is called to read the state of the current document.
    function getDoc() {
        return {
          title: 'User workspace',
          blob: {
            items: displayeditems,
            order: displayedorder
          }
        };
    }

    function confirmDiscard() {
    }

    function onError() {
    }
});
