//
//
//
namespace.lookup('com.pageforest.directory').defineOnce(function (ns) {

    // state callbacks
    var modelReadyCallbacks = [], loggedin = [], loggedout = [];

    // model items
    var appid;

    // internal state helper
    var modelReadyLatch = Threads.latchbinder();

    var items = {
        name: "directory.pageforest",
        username: undefined,
        handler: {added: function() {}, removed: function() {}, updated: function() {}},
        appid: undefined
    };

    ns.extend({
        'main': main,
        'onUserChange': onUserChange,
        'items': items,
        'modelReady': modelReadyCallbacks,
        'loggedin': loggedin,
        'loggedout': loggedout,
        'appid': appid,
        'confirmDiscard': confirmDiscard,
        'onError': onError,
        'signOut': signOut
    });

    function signOut() {
        console.warn("siging out");
        ns.client.signOut();
        console.warn("siged out");
    }

    // This function is called when pageforest client code polled for
    // the first time.
    function onUserChange(newname) {
        var id;

        username = newname;

        items.username = username;

        var fn = !!username? loggedin: loggedout;
        for (i=0, len=fn.length; i<len; i++) {
            fn[i](newname);
        }
    }

    function onSaveSuccess(result) {
    }

    // This function is called when the index.html home page
    // is loaded.  Use it to initialize your application and
    // set up the Pageforest Client Library App Bar user interface.
    function main() {

        var clientLib = namespace.lookup('com.pageforest.client');

        // Client library for Pageforest
        ns.client = new clientLib.Client(ns);

        // Use the standard Pageforest UI widget.
        //ns.client.addAppBar();

        // This app demonstrates auto-loading - will reload the doc if
        // it is changed by another user.
        ns.client.autoLoad = true;

        // Quick call to poll - don't wait a whole second to try loading
        // the doc and logging in the user.
        ns.client.poll();

        // Expose appid
        items.appid = ns.client.appid;
    }

    function confirmDiscard() {
    }

    function onError() {
    }
});
