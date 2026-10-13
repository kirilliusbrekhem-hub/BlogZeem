/* Loads the text parts in order before the app scripts run. */
['1a','1b','2','3','4','5','6','7','8'].forEach(function (s) { document.write('<script src="i18n-' + s + '.js"><\/script>'); });
