namespace.lookup('com.pageforest.scratch.test').defineOnce(function (ns) {
    function addTests(ts) {

        ts.addTest("Scratch Unit Tests", function(ut) {
            ut.assert(true);
        });
    }

    ns.extend({
        'addTests': addTests
    });
});
