chrome.runtime.onMessage.addListener(
  function (message) {
    if (message.url) {
      const cmptUrl = new URL(message.url);

      chrome.tabs.create({ url: cmptUrl.href });
    }
  }
);

chrome.browserAction.onClicked.addListener(function(tab) {
  chrome.tabs.executeScript(tab.id, {
    file: 'isClayPage.js',
  }, (result) => {
    if (result.pop()) {
      chrome.tabs.executeScript(tab.id, { file: 'highlight.js' });
    } else {
      chrome.browserAction.setPopup({ tabId: tab.id, popup: 'no-slip.html' });
    }
  });
});
