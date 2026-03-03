export const convertLinksToAnchor = (text, item) => {
    if (item.sensitive) {
        return "**********************";
    }

    // Replace newlines and tabs with HTML equivalents so they survive dangerouslySetInnerHTML
    const withWhitespace = text
        .replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;')
        .replace(/\n/g, '<br>');

    const urlRegex = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/g;
    return withWhitespace.replace(urlRegex, (url) => {
        let hyperlink = url.startsWith("www.") ? `https://${url}` : url;
        return `<a href="${hyperlink}" target="_blank" rel="noopener noreferrer" class="text-blue-500 underline">${url}</a>`;
    });
};

// Plain text preview (no HTML, newlines → space) used for collapsed truncated snippets
export const plainTextPreview = (text, maxLen = 160) => {
    if (!text) return '';
    const flat = text.replace(/\n/g, ' ').replace(/\t/g, ' ').replace(/\s+/g, ' ').trim();
    return flat.length > maxLen ? flat.substring(0, maxLen) + '...' : flat;
};