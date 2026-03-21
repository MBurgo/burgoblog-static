/**
 * Login Lockdown
 * https://wploginlockdown.com/
 * (c) WebFactory Ltd, 2022 - 2024, www.webfactoryltd.com
 */

// global object for all Login Lockdown functions

jQuery(document).ready(function ($) {
  if (typeof loginlockdown_pointers != "undefined") {
    $.each(loginlockdown_pointers, function (index, pointer) {
      if (index.charAt(0) == "_") {
        return true;
      }
      $(pointer.target)
        .pointer({
          content: "<h3>Login Lockdown</h3><p>" + pointer.content + "</p>",
          pointerWidth: 380,
          position: {
            edge: pointer.edge,
            align: pointer.align,
          },
          close: function () {
            $.get(ajaxurl, {
              action: "loginlockdown_run_tool",
              _ajax_nonce: loginlockdown_pointers.run_tool_nonce,
              tool: "loginlockdown_dismiss_pointer",
            });
          },
        })
        .pointer("open");
    });
  }
}); // on ready
