// Listen for messages from the side panel
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_PAGE_CONTENT') {
    try {
      // Use Readability to parse the document
      const documentClone = document.cloneNode(true);
      const article = new Readability(documentClone).parse();

      if (article && article.textContent) {
        // Return structured metadata
        sendResponse({
          metadata: {
            url: window.location.href,
            domain: window.location.hostname,
            pageTitle: document.title,
            mainContent: article.textContent
          }
        });
      } else {
        // Fallback if no article is detected
        console.warn('Readability failed to find an article. Returning metadata with empty content.');
        sendResponse({
          metadata: {
            url: window.location.href,
            domain: window.location.hostname,
            pageTitle: document.title,
            mainContent: "No primary content detected."
          }
        });
      }
    } catch (error) {
      console.error('Error parsing content with Readability:', error);
      sendResponse({ content: "Error extracting content." });
    }
  }
});
