/**
 * Login Lockdown
 * Admin Functions
 * (c) WebFactory Ltd, 2022 - 2024, www.webfactoryltd.com
 */

var LoginLockdown = {};

LoginLockdown.init = function () {};

LoginLockdown.init3rdParty = function ($) {
  $("#loginlockdown_tabs")
    .tabs({
      activate: function (event, ui) {
        window.localStorage.setItem("loginlockdown_tabs", $("#loginlockdown_tabs").tabs("option", "active"));
      },
      create: function (event, ui) {
        if (window.location.hash && $('a[href="' + location.hash + '"]').length) {
          $("#loginlockdown_tabs").tabs(
            "option",
            "active",
            $('a[href="' + location.hash + '"]')
              .parent()
              .index()
          );
        }
        $('#loginlockdown_tabs_sidebar').show();
      },
      beforeActivate: function (event, ui) {
        if( $(ui.newTab).find('a').hasClass('open-upsell')){ //check if it is hash link
          return false;
        }
      },
      active: window.localStorage.getItem("loginlockdown_tabs"),
    })
    .show();

  // init 2nd level of tabs
  $(".loginlockdown-tabs-2nd-level").each(function () {
    $(this).tabs({
      activate: function (event, ui) {
        window.localStorage.setItem($(this).attr("id"), $(this).tabs("option", "active"));
      },
      active: window.localStorage.getItem($(this).attr("id")),
    });
  });
}; // init3rdParty

LoginLockdown.initUI = function ($) {
  // universal button to close UI dialog in any dialog
  $(".loginlockdown-close-ui-dialog").on("click", function (e) {
    e.preventDefault();

    parent = $(this).closest(".ui-dialog-content");
    $(parent).dialog("close");

    return false;
  }); // close-ui-dialog

  // autosize textareas
  $.each($("#loginlockdown_tabs textarea[data-autoresize]"), function () {
    var offset = this.offsetHeight - this.clientHeight;

    var resizeTextarea = function (el) {
      $(el)
        .css("height", "auto")
        .css("height", el.scrollHeight + offset + 2);
    };
    $(this)
      .on("keyup input click", function () {
        resizeTextarea(this);
      })
      .removeAttr("data-autoresize");
  }); // autosize textareas
}; // initUI

LoginLockdown.fix_dialog_close = function (event, ui) {
  jQuery(".ui-widget-overlay").bind("click", function () {
    jQuery("#" + event.target.id).dialog("close");
  });
}; // fix_dialog_close


jQuery(document).ready(function ($) {
  // helper for linking anchors in different tabs
  $(".settings_page_loginlockdown").on("click", ".change_tab", function (e) {
    e.preventDefault();

    tab_name = "loginlockdown_" + $(this).data("tab");
    tab_id = $('#loginlockdown_tabs ul.ui-tabs-nav li[aria-controls="' + tab_name + '"]')
      .attr("aria-labelledby")
      .replace("ui-id-", "");
    if (!tab_id) {
      return false;
    }

    $("#loginlockdown_tabs").tabs("option", "active", tab_id - 1);

    if ($(this).data("tab2")) {
      tab_name2 = "tab_" + $(this).data("tab2");
      tmp = $("#" + tab_name + ' ul.ui-tabs-nav li[aria-controls="' + tab_name2 + '"]');
      tab_id = $("#" + tab_name + " ul.ui-tabs-nav li").index(tmp);
      if (tab_id == -1) {
        return false;
      }

      $("#" + tab_name + " .loginlockdown-tabs-2nd-level").tabs("option", "active", tab_id);
    } // if secondary tab

    // get the link anchor and scroll to it
    target = this.href.split("#")[1];

    return false;
  }); // change tab

  // helper for linking anchors in different tabs
  $(".settings_page_loginlockdown").on("click", ".confirm_action", function (e) {
    message = $(this).data("confirm");

    if (!message || confirm(message)) {
      return true;
    } else {
      e.preventDefault();
      return false;
    }
  }); // confirm action before link click

  $(window).on("hashchange", function () {
    $("#loginlockdown_tabs").tabs(
      "option",
      "active",
      $("a[href=\\" + location.hash + "]")
        .parent()
        .index()
    );
  });

  var selectedTab = getUrlParameter("tab");

  if (selectedTab) {
    $("#loginlockdown_tabs").tabs(
      "option",
      "active",
      $("a[href=\\#" + selectedTab + "]")
        .parent()
        .index()
    );
  }

  LoginLockdown.initUI($);
  LoginLockdown.init3rdParty($);

  $("#loginlockdown-locks-log-table").one("preInit.dt", function () {
    $("#loginlockdown-locks-log-table_filter").append('<div id="loginlockdown-locks-log-toggle-chart" title="' + (window.localStorage.getItem("loginlockdown_locks_chart") == "disabled" ? "Show" : "Hide") + ' locks Chart" class="tooltip loginlockdown-locks-log-toggle-chart loginlockdown-locks-log-toggle-chart-' + window.localStorage.getItem("loginlockdown_locks_chart") + '"><i class="loginlockdown-icon loginlockdown-graph"></i></a>');

    $("#loginlockdown-locks-log-table_filter").append('<div id="loginlockdown-locks-log-toggle-stats" title="' + (window.localStorage.getItem("loginlockdown_locks_stats") == "disabled" ? "Show" : "Hide") + ' locks Stats" class="tooltip loginlockdown-locks-log-toggle-stats loginlockdown-locks-log-toggle-stats-' + window.localStorage.getItem("loginlockdown_locks_stats") + '"><i class="loginlockdown-icon loginlockdown-pie"></i></a>');

    $(".tooltip").tooltipster();
  });

  $("#loginlockdown-fails-log-table").one("preInit.dt", function () {
    $("#loginlockdown-fails-log-table_filter").append('<div id="loginlockdown-fails-log-toggle-chart" title="' + (window.localStorage.getItem("loginlockdown_fails_chart") == "disabled" ? "Show" : "Hide") + ' fails Chart" class="tooltip loginlockdown-fails-log-toggle-chart loginlockdown-fails-log-toggle-chart-' + window.localStorage.getItem("loginlockdown_fails_chart") + '"><i class="loginlockdown-icon loginlockdown-graph"></i></a>');
    $("#loginlockdown-fails-log-table_filter").append('<div id="loginlockdown-fails-log-toggle-stats" title="' + (window.localStorage.getItem("loginlockdown_fails_stats") == "disabled" ? "Show" : "Hide") + ' fails Stats" class="tooltip loginlockdown-fails-log-toggle-stats loginlockdown-fails-log-toggle-stats-' + window.localStorage.getItem("loginlockdown_fails_stats") + '"><i class="loginlockdown-icon loginlockdown-pie"></i></a>');

    $(".tooltip").tooltipster();
  });

  $("#loginlockdown_tabs").on("click", ".loginlockdown-fails-log-toggle-chart", function () {
    if ($(this).hasClass("loginlockdown-fails-log-toggle-chart-enabled")) {
      $("#tab_log_full .loginlockdown-chart-placeholder").fadeOut(300);
      $(".loginlockdown-chart-fails").hide(
        "blind",
        {
          direction: "vertical",
          complete: function () {
            center_locks_placeholder("full");
          },
        },
        500
      );
      $(this).removeClass("loginlockdown-fails-log-toggle-chart-enabled");
      $(this).addClass("loginlockdown-fails-log-toggle-chart-disabled");
      $(this).attr("title", "Show Failed Attempts Chart");
      window.localStorage.setItem("loginlockdown_fails_chart", "disabled");
    } else {
      $(this).removeClass("loginlockdown-fails-log-toggle-chart-disabled");
      $(this).addClass("loginlockdown-fails-log-toggle-chart-enabled");
      $(this).attr("title", "Hide Failed Attempts Chart");
      window.localStorage.setItem("loginlockdown_fails_chart", "enabled");
      $(".loginlockdown-chart-fails").show();
      create_fails_chart();
      $(".loginlockdown-chart-fails").hide();
      $("#loginlockdown_fails_log .loginlockdown-chart-placeholder").fadeOut(300);
      $(".loginlockdown-chart-fails").show(
        "blind",
        {
          direction: "vertical",
          complete: function () {
            center_locks_placeholder("full");
          },
        },
        500
      );
    }

    $(this).tooltipster("destroy");
    $(".tooltip").tooltipster();
  });

  $("#loginlockdown_tabs").on("click", ".loginlockdown-locks-log-toggle-chart", function () {
    if ($(this).hasClass("loginlockdown-locks-log-toggle-chart-enabled")) {
      $("#tab_log_locks .loginlockdown-chart-placeholder").fadeOut(300);
      $(".loginlockdown-chart-locks").hide(
        "blind",
        {
          direction: "vertical",
          complete: function () {
            center_locks_placeholder("locks");
          },
        },
        500
      );
      $(this).removeClass("loginlockdown-locks-log-toggle-chart-enabled");
      $(this).addClass("loginlockdown-locks-log-toggle-chart-disabled");
      $(this).attr("title", "Show Failed Attempts Chart");
      window.localStorage.setItem("loginlockdown_locks_chart", "disabled");
    } else {
      $(this).removeClass("loginlockdown-locks-log-toggle-chart-disabled");
      $(this).addClass("loginlockdown-locks-log-toggle-chart-enabled");
      $(this).attr("title", "Hide Lockdowns Chart");
      window.localStorage.setItem("loginlockdown_locks_chart", "enabled");
      $(".loginlockdown-chart-locks").show();
      create_locks_chart();
      $(".loginlockdown-chart-locks").hide();
      $("#loginlockdown_locks_log .loginlockdown-chart-placeholder").fadeOut(300);
      $(".loginlockdown-chart-locks").show(
        "blind",
        {
          direction: "vertical",
          complete: function () {
            center_locks_placeholder("locks");
          },
        },
        500
      );
    }

    $(this).tooltipster("destroy");
    $(".tooltip").tooltipster();
  });

  function center_locks_placeholder(type) {
    var placeholder_top = 0;

    if ($("#tab_log_" + type + " .loginlockdown-chart-" + type + "").is(":visible")) {
      placeholder_top = placeholder_top + 70;
    }
    if ($("#tab_log_" + type + " .loginlockdown-stats-" + type + "").is(":visible")) {
      placeholder_top = placeholder_top + 120;
    }

    $("#tab_log_" + type + " .loginlockdown-chart-placeholder").css("top", placeholder_top + "px");
    if (placeholder_top == 0) {
      $("#tab_log_" + type + " .loginlockdown-chart-placeholder").hide();
    } else {
      $("#tab_log_" + type + " .loginlockdown-chart-placeholder").fadeIn(300);
      $("#tab_log_" + type + " .loginlockdown-chart-placeholder").css("top", placeholder_top + "px");
    }
  }

  if (loginlockdown_vars.stats_locks.total == 0) {
    var placeholder_top = 0;
    if (window.localStorage.getItem("loginlockdown_locks_stats") == "enabled") {
      placeholder_top = placeholder_top + 70;
    }
    if (window.localStorage.getItem("loginlockdown_locks_chart") == "enabled") {
      placeholder_top = placeholder_top + 120;
    }
    $(".loginlockdown-chart-locks").css("filter", "blur(3px)");
    $(".loginlockdown-stats-locks").css("filter", "blur(3px)");
    $("#tab_log_locks").append('<div class="loginlockdown-chart-placeholder">' + loginlockdown_vars.stats_unavailable + "</div>");

    if (placeholder_top == 0) {
      $("#tab_log_locks .loginlockdown-chart-placeholder").hide();
    } else {
      $("#tab_log_locks .loginlockdown-chart-placeholder").css("top", placeholder_top + "px");
      $("#loginlockdown_locks_log .loginlockdown-chart-placeholder").fadeIn(300);
    }
  }

  if (loginlockdown_vars.stats_fails.total == 0) {
    var placeholder_top = 0;
    if (window.localStorage.getItem("loginlockdown_fails_stats") == "enabled") {
      placeholder_top = placeholder_top + 70;
    }
    if (window.localStorage.getItem("loginlockdown_fails_chart") == "enabled") {
      placeholder_top = placeholder_top + 120;
    }
    $(".loginlockdown-chart-fails").css("filter", "blur(3px)");
    $(".loginlockdown-stats-fails").css("filter", "blur(3px)");
    $("#tab_log_full").append('<div class="loginlockdown-chart-placeholder">' + loginlockdown_vars.stats_unavailable + "</div>");

    if (placeholder_top == 0) {
      $("#tab_log_full .loginlockdown-chart-placeholder").hide();
    } else {
      $("#tab_log_full .loginlockdown-chart-placeholder").css("top", placeholder_top + "px");
      $("#loginlockdown_fails_log .loginlockdown-chart-placeholder").fadeIn(300);
    }
  }

  $("#loginlockdown_tabs").on("click", ".loginlockdown-fails-log-toggle-stats", function () {
    if ($(this).hasClass("loginlockdown-fails-log-toggle-stats-enabled")) {
      $("#loginlockdown_fails_log .loginlockdown-chart-placeholder").fadeOut(300);
      $(".loginlockdown-stats-fails").hide(
        "blind",
        {
          direction: "vertical",
          complete: function () {
            center_locks_placeholder("full");
          },
        },
        500
      );
      $(this).removeClass("loginlockdown-fails-log-toggle-stats-enabled");
      $(this).addClass("loginlockdown-fails-log-toggle-stats-disabled");
      $(this).attr("title", "Show Failed Attempts Stats");
      window.localStorage.setItem("loginlockdown_fails_stats", "disabled");
    } else {
      $(this).removeClass("loginlockdown-fails-log-toggle-stats-disabled");
      $(this).addClass("loginlockdown-fails-log-toggle-stats-enabled");
      $(this).attr("title", "Hide fails Stats");
      window.localStorage.setItem("loginlockdown_fails_stats", "enabled");
      $(".loginlockdown-stats-fails").show();
      $(".loginlockdown-stats-fails").hide();
      $("#loginlockdown_fails_log .loginlockdown-chart-placeholder").fadeOut(300);
      $(".loginlockdown-stats-fails").show(
        "blind",
        {
          direction: "vertical",
          complete: function () {
            center_locks_placeholder("full");
          },
        },
        500
      );
    }

    $(this).tooltipster("destroy");
    $(".tooltip").tooltipster();
  });

  $("#loginlockdown_tabs").on("click", ".loginlockdown-locks-log-toggle-stats", function () {
    if ($(this).hasClass("loginlockdown-locks-log-toggle-stats-enabled")) {
      $("#loginlockdown_locks_log .loginlockdown-chart-placeholder").fadeOut(300);
      $(".loginlockdown-stats-locks").hide(
        "blind",
        {
          direction: "vertical",
          complete: function () {
            center_locks_placeholder("locks");
          },
        },
        500
      );
      $(this).removeClass("loginlockdown-locks-log-toggle-stats-enabled");
      $(this).addClass("loginlockdown-locks-log-toggle-stats-disabled");
      $(this).attr("title", "Show Lockdowns Stats");
      window.localStorage.setItem("loginlockdown_locks_stats", "disabled");
    } else {
      $(this).removeClass("loginlockdown-locks-log-toggle-stats-disabled");
      $(this).addClass("loginlockdown-locks-log-toggle-stats-enabled");
      $(this).attr("title", "Hide Lockdowns Stats");

      window.localStorage.setItem("loginlockdown_locks_stats", "enabled");
      $(".loginlockdown-stats-locks").show();
      $(".loginlockdown-stats-locks").hide();
      $("#loginlockdown_locks_log .loginlockdown-chart-placeholder").fadeOut(300);
      $(".loginlockdown-stats-locks").show(
        "blind",
        {
          direction: "vertical",
          complete: function () {
            center_locks_placeholder("locks");
          },
        },
        500
      );
    }

    $(this).tooltipster("destroy");
    $(".tooltip").tooltipster();
  });

  $(".settings_page_loginlockdown").on("click", ".unlock_lockdown", function (e) {
    e.preventDefault();
    $.post({
      url: ajaxurl,
      data: {
        action: "loginlockdown_run_tool",
        _ajax_nonce: loginlockdown_vars.run_tool_nonce,
        tool: "unlock_lockdown",
        lock_id: $(this).data("lock-id"),
      },
    })
      .always(function (response) {})
      .done(function (response) {
        location.reload();
      });
  });

  $(".settings_page_loginlockdown").on("click", ".delete_lock_entry", function (e) {
    e.preventDefault();
    uid = $(this).data("lock-uid");
    button = $(this);

    loginlockdown_swal
      .fire({
        title: $(button).data("title"),
        type: "question",
        text: $(button).data("text"),
        heightAuto: false,
        showCancelButton: true,
        focusConfirm: false,
        confirmButtonText: $(button).data("btn-confirm"),
        cancelButtonText: loginlockdown_vars.cancel_button,
        width: 600,
      })
      .then((result) => {
        if (typeof result.value != "undefined") {
          block = block_ui($(button).data("msg-wait"));
          $.post({
            url: ajaxurl,
            data: {
              action: "loginlockdown_run_tool",
              _ajax_nonce: loginlockdown_vars.run_tool_nonce,
              tool: "delete_lock_log",
              lock_id: $(button).data("lock-id"),
            },
          })
            .always(function (response) {
              loginlockdown_swal.close();
            })
            .done(function (response) {
              if (response.success) {
                $("#loginlockdown-locks-log-table tr#" + response.data.id).remove();
                loginlockdown_swal.fire({
                  type: "success",
                  heightAuto: false,
                  title: $(button).data("msg-success"),
                });
              } else {
                loginlockdown_swal.fire({
                  type: "error",
                  heightAuto: false,
                  title: loginlockdown_vars.documented_error + " " + data.data,
                });
              }
            })
            .fail(function (response) {
              loginlockdown_swal.fire({
                type: "error",
                heightAuto: false,
                title: loginlockdown_vars.undocumented_error,
              });
            });
        } // if confirmed
      });
  });

  $(".settings_page_loginlockdown").on("click", ".empty_log", function (e) {
    e.preventDefault();
    button = $(this);

    loginlockdown_swal
      .fire({
        title: $(button).data("title"),
        type: "question",
        text: $(button).data("text"),
        heightAuto: false,
        showCancelButton: true,
        focusConfirm: false,
        confirmButtonText: $(button).data("btn-confirm"),
        cancelButtonText: loginlockdown_vars.cancel_button,
        width: 600,
      })
      .then((result) => {
        if (typeof result.value != "undefined") {
          block = block_ui($(button).data("msg-wait"));
          $.post({
            url: ajaxurl,
            data: {
              action: "loginlockdown_run_tool",
              _ajax_nonce: loginlockdown_vars.run_tool_nonce,
              tool: "empty_log",
              log: $(button).data("log"),
            },
          })
            .always(function (response) {
              loginlockdown_swal.close();
            })
            .done(function (response) {
              location.reload();
            })
            .fail(function (response) {
              loginlockdown_swal.fire({
                type: "error",
                heightAuto: false,
                title: loginlockdown_vars.undocumented_error,
              });
            });
        } // if confirmed
      });
  });

  $(".settings_page_loginlockdown").on("click", ".captcha-box-wrapper img", function (e) {
    $("#captcha").val($(this).parent().data("captcha"));
    $("#captcha").trigger("change");
    $(".captcha-box-wrapper").removeClass("captcha-selected");
    $(this).parent().addClass("captcha-selected");
  });

  $(".settings_page_loginlockdown").on("blur change keyup", "#captcha", function (e) {
    if(($('#captcha').val() == 'builtin') && $(this).val() != $(this).data('old')){
        $('.captcha_verify_wrapper').show();
    } else {
        $('.captcha_verify_wrapper').hide();
    }
  });

  $(".settings_page_loginlockdown").on("click", "#verify-captcha", function (e) {
    e.preventDefault();
    var captcha_response,captcha_response_token;

    loginlockdown_swal
      .fire({
        title: 'Verify Captcha',
        type: "",
        icon: "",
        html: '<div class="loginlockdown-swal-captcha-wrapper"><div class="loginlockdown-captcha-loader"><img width="64" src="' + loginlockdown_vars.icon_url + '" /></div><div id="loginlockdown_captcha_box" style="margin: 0 auto; display: inline-block;"></div></div>',
        onOpen: () => {
            window.loginlockdown_captcha_script = document.createElement('script');
            if($('#captcha').val() == 'builtin'){
                $('.loginlockdown-captcha-loader').remove();

                var captcha_html = "";
                captcha_html += '<p><label for="wpcaptcha_captcha">Are you human? Please solve:';
                captcha_html += '<img class="loginlockdown-captcha-img" style="vertical-align: text-top;" src="' + loginlockdown_vars.captcha_admin_test + '" alt="Captcha" />';
                captcha_html += '<input class="input" type="text" size="3" name="captcha_response" id="captcha_response" />';
                captcha_html += '<input type="hidden" name="loginlockdown_captcha_token" id="loginlockdown_captcha_token" value="' + loginlockdown_vars.captcha_admin_test_token + '" />';
                captcha_html += "</label></p>";

                $('#loginlockdown_captcha_box').html(captcha_html);
                $('#loginlockdown_captcha_box').on('change keyup blur', '#captcha_response', function(){
                    captcha_response = $(this).val();
                });

                captcha_response_token = $("#loginlockdown_captcha_token").val();
            }
        },
        heightAuto: false,
        showCancelButton: true,
        focusConfirm: false,
        confirmButtonText: 'Verify Captcha',
        cancelButtonText: 'Cancel',
        width: 600,
      })
      .then((result) => {
        if (typeof result.value != "undefined") {
          block = block_ui('Verifying captcha');
          $.post({
            url: ajaxurl,
            data: {
              action: "loginlockdown_run_tool",
              _ajax_nonce: loginlockdown_vars.run_tool_nonce,
              tool: "verify_captcha",
              captcha_type: $('#captcha').val(),
              captcha_response: captcha_response,
              captcha_response_token: captcha_response_token,
            },
          })
            .always(function (response) {
              loginlockdown_swal.close();
            })
            .done(function (response) {
                if(response.success){
                    $('.captcha_verify_wrapper').hide();
                    $('#captcha_verified').val('1');
                    loginlockdown_swal.fire({
                        type: "success",
                        heightAuto: false,
                        title: 'Captcha has been verified successfully. Please don\'t forget to save changes.',
                    });
                } else {
                    loginlockdown_swal.fire({
                        type: "error",
                        heightAuto: false,
                        title: response.data,
                    });
                }
            })
            .fail(function (response) {
              loginlockdown_swal.fire({
                type: "error",
                heightAuto: false,
                title: loginlockdown_vars.undocumented_error,
              });
            });
        } // if confirmed
      });
  });


  $(".settings_page_loginlockdown").on("click", ".delete_failed_entry", function (e) {
    e.preventDefault();
    uid = $(this).data("failed-uid");
    button = $(this);

    loginlockdown_swal
      .fire({
        title: $(button).data("title"),
        type: "question",
        text: $(button).data("text"),
        heightAuto: false,
        showCancelButton: true,
        focusConfirm: false,
        confirmButtonText: $(button).data("btn-confirm"),
        cancelButtonText: loginlockdown_vars.cancel_button,
        width: 600,
      })
      .then((result) => {
        if (typeof result.value != "undefined") {
          block = block_ui($(button).data("msg-wait"));
          $.post({
            url: ajaxurl,
            data: {
              action: "loginlockdown_run_tool",
              _ajax_nonce: loginlockdown_vars.run_tool_nonce,
              tool: "delete_fail_log",
              fail_id: $(button).data("failed-id"),
            },
          })
            .always(function (response) {
              loginlockdown_swal.close();
            })
            .done(function (response) {
              if (response.success) {
                $("#loginlockdown-fails-log-table tr#" + response.data.id).remove();
                loginlockdown_swal.fire({
                  type: "success",
                  heightAuto: false,
                  title: $(button).data("msg-success"),
                });
              } else {
                loginlockdown_swal.fire({
                  type: "error",
                  heightAuto: false,
                  title: loginlockdown_vars.documented_error + " " + data.data,
                });
              }
            })
            .fail(function (response) {
              loginlockdown_swal.fire({
                type: "error",
                heightAuto: false,
                title: loginlockdown_vars.undocumented_error,
              });
            });
        } // if confirmed
      });
  });

  // display a message while an action is performed
  function block_ui(message) {
    tmp = loginlockdown_swal.fire({
      text: message,
      type: false,
      imageUrl: loginlockdown_vars.icon_url,
      onOpen: () => {},
      imageWidth: 58,
      imageHeight: 58,
      imageAlt: message,
      allowOutsideClick: false,
      allowEscapeKey: false,
      allowEnterKey: false,
      showConfirmButton: false,
      heightAuto: false,
    });

    return tmp;
  } // block_ui

  function getUrlParameter(sParam) {
    var sPageURL = window.location.search.substring(1),
      sURLVariables = sPageURL.split("&"),
      sParameterName,
      i;

    for (i = 0; i < sURLVariables.length; i++) {
      sParameterName = sURLVariables[i].split("=");

      if (sParameterName[0] === sParam) {
        return sParameterName[1] === undefined ? true : decodeURIComponent(sParameterName[1]);
      }
    }
  }

  table_locks_logs = $("#loginlockdown-locks-log-table").dataTable({
    bProcessing: true,
    bServerSide: true,
    bLengthChange: 1,
    bProcessing: true,
    bStateSave: 0,
    bAutoWidth: 0,
    columnDefs: [
      {
        targets: [0],
        className: "dt-body-left",
        orderable: true,
      },
      {
        targets: [1],
        className: "dt-body-left",
        orderable: true,
      },
      {
        targets: [2],
        className: "dt-body-left",
        orderable: true,
      },
      {
        targets: [3],
        className: "dt-body-center",
        orderable: true,
      },
      {
        targets: [4],
        className: "dt-body-center",
        orderable: true,
      },
      {
        targets: [5],
        className: "dt-body-center",
        orderable: false,
      },
      {
        targets: [6],
        className: "dt-body-right",
        orderable: false,
      },
    ],
    drawCallback: function () {
      $(".tooltip").tooltipster();
    },
    initComplete: function () {
      $(".tooltip").tooltipster();
    },
    language: {
      loadingRecords: "&nbsp;",
      processing: '<div class="loginlockdown-datatables-loader"><img width="64" src="' + loginlockdown_vars.icon_url + '" /></div>',
      emptyTable: "No Lockdowns exist yet",
      searchPlaceholder: "Type something to search ...",
      search: "",
    },
    order: [[0, "desc"]],
    iDisplayLength: 25,
    sPaginationType: "full_numbers",
    dom: '<"settings_page_loginlockdown_top"f>rt<"bottom"lp><"clear">',
    sAjaxSource: ajaxurl + "?action=loginlockdown_run_tool&tool=locks_logs&_ajax_nonce=" + loginlockdown_vars.run_tool_nonce,
  });

  table_activity_logs = $("#loginlockdown-fails-log-table").dataTable({
    bProcessing: true,
    bServerSide: true,
    bLengthChange: 1,
    bProcessing: true,
    bStateSave: 0,
    bAutoWidth: 0,
    columnDefs: [
      {
        targets: [0],
        className: "dt-body-left",
        orderable: true,
      },
      {
        targets: [2],
        className: "dt-body-center",
        orderable: true,
      },
      {
        targets: [3],
        className: "dt-body-center",
        orderable: true,
      },
      {
        targets: [4],
        className: "dt-body-center",
        orderable: true,
      },
      {
        targets: [5],
        className: "dt-body-center",
        orderable: false,
      },
      {
        targets: [6],
        className: "dt-body-right",
        orderable: false,
      }
    ],
    drawCallback: function () {
      $(".tooltip").tooltipster();
    },
    initComplete: function () {
      $(".tooltip").tooltipster();
    },
    language: {
      loadingRecords: "&nbsp;",
      processing: '<div class="loginlockdown-datatables-loader"><img width="64" src="' + loginlockdown_vars.icon_url + '" /></div>',
      emptyTable: "No failed attempts exist yet",
      searchPlaceholder: "Type something to search ...",
      search: "",
    },
    order: [[0, "desc"]],
    iDisplayLength: 25,
    sPaginationType: "full_numbers",
    dom: '<"settings_page_loginlockdown_top"f>rt<"bottom"lp><"clear">',
    sAjaxSource: ajaxurl + "?action=loginlockdown_run_tool&tool=activity_logs&_ajax_nonce=" + loginlockdown_vars.run_tool_nonce,
  });

  if ($("#captcha").val() != "disabled" && $("#captcha").val() != "builtin") {
    $(".captcha_keys_wrapper").show();
  } else {
    $(".captcha_keys_wrapper").hide();
  }

  $("#captcha").on("change", function () {
    if ($("#captcha").val() != "disabled" && $("#captcha").val() != "builtin") {
      $(".captcha_keys_wrapper").show();
    } else {
      $(".captcha_keys_wrapper").hide();
    }
  });

  if ($("#country_blocking_mode").val() != "none") {
    $(".country-blocking-wrapper").show();
    if ($("#country_blocking_mode").val() == "whitelist") {
      $(".country-blocking-label").html("Allowed Countries");
    } else {
      $(".country-blocking-label").html("Blocked Countries");
    }
  } else {
    $(".country-blocking-wrapper").hide();
  }

  $("#country_blocking_mode").on("change", function () {
    if ($("#country_blocking_mode").val() != "none") {
      $(".country-blocking-wrapper").show();
      if ($("#country_blocking_mode").val() == "whitelist") {
        $(".country-blocking-label").html("Allowed Countries");
      } else {
        $(".country-blocking-label").html("Blocked Countries");
      }
    } else {
      $(".country-blocking-wrapper").hide();
    }
  });

  Chart.defaults.global.defaultFontColor = "#23282d";
  Chart.defaults.global.defaultFontFamily = '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif';
  Chart.defaults.global.defaultFontSize = 12;
  var loginlockdown_fails_chart;
  var loginlockdown_locks_chart;

  function create_locks_chart() {
    if (!loginlockdown_vars.stats_locks || !loginlockdown_vars.stats_locks.days.length) {
      $("#loginlockdown-locks-chart").remove();
      return;
    } else {
      if (loginlockdown_locks_chart) {
        loginlockdown_locks_chart.destroy();
      }

      var chartlockscanvas = document.getElementById("loginlockdown-locks-chart").getContext("2d");
      var gradient = chartlockscanvas.createLinearGradient(0, 0, 0, 200);
      gradient.addColorStop(0, "#f9f9f9");
      gradient.addColorStop(1, "#ffffff");

      loginlockdown_locks_chart = new Chart(chartlockscanvas, {
        type: "line",

        data: {
          labels: loginlockdown_vars.stats_locks.days,
          datasets: [
            {
              label: "Locks",
              yAxisID: "yleft",
              xAxisID: "xdown",
              data: loginlockdown_vars.stats_locks.count,
              backgroundColor: gradient,
              borderColor: loginlockdown_vars.chart_colors[0],
              hoverBackgroundColor: loginlockdown_vars.chart_colors[0],
              borderWidth: 0,
            },
          ],
        },
        options: {
          animation: false,
          legend: false,
          maintainAspectRatio: false,
          tooltips: {
            mode: "index",
            intersect: false,
            callbacks: {
              title: function (value, values) {
                index = value[0].index;
                return moment(values.labels[index], "YYYY-MM-DD").format("dddd, MMMM Do");
              },
            },
            displayColors: false,
          },
          scales: {
            xAxes: [
              {
                display: false,
                id: "xdown",
                stacked: true,
                ticks: {
                  callback: function (value, index, values) {
                    return moment(value, "YYYY-MM-DD").format("MMM Do");
                  },
                },
                categoryPercentage: 0.85,
                time: {
                  unit: "day",
                  displayFormats: { day: "MMM Do" },
                  tooltipFormat: "dddd, MMMM Do",
                },
                gridLines: { display: false },
              },
            ],
            yAxes: [
              {
                display: false,
                id: "yleft",
                position: "left",
                type: "linear",
                scaleLabel: {
                  display: true,
                  labelString: "Hits",
                },
                gridLines: { display: false },
                stacked: false,
                ticks: {
                  beginAtZero: false,
                  maxTicksLimit: 12,
                  callback: function (value, index, values) {
                    return Math.round(value);
                  },
                },
              },
            ],
          },
        },
      });
    }
  }

  function create_fails_chart() {
    if (!loginlockdown_vars.stats_fails || !loginlockdown_vars.stats_fails.days.length) {
      $("#loginlockdown-fails-chart").remove();
      return;
    } else {
      if (loginlockdown_fails_chart) loginlockdown_fails_chart.destroy();

      var chartfailscanvas = document.getElementById("loginlockdown-fails-chart").getContext("2d");
      var gradient = chartfailscanvas.createLinearGradient(0, 0, 0, 200);
      gradient.addColorStop(0, "#f9f9f9");
      gradient.addColorStop(1, "#ffffff");

      loginlockdown_fails_chart = new Chart(chartfailscanvas, {
        type: "line",
        data: {
          labels: loginlockdown_vars.stats_fails.days,
          datasets: [
            {
              label: "Fails",
              yAxisID: "yleft",
              xAxisID: "xdown",
              data: loginlockdown_vars.stats_fails.count,
              backgroundColor: gradient,
              borderColor: loginlockdown_vars.chart_colors[0],
              hoverBackgroundColor: loginlockdown_vars.chart_colors[0],
              borderWidth: 0,
            },
          ],
        },
        options: {
          animation: false,
          legend: false,
          maintainAspectRatio: false,
          tooltips: {
            mode: "index",
            intersect: false,
            callbacks: {
              title: function (value, values) {
                index = value[0].index;
                return moment(values.labels[index], "YYYY-MM-DD").format("dddd, MMMM Do");
              },
            },
            displayColors: false,
          },

          scales: {
            xAxes: [
              {
                display: false,
                id: "xdown",
                stacked: true,
                ticks: {
                  callback: function (value, index, values) {
                    return moment(value, "YYYY-MM-DD").format("MMM Do");
                  },
                },
                categoryPercentage: 0.85,
                time: {
                  unit: "day",
                  displayFormats: { day: "MMM Do" },
                  tooltipFormat: "dddd, MMMM Do",
                },
                gridLines: { display: false },
              },
            ],
            yAxes: [
              {
                display: false,
                id: "yleft",
                position: "left",
                type: "linear",
                scaleLabel: {
                  display: true,
                  labelString: "Hits",
                },
                gridLines: { display: false },
                stacked: false,
                ticks: {
                  beginAtZero: false,
                  maxTicksLimit: 12,
                  callback: function (value, index, values) {
                    return Math.round(value);
                  },
                },
              },
            ],
          },
        },
      });
    }
  }


  if ($(".loginlockdown-chart-locks").length && window.localStorage.getItem("loginlockdown_locks_chart") == "enabled") {
    $(".loginlockdown-chart-locks").show();
  }

  if ($(".loginlockdown-chart-fails").length && window.localStorage.getItem("loginlockdown_fails_chart") == "enabled") {
    $(".loginlockdown-chart-fails").show();
    create_fails_chart();
  }

  if (window.localStorage.getItem("loginlockdown_fails_stats") == "enabled") {
    $(".loginlockdown-stats-fails").show();
  }

  if ($(".loginlockdown-chart-locks").length && window.localStorage.getItem("loginlockdown_locks_chart") == "enabled") {
    $(".loginlockdown-chart-locks").show();
    create_locks_chart();
  }

  if (window.localStorage.getItem("loginlockdown_locks_stats") == "enabled") {
    $(".loginlockdown-stats-locks").show();
  }

  $("#loginlockdown_tabs").on("tabsactivate", function (event, ui) {
    if (window.localStorage.getItem("loginlockdown_locks_chart") == "enabled") {
      create_locks_chart();
    }

    if (window.localStorage.getItem("loginlockdown_fails_chart") == "enabled") {
      create_fails_chart();
    }
  });

  if (window.localStorage.getItem("loginlockdown_locks_chart") == null) {
    window.localStorage.setItem("loginlockdown_locks_chart", "enabled");
  }

  if (window.localStorage.getItem("loginlockdown_fails_chart") == null) {
    window.localStorage.setItem("loginlockdown_fails_chart", "enabled");
  }

  if (window.localStorage.getItem("loginlockdown_locks_stats") == null) {
    window.localStorage.setItem("loginlockdown_locks_stats", "enabled");
  }

  if (window.localStorage.getItem("loginlockdown_fails_stats") == null) {
    window.localStorage.setItem("loginlockdown_fails_stats", "enabled");
  }

  $("#lockdown_run_tests").on("click", function (e) {
    e.preventDefault();
  });

  $("#lockdown_send_email").on("click", function (e) {
    e.preventDefault();
    $(this).blur();

    loginlockdown_swal.fire({
      title: "Sending test email",
      text: " ",
      type: false,
      allowOutsideClick: false,
      allowEscapeKey: false,
      allowEnterKey: false,
      showConfirmButton: false,
      imageUrl: loginlockdown_vars.icon_url,
      onOpen: () => {
        $(loginlockdown_swal.getImage()).addClass("loginlockdown_rotating");
      },
      imageWidth: 58,
      imageHeight: 58,
      imageAlt: "Sending test email",
    });

    $.ajax({
      url: ajaxurl,
      data: {
        action: "loginlockdown_run_tool",
        _ajax_nonce: loginlockdown_vars.run_tool_nonce,
        tool: "email_test",
      },
    })
      .done(function (data) {
        if (data.success) {
          loginlockdown_swal.fire({
            title: data.data.title,
            html: data.data.text,
            type: data.data.sent ? "success" : "error",
            showConfirmButton: true,
          });
        } else {
          loginlockdown_swal.fire({
            type: "error",
            title: loginlockdown_vars.undocumented_error,
          });
        }
      })
      .fail(function (data) {
        loginlockdown_swal.fire({
          type: "error",
          title: loginlockdown_vars.undocumented_error,
        });
      });
  });

  $("#lockdown_recovery_url_show").on("click", function (e) {
    e.preventDefault();
    $(this).blur();

    loginlockdown_swal.fire({
      title: "Recovery URL",
      html: "<strong id='lockdown_recovery_url'></strong><br /><br /><button class='button button-primary' id='lockdown_recovery_url_reset'>Reset Recovery URL</button>",
      type: false,
      allowOutsideClick: true,
      allowEscapeKey: true,
      allowEnterKey: true,
      showConfirmButton: true,
    });

    get_recovery_url(false);
  });

  $(".settings_page_loginlockdown").on("click", "#lockdown_recovery_url_reset", function (e){
    $(this).blur();
    $("#lockdown_recovery_url").html('<img src="' + loginlockdown_vars.icon_url + '" />');
    get_recovery_url(true);
  });

  function get_recovery_url(reset){
    $.post({
        url: ajaxurl,
        data: {
          action: "loginlockdown_run_tool",
          _ajax_nonce: loginlockdown_vars.run_tool_nonce,
          tool: "recovery_url",
          reset: reset,
        },
      })
        .done(function (data) {
          $("#lockdown_recovery_url").html(data.data.url);
        })
        .fail(function (data) {
          loginlockdown_swal.fire({
            type: "error",
            title: loginlockdown_vars.undocumented_error,
          });
      });
  }

  // pro dialog
  $('a.nav-tab-pro').on('click', function (e) {
    e.preventDefault();

    open_upsell('tab');

    return false;
  });

  $('#wpwrap').on('change', 'select', function(e) {
    option_class = $('#' + $(this).attr('id') + ' :selected').attr('class');
    if(option_class == 'pro-option'){
        option_text = $('#' + $(this).attr('id') + ' :selected').text();
        $(this).val('disabled');
        $(this).trigger('change');
        open_upsell($(this).attr('id'));
        $('.show_if_' + $(this).attr('id')).hide();
    }
  });

  $('#wpwrap').on('click', '.open-upsell', function(e) {
    e.preventDefault();
    feature = $(this).data('feature');
    $(this).blur();
    open_upsell(feature);

    return false;
  });

  $('#wpwrap').on('click', '.open-pro-dialog', function (e) {
    e.preventDefault();
    $(this).blur();

    pro_feature = $(this).data('pro-feature');
    if (!pro_feature) {
      pro_feature = $(this).parent('label').attr('for');
    }
    open_upsell(pro_feature);

    return false;
  });

  $('#loginlockdown-pro-dialog').dialog({
    dialogClass: 'wp-dialog loginlockdown-pro-dialog',
    modal: true,
    resizable: false,
    width: 850,
    height: 'auto',
    show: 'fade',
    hide: 'fade',
    close: function (event, ui) {},
    open: function (event, ui) {
      $(this).siblings().find('span.ui-dialog-title').html('Login Lockdown PRO is here!');
      loginlockdown_fix_dialog_close(event, ui);
    },
    autoOpen: false,
    closeOnEscape: true,
  });

  function clean_feature(feature) {
    feature = feature || 'free-plugin-unknown';
    feature = feature.toLowerCase();
    feature = feature.replace(' ', '-');

    return feature;
  }

  function open_upsell(feature) {
    feature = clean_feature(feature);

    $('#loginlockdown-pro-dialog').dialog('open');

    $('#loginlockdown-pro-table .button-buy').each(function (ind, el) {
      tmp = $(el).data('href-org');
      tmp = tmp.replace('pricing-table', feature);
      $(el).attr('href', tmp);
    });
  } // open_upsell

  if (window.localStorage.getItem('loginlockdown_upsell_shown') != 'true') {
    open_upsell('welcome');

    window.localStorage.setItem('loginlockdown_upsell_shown', 'true');
    window.localStorage.setItem('loginlockdown_upsell_shown_timestamp', new Date().getTime());
  }

  if (window.location.hash == '#open-pro-dialog') {
    open_upsell('url-hash');
    window.location.hash = '';
  }

  $('.install-wp301').on('click',function(e){
    e.preventDefault();

    if (!confirm('The free WP 301 Redirects plugin will be installed & activated from the official WordPress repository.')) {
      return false;
    }

    jQuery('body').append('<div style="width:550px;height:450px; position:fixed;top:10%;left:50%;margin-left:-275px; color:#444; background-color: #fbfbfb;border:1px solid #DDD; border-radius:4px;box-shadow: 0px 0px 0px 4000px rgba(0, 0, 0, 0.85);z-index: 9999999;"><iframe src="' + loginlockdown_vars.wp301_install_url + '" style="width:100%;height:100%;border:none;" /></div>');
    jQuery('#wpwrap').css('pointer-events', 'none');

    e.preventDefault();
    return false;
  });

  function loginlockdown_fix_dialog_close(event, ui) {
    jQuery('.ui-widget-overlay').bind('click', function () {
      jQuery('#' + event.target.id).dialog('close');
    });
  } // loginlockdown_fix_dialog_close
});
