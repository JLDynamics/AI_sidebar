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
            mainContent: article.textContent.substring(0, 40000) // Limit size
          }
        });
      } else {
        // Fallback: Get raw body text (useful for SPAs, Dashboards, etc.)
        const rawText = document.body.innerText.replace(/\s+/g, ' ').trim().substring(0, 20000);
        console.log('Readability failed, using raw text fallback.');

        sendResponse({
          metadata: {
            url: window.location.href,
            domain: window.location.hostname,
            pageTitle: document.title,
            mainContent: rawText || "No readable content found."
          }
        });
      }
    } catch (error) {
      console.error('Error parsing content with Readability:', error);
      sendResponse({ content: "Error extracting content." });
    }
  }
});
