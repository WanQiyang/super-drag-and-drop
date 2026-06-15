const messageHandlers = {
    open_link: (message) => chrome.tabs.create({ url: message.url }),
    search_text: (message) => chrome.search.query({
        text: message.query,
        disposition: "NEW_TAB"
    })
};

chrome.runtime.onMessage.addListener((message) => {
    messageHandlers[message.action]?.(message);
});
