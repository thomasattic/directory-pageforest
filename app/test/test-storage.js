namespace.lookup('com.pageforest.storage.test').defineOnce(function (ns) {
    var clientLib = namespace.lookup('com.pageforest.client');
    var storage = namespace.lookup('com.pageforest.storage');
    var format = namespace.lookup('org.startpad.format');
    var base = namespace.lookup('org.startpad.base');
    var crypto = namespace.lookup('com.googlecode.crypto-js');

    var testBlob = {'testNum': 1,
                    'testString': "hello",
                    'testBool': false,
                    'testObj': {'a': 1, 'b': 2},
                    'testArray': [1, 2, 3]
                   };

    var testBlobString = storage.jsonToString(testBlob);
    var testSha1 = crypto.SHA1(testBlobString);

    function TestApp(ut) {
        this.ut = ut;
        this.ignore = undefined;
        this.waitingFor = undefined;
        this.skip = true;
    }

    TestApp.methods({
        expectedError: function(status) {
            this.ignore = status;
            this.skip = true;
        },

        onError: function(status, message) {
            if (!this.ignore) {
                this.ut.assert(false, "Unexpected error: " + status +
                               " (" + message + ")");
                return;
            }
            this.ut.assertEq(status, this.ignore);
            if (status == this.ignore) {
                if (this.skip) {
                    this.ignore = undefined;
                    this.ut.nextFn();
                }
            }
        },

        onInfo: function(code, message) {
            if (!this.waitingFor) {
                return;
            }
            if (this.waitingFor == code) {
                delete this.waitingFor;
                this.ut.nextFn();
            }
        },

        setDocid: function() {},

        getDocid: function () { return 'test-1'; }
    });

    // Anonymous app in this test.
    var client = new clientLib.Client(new TestApp());

    function addTests(ts) {
        ts.addTest("Storage", function(ut) {
            ut.assert(client.storage != undefined);
            ts.coverage.cover('Storage');
        });

        ts.addTest("getDocURL", function(ut) {
            var appHost = client.appHost;
            ut.assertEq(appHost.indexOf('scratch.pageforest'), 0);
            var url = client.storage.getDocURL('foo', 'bar');
            ut.assertEq(url.indexOf('/docs/foo/bar'), url.length - 13);

            var url2 = client.storage.getDocURL('foo');
            ut.assertEq(url2, url.substr(0, url.length - 3));

            // Should get the document root url
            url = client.storage.getDocURL();
            ut.assertEq(url.indexOf('/docs/'), url.length - 6);
        });

        ts.addTest("Docs: put/get/delete", function(ut) {
            client.app.ut = ut;

            function cont() {
                ut.nextFn();
            }

            ut.asyncSequence([
                function (ut) {
                    // Force a login check.
                    client.app.onUserChange = function(username) {
                        client.app.onUserChange = undefined;
                        ut.assertType(username, 'string');
                        ut.assertEq(client.state, 'clean');
                        ut.nextFn();
                    };
                    if (client.username == undefined) {
                        client.poll();
                    } else {
                        client.app.onUserChange(client.username);
                    }
                },

                function (ut) {
                    client.storage.putDoc('test-storage',
                                          {title: "Test storage document.",
                                           blob: testBlob},
                                          cont);
                },

                function (ut) {
                    client.storage.putBlob('test-storage', 'secret-blob',
                                           {secret: 'password'}, undefined,
                                           cont);
                },

                function (ut) {
                    client.storage.getDoc('test-storage', function(doc) {
                        ut.assertEq(doc.title, "Test storage document.");
                        ut.assertEq(doc.blob, testBlob);
                        ut.nextFn();
                    });
                },

                function (ut) {
                    client.app.expectedError("ajax_error/404");
                    client.storage.getDoc('does-not-exist', function(doc) {
                        ut.assert(false, "Should never call callback.");
                        ut.nextFn();
                    });
                },

                function (ut) {
                    client.storage.deleteDoc('test-storage', function (result) {
                        ut.assertEq(result.status, 200);
                        ut.nextFn();
                    });
                },

                function (ut) {
                    // Make sure the doc is really deleted
                    client.app.expectedError("ajax_error/404");
                    client.storage.getDoc('test-storage', function(doc) {
                        ut.assert(false, "Document not actually deleted.");
                        ut.nextFn();
                    });
                },

                function (ut) {
                    // And we can't get to it's child blob
                    client.app.expectedError("ajax_error/404");
                    client.storage.getBlob('test-storage', 'secret-blob', undefined,
                        function (result) {
                            ut.assert(false, "Child Blob of deleted document visible.");
                            ut.nextFn();
                        });
                },

                function (ut) {
                    // Create a same-named doc
                    client.storage.putDoc('test-storage',
                                          {title: "Test storage document.",
                                           blob: testBlob},
                                          cont);
                },

                function (ut) {
                    // And the new blob should NOT inherit the Blob orphan
                    client.app.expectedError("ajax_error/404");
                    client.storage.getBlob('test-storage', 'secret-blob', undefined,
                        function (result) {
                            ut.assert(false, "Orphaned Blob of deleted document visible.");
                            ut.nextFn();
                        });
                }
            ]);
        }).async();

        ts.addTest("Blobs: put/get/delete", function(ut) {
            var etag;

            client.app.ut = ut;

            ut.asyncSequence([
                function (ut) {
                    client.storage.putBlob('test-storage', 'test-blob',
                                           testBlob, undefined,
                        function (result, status, xmlhttp) {
                            etag = result.sha1;
                            ut.assertEq(result.status, 200);
                            ut.nextFn();
                        });
                },

                function (ut) {
                    client.storage.getBlob('test-storage', 'test-blob',
                                           undefined,
                        function (blob, status, xmlhttp) {
                            ut.assertEq(blob, testBlob);
                            ut.assertEq(storage.getEtag(xmlhttp), etag);
                            ut.nextFn();
                        });
                },

                function (ut) {
                    client.storage.deleteBlob('test-storage', 'test-blob',
                        function (result) {
                            ut.assertEq(result.status, 200);
                            ut.nextFn();
                        });
                },

                function (ut) {
                    client.app.expectedError("ajax_error/404");
                    client.storage.getBlob('test-storage', 'test-blob',
                                           undefined,
                        function (result) {
                            ut.assert(false, "unreachable");
                        });
                }

                // TODO: HEAD request
            ]);
        }).async();

        ts.addTest("list", function(ut) {
            client.app.ut = ut;
            var date1;
            var date2;

            function cont(result) {
                ut.assertEq(result.status, 200);
                ut.nextFn();
            }

            ut.asyncSequence([
                function (ut) {
                    client.storage.putBlob('test-storage', 'test-blob1',
                                           testBlob, undefined, cont);
                },

                function (ut) {
                    client.storage.putBlob('test-storage', 'test-blob2',
                                           testBlob, undefined, cont);
                },

                function (ut) {
                    // List of documents
                    client.storage.list(undefined, undefined, {},
                        function (result) {
                            ut.assertType(result.items, 'object');
                            ut.assertType(result.items['test-storage'],
                                          'object');
                            ut.nextFn();
                        });
                },

                function (ut) {
                    // List of blobs
                    client.storage.list('test-storage', undefined, {},
                        function (result) {
                            ut.assertType(result.items, Object);
                            var dir1 = result.items['test-blob1'];
                            var dir2 = result.items['test-blob2'];
                            ut.assertType(dir1, 'object');
                            ut.assertType(dir2, 'object');

                            ut.assertEq(dir1.json, true);
                            ut.assertEq(dir1.sha1, testSha1);
                            ut.assertEq(dir1.sha1, dir2.sha1);
                            ut.assertEq(dir1.size, dir2.size);
                            date1 = format.decodeClass(dir1.modified);
                            date2 = format.decodeClass(dir2.modified);
                            ut.assertType(date1, Date);
                            ut.assertLT(date1, date2);

                            ut.nextFn();
                        });
                },

                function (ut) {
                    client.storage.list('test-storage', undefined,
                                        {keysonly: true},
                        function (result) {
                            ut.assertType(result.items, 'object');
                            ut.assertEq(result.items['test-blob1'], {});
                            ut.assertEq(result.items['test-blob2'], {});
                            ut.nextFn();
                        });
                },

                function (ut) {
                    client.storage.list('test-storage', undefined,
                                        {order: "modified"},
                        function (result) {
                            ut.assertEq(result.order, ['test-blob1', 'test-blob2']);
                            ut.nextFn();
                        });
                },

                function (ut) {
                    client.storage.list('test-storage', undefined,
                                        {order: "-modified"},
                        function (result) {
                            ut.assertEq(result.order, ['test-blob2', 'test-blob1']);
                            ut.nextFn();
                        });
                },

                function (ut) {
                    var dateBump = new Date();
                    dateBump.setTime(date1.getTime() + 1);
                    console.log(format.isoFromDate(date1), format.isoFromDate(dateBump));
                    client.storage.list('test-storage', undefined,
                                        {since: dateBump},
                        function (result) {
                            ut.assert('test-blob2' in result.items, "missing newest blob");
                            ut.assert(!('test-blob1' in result.items), "has too old blob");
                            ut.nextFn();
                        });
                }
            ]);
        }).async(true, 15000);

        ts.addTest("list prefix and tag", function(ut) {
            client.app.ut = ut;

            function cont(result) {
                ut.assertEq(result.status, 200);
                ut.nextFn();
            }

            ut.asyncSequence([
                function (ut) {
                    client.storage.putBlob('test-storage', 'test-tag1',
                                           testBlob, {tags: ['tag1', 'tag2']},
                                           cont);
                },

                function (ut) {
                    client.storage.putBlob('test-storage', 'test-tag2',
                                           testBlob, {tags: ['tag2']},
                                           cont);
                },

                function (ut) {
                    client.storage.list('test-storage', undefined,
                                        {prefix: 'test-b'},
                        function (result) {
                            var items = result.items;
                            ut.assertType(items, 'object');
                            ut.assertEq(base.keys(items).length, 2);
                            ut.assert(items.hasOwnProperty('test-blob1'));
                            ut.assert(items.hasOwnProperty('test-blob2'));
                            ut.nextFn();
                        });
                },

                function (ut) {
                    client.storage.list('test-storage', undefined,
                                        {tag: 'tag2'},
                        function (result) {
                            var items = result.items;
                            ut.assertType(items, 'object');
                            ut.assertEq(base.keys(items).length, 2);
                            ut.assert(items.hasOwnProperty('test-tag1'));
                            ut.assert(items.hasOwnProperty('test-tag2'));
                            ut.assertEq(items['test-tag1'].tags,
                                        ['tag1', 'tag2']);
                            ut.assertEq(items['test-tag2'].tags, ['tag2']);
                            ut.nextFn();
                        });
                },

                function (ut) {
                    client.storage.list('test-storage', undefined,
                                        {tag: 'tag1'},
                        function (result) {
                            var items = result.items;
                            ut.assertType(items, 'object');
                            ut.assertEq(base.keys(items).length, 1);
                            ut.assert(items.hasOwnProperty('test-tag1'));
                            ut.nextFn();
                        });
                }
            ]);
        }).async();

        ts.addTest("list depth", function(ut) {
            client.app.ut = ut;

            var keys = ["root",
                        "root/child1", "root/child2",
                        "root/child1/child3"];

            ut.asyncSequence([
                function (ut) {
                    var i = 0;

                    function nextBlob() {
                        client.storage.putBlob('test-storage', keys[i],
                                               testBlob, undefined,
                            function (result) {
                                ut.assertEq(result.status, 200);
                                if (++i < keys.length) {
                                    setTimeout(nextBlob, 1);
                                    return;
                                }
                                ut.nextFn();
                            });
                    }

                    nextBlob();
                },

                function (ut) {
                    client.storage.list('test-storage', 'root', {},
                        function (result) {
                            var items = result.items;
                            ut.assertEq(base.keys(items).length, 2);
                            ut.assert(items.hasOwnProperty('child1'));
                            ut.assert(items.hasOwnProperty('child2'));
                            ut.nextFn();
                        });
                },

                function (ut) {
                    client.storage.list('test-storage', 'root', {depth: 1},
                        function (result) {
                            var items = result.items;
                            ut.assertEq(base.keys(items).length, 2);
                            ut.assert(items.hasOwnProperty('child1'));
                            ut.assert(items.hasOwnProperty('child2'));
                            ut.nextFn();
                        });
                },

                function (ut) {
                    client.storage.list('test-storage', 'root', {depth: 0},
                        function (result) {
                            var items = result.items;
                            ut.assertEq(base.keys(items).length, 3);
                            ut.assert(items.hasOwnProperty('child1'));
                            ut.assert(items.hasOwnProperty('child2'));
                            ut.assert(items.hasOwnProperty('child1/child3'));
                            ut.nextFn();
                        });
                }
            ]);
        }).async();

        ts.addTest("push/slice", function(ut) {
            client.app.ut = ut;

            var sliceTests = [[undefined, undefined,
                               [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]],
                              [-5, undefined, [5, 6, 7, 8, 9]],
                              [undefined, 5, [0, 1, 2, 3, 4]],
                              [2, 7, [2, 3, 4, 5, 6]]
                             ];

            ut.asyncSequence([
                function (ut) {
                    // The test-array might not be created yet...
                    client.app.expectedError("ajax_error/404");
                    client.storage.deleteBlob('test-storage', 'test-array',
                        function (results) {
                            client.app.expectedError();
                            ut.assert(results.status, 200);
                            ut.nextFn();
                        });
                },

                // Push 10 integers into an array
                function (ut) {
                    var i = 0;

                    function nextArg() {
                        client.storage.push('test-storage', 'test-array',
                                            i++, {},
                            function (result) {
                                ut.assertEq(result.status, 200);
                                if (i == 10) {
                                    ut.nextFn();
                                    return;
                                }
                                setTimeout(nextArg, 1);
                            });
                    }

                    nextArg();
                },

                function (ut) {
                    client.storage.getBlob('test-storage', 'test-array', {},
                        function (json) {
                            ut.assertEq(json, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
                            ut.nextFn();
                        });
                },

                function (ut) {
                    this.ut = ut;
                    var i = 0;

                    function nextSlice() {
                        var test = sliceTests[i++];

                        client.storage.slice('test-storage', 'test-array',
                                             {start: test[0], end: test[1]},
                            function (json) {
                                ut.assertEq(json, test[2]);
                                if (i == sliceTests.length) {
                                    ut.nextFn();
                                    return;
                                }
                                setTimeout(nextSlice, 1);
                            });

                    }
                    nextSlice();
                },

                function (ut) {
                    client.app.expectedError("slice_range");
                    client.storage.slice('test-storage', 'test-array',
                                         {start: 'foo'},
                        function (result) {
                            ut.assert(false, "unreachable");
                        });
                },

                function (ut) {
                    client.app.expectedError("ajax_error/404");
                    client.storage.slice('test-storage', 'does-not-exist',
                                         {start: 0, end: 0},
                        function (result) {
                            ut.assert(false, "unreachable");
                        });
                },

                function (ut) {
                    client.storage.push('test-storage', 'test-array',
                                        "new", {max: 5},
                        function (result) {
                            ut.assertEq(result.newLength, 5);
                            ut.nextFn();
                        });
                },

                function (ut) {
                    client.storage.getBlob('test-storage', 'test-array', {},
                        function (json) {
                            ut.assertEq(json, [6, 7, 8, 9, "new"]);
                            ut.nextFn();
                        });
                }
            ]);
        }).async(true, 15000);

        ts.addTest("wait", function(ut) {
            client.app.ut = ut;
            var etag;

            ut.asyncSequence([
                function (ut) {
                    client.storage.putBlob('test-storage', 'test-wait',
                                           [1, 2, 3, 4, 5], undefined,
                        function (result, status, xmlhttp) {
                            etag = result.sha1;
                            ut.assertEq(result.status, 200);
                            ut.nextFn();
                        });
                },

                function (ut) {
                    var timeStart = new Date().getTime();
                    client.storage.getBlob('test-storage', 'test-wait',
                                           undefined,
                        function (blob, status, xmlhttp) {
                            var time = new Date().getTime();

                            ut.assertLT(time - timeStart, 500);
                            ut.assertEq(storage.getEtag(xmlhttp), etag);
                            ut.nextFn();
                        });
                },

                function (ut) {
                    var timeStart = new Date().getTime();
                    client.storage.getBlob('test-storage', 'test-wait',
                                           {wait: 3},
                        function (blob, status, xmlhttp) {
                            var time = new Date().getTime();

                            ut.assertGT(time - timeStart, 3000);
                            ut.assertEq(storage.getEtag(xmlhttp), etag);
                            ut.nextFn();
                        });
                }

                // Removed tests for async update and early return -
                // since these requests seem to be serialized on both
                // the dev appserver and the production server!
            ]);
        }).async(true, 15000).enable(false);

        ts.addTest("channel", function(ut) {
            client.app.ut = ut;
            client.app.ignore = 'channel/nosub';
            client.app.skip = false;
            client.app.waitingFor = 'channel/updated';
            // dev_appserver will deliver state notifications
            var etag;
            var etagNew;

            ut.asyncSequence([
                function (ut) {
                    ut.assert(!client.storage.hasSubscription('test-storage',
                                                              'test-channel'));
                    client.storage.subscribe('test-storage', 'test-channel',
                                             undefined,
                        function (message) {
                            ut.assertEq(message.app, 'scratch');
                            ut.assertEq(message.method, 'PUT');
                            ut.assertEq(message.key,
                                        'test-storage/test-channel/');
                            if (etag == undefined) {
                                etag = message.data.sha1;
                            } else {
                                ut.assertEq(message.data.sha1, etag);
                            }
                            ut.nextFn();
                        });
                    ut.assert(client.storage.hasSubscription('test-storage',
                                                             'test-channel'));
                },

                function (ut) {
                    client.storage.putBlob('test-storage', 'test-channel',
                                           [1, 2, 3, 4, 5], undefined,
                        function (result, status, xmlhttp) {
                            ut.assertEq(result.status, 200);
                            if (etag == undefined) {
                                etag = result.sha1;
                            } else {
                                ut.assertEq(result.sha1, etag);
                            }
                        });
                },

                function (ut) {
                    var timeStart = new Date().getTime();

                    client.storage.subscribe('test-storage', 'test-channel',
                                             undefined,
                        function (message) {
                            var time = new Date().getTime();
                            ut.assertGT(time - timeStart, 1000);
                            ut.assertEq(message.key,
                                        'test-storage/test-channel/');
                            ut.assertEq(message.method, 'PUSH');
                            if (etagNew == undefined) {
                                etagNew = message.data.sha1;
                            } else {
                                ut.assertEq(message.data.sha1, etagNew);
                                ut.assertNEq(etagNew, etag);
                                ut.nextFn();
                            }
                        });

                    function doPush() {
                        client.storage.push('test-storage', 'test-channel',
                                            6, undefined,
                            function (result) {
                                ut.assertEq(result.status, 200);
                                if (etagNew == undefined) {
                                    etagNew = result.newSha1;
                                } else {
                                    ut.assertEq(result.newSha1, etagNew);
                                    ut.assertNEq(etagNew, etag);
                                    ut.nextFn();
                                }
                            });
                    }

                    setTimeout(doPush, 1000);
                },

                function (ut) {
                    var timeStart = new Date().getTime();

                    client.storage.subscribe('test-storage', undefined,
                                             undefined,
                        function (message) {
                            var time = new Date().getTime();
                            ut.assertGT(time - timeStart, 1000);
                            ut.assertEq(message.method, 'PUT');
                            ut.assertEq(message.key, "test-storage/");
                            ut.nextFn();
                        });

                    function doPut() {
                        client.storage.putDoc('test-storage',
                            {title: "Test storage document - " +
                             "channel update.",
                             blob: testBlob},
                            function (result) {
                                ut.assertEq(result.status, 200);
                            });
                    }

                    setTimeout(doPut, 1000);
                },

                function (ut) {
                    var timeStart = new Date().getTime();

                    client.storage.subscribe('test-storage', undefined,
                                             {children: true},
                        function (message) {
                            // Ignore PUT messages for doc and past blob PUTS
                            // left over from old subscriptions!
                            if (message.key != 'test-storage/test-blob-2/') {
                                return;
                            }
                            console.log("Calling parent callback");
                            var time = new Date().getTime();
                            ut.assertGT(time - timeStart, 1000);
                            ut.assertEq(message.method, 'PUT');
                            ut.assertEq(message.key, "test-storage/test-blob-2/");
                            ut.nextFn();
                        });

                    function doBlobPut() {
                        client.storage.putBlob('test-storage', 'test-blob-2',
                            {title: "Test storage document - channel update.",
                             blob: testBlob}, undefined,
                            function (result) {
                                ut.assertEq(result.status, 200);
                            });
                    }

                    setTimeout(doBlobPut, 1000);
                }
            ]);
        }).async(true, 30000);

        ts.addTest("Anonymous public", function (ut) {
            client.ignore = undefined;

            function cont() {
                ut.nextFn();
            }

            ut.asyncSequence([
                function (ut) {
                    client.storage.putDoc('test-public',
                                          {title: "Public storage document.",
                                           blob: testBlob,
                                           readers: ['public'],
                                           writers: ['public']
                                          },
                                          cont);
                },

                function (ut) {
                    client.storage.putBlob('test-public', 'test-blob',
                                           testBlob, undefined,
                        function (result, status, xmlhttp) {
                            etag = result.sha1;
                            ut.assertEq(result.status, 200);
                            ut.nextFn();
                        });
                },

                function (ut) {
                    client.app.onUserChange = function(username) {
                        client.app.onUserChange = undefined;
                        ut.assertEq(username, undefined);
                        ut.nextFn();
                    };
                    client.signOut();
                    client.poll();
                },

                function (ut) {
                    client.storage.putBlob('test-public', 'test-blob',
                                           testBlob, undefined,
                        function (result, status, xmlhttp) {
                            etag = result.sha1;
                            ut.assertEq(result.status, 200);
                            ut.nextFn();
                        });
                }

            ]);
        }).async();

    } // addTests

    // TODO: Test HEAD

    ns.addTests = addTests;
});
