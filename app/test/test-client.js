namespace.lookup('com.pageforest.client.test').defineOnce(function (ns) {
    var clientLib = namespace.lookup('com.pageforest.client');

    var testBlob = {'testNum': 1,
                    'testString': "hello",
                    'testBool': false,
                    'testObj': {'a': 1, 'b': 2},
                    'testArray': [1, 2, 3]
                   };

    function TestApp(ut) {
        this.ut = ut;
    }

    TestApp.methods({
        getDoc: function() {
            return {'blob': "hello"};
        },

        setDoc: function(json) {
            console.log("setDoc", json);
            this.restore = json;
        },

        onStateChange: function(newState, oldState) {
            this.state = newState;

            if (this.expectedState) {
                this.ut.assertEq(newState, this.expectedState);
                this.expectedState = undefined;
                this.ut.nextFn();
            }
        },

        getDocid: function() { return 'test-1'; },

        setDocid: function() {}
    });

    var app = new TestApp();
    var client = new clientLib.Client(app);

    function addTests(ts) {

        ts.addTest("Client", function(ut) {
            ts.coverage.cover('Client');
            ut.assert(client != undefined);
        });

        ts.addTest("save/load", function(ut) {

            app.ut = ut;
            // Ignore any doc hashtag
            client.detach();
            client.setDirty(false);

            ut.asyncSequence([
                // Make sure we're logged in
                function (ut) {
                    // Force a login check.
                    if (client.username != undefined) {
                        ut.nextFn();
                        return;
                    }

                    ut.assertEq(client.username, undefined,
                                "not yet logged in");
                    app.onUserChange = function(username) {
                        app.onUserChange = undefined;
                        ut.assertType(username, 'string');
                        ut.assertEq(client.state, 'loading');
                        ut.nextFn();
                    };
                    client.poll();
                },

                function (ut) {
                    ut.assertEq(client.getDocURL(), '/docs/test-1/');
                    app.expectedState = 'saving';
                    client.save({'title': "A testing document.",
                                 'blob': testBlob}, 'test-1');
                },

                function (ut) {
                    app.expectedState = 'clean';
                },

                function (ut) {
                    var url = client.getDocURL();
                    ut.assertEq(url.indexOf('/test-1'), url.length - 8);

                    app.expectedState = 'loading';
                    client.load('test-1');
                },

                function (ut) {
                    app.expectedState = 'clean';
                },

                function (ut) {
                    ut.assertEq(app.restore.blob, testBlob);
                    ut.nextFn();
                }

            ]);
        }).async(true);

        ts.addTest("Client UI", function(ut) {
            app.ut = ut;

            // Use the standard Pageforest UI widget.
            client.addAppBar();

            ut.assertEq($('#pfAppBar').length, 1);
            ut.assertGT($('#pfUsername').text().length, 0,
                        "Username should be displayed");
        });
    }

    ns.addTests = addTests;
});
