/*
 * Copyright (c) 2010 - 2011, BeeDesk, Inc., unless otherwise noted.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 * * Redistributions of source code must retain the above copyright
 *   notice, this list of conditions and the following disclaimer.
 * * Redistributions in binary form must reproduce the above copyright
 *   notice, this list of conditions and the following disclaimer in the
 *   documentation and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL BeeDesk, Inc. AND ITS LICENSORS BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 **/
(function() {
  jqt = $.jQTouch({
    updatehash: false,
    hashquery: true
  });

  $(document).ready(function(){
    // initialize iscroll
    var KEY_ISCROLL_OBJ = 'iscroll_object';
    function refreshScroll($pane) {
      $pane.find('.s-scrollwrapper, .s-innerscrollwrapper').each(function (i, wrap) {
        var $wrapper = $(wrap);
        var scroll = $wrapper.data(KEY_ISCROLL_OBJ);
        if (scroll !== undefined && scroll !== null) {
          scroll.refresh();
        }
      });
    }

    var generatedRows = 0;
    function loaded() {
      $("#jqt").children().each(function (i, pane) {
        $(pane).find('.s-scrollwrapper, .s-innerscrollwrapper').each(function (i, wrap) {
          var $wrapper = $(wrap);
  
          var data = $wrapper.data(KEY_ISCROLL_OBJ);
          if (data === undefined || data === null) {
            var scroll;
            var options = {};
            if ($wrapper.hasClass("scrollrefresh")) {
              options = {
                pullToRefresh: "down",
                onPullDown: function () {
                  setTimeout(function () {
                    var el, li, i;
                    el = $("#z-inboxtask")[0];
    
                    for (i=0; i<3; i++) {
                      li = document.createElement('li');
                      li.innerText = 'Generated row ' + (++generatedRows);
                      el.insertBefore(li, el.childNodes[0]);
                    }
    
                    scroll.refresh(); // IMPORTANT!
                  }, 1000); // <-- Simulate network congestion, remove setTimeout from production!
                }
              };
            }

            scroll = new iScroll(wrap, options);
            $wrapper.data(KEY_ISCROLL_OBJ, scroll);
            scroll.refresh();
          }
        });
        $(pane).bind('pageAnimationEnd', function(event, info) {
          if (info.direction == 'in') {
            refreshScroll($(this));
          }
        });
      });
      $(window).resize(function() {
        $('#jqt > .current').each(function(i, one) {
          refreshScroll($(one));
        });
      });
    }
  
    loaded();
  
    setTimeout(function() {
      loaded();
      $(window).resize();
  
      setTimeout(function() {
        $(window).resize();
      }, 1500);
    }, 50);
  });  
})();

// Dynamically set next page titles after clicking certain links
(function(){
  $(document).ready(function(){
    $('#jqt a').bind('click', function(){
      var $autotitle = $('.autotitle', this);
      var t = $autotitle.text();
      if (!!t && t.length > 0) {
        $($(this).attr('href') + ' h1').text(t);
      }
    });

    var setbackbuttontext = function($pane, $back) {
      var $h1 = $pane.find('.toolbar h1');
      
      var h1 = $h1.text();
      if (!!h1 && h1.length > 0) {
        $back.text(h1);
      } else if (!!$h1 && !!$h1.attr("title") && $h1.attr("title").length > 0) {
        $back.text($h1.attr("title"));
      } else {
        $back.text('Back');
      }
    };

    // auto fill back button text
    $('#jqt a').bind('click', function(){
      var $pane = $(this).parents('.pane');

      var href = $(this).attr('href');
      if (href.match("^#[a-zA-Z0-9\-]")) {
        var $next = $(href);
        var $back = $next.find('.toolbar .back.autotext');

        setbackbuttontext($pane, $back);
      }
    });
    
    // Dynamically set next back button text
    $("#jqt #messages ul > li.arrow").live('tap', function() {
        jqt.goTo("#message", "slide");
    
        // auto fill back button text
        var $pane = $(this).parents('.pane');
    
        var $next = $("#message");
        var $back = $next.find('.toolbar .back.autotext');
    
        setbackbuttontext($pane, $back);
    });
  });
})();
