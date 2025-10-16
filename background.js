chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "open_link") {
    chrome.tabs.create({ url: message.url });
  } else if (message.action === "search_text") {
    chrome.search.query({
      text: message.query,
      disposition: "NEW_TAB"
    });
  }
});
