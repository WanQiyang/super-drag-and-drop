(function () {
    const DRAG_THRESHOLD = 10;
    let startX = 0, startY = 0;
    let dragging = false;
    let candidateUrl = null;
    let candidateText = null;
    let canceled = false;
    let useNative = false;
    let customCursorApplied = false;

    function getTargetUrl(target) {
        const anchor = target?.closest?.('a');
        return (anchor && anchor.href) ? anchor.href : null;
    }

    function isCursorInSelection(target) {
        const selection = window.getSelection();
        if (selection.rangeCount === 0) return false;
        const mouseX = target.clientX;
        const mouseY = target.clientY;
        for (let i = 0; i < selection.rangeCount; i++) {
            const range = selection.getRangeAt(i);
            const rect = range.getBoundingClientRect();
            if (mouseX >= rect.left - 10 && mouseX <= rect.right + 10 && mouseY >= rect.top - 10 && mouseY <= rect.bottom + 10) {
                return true;
            }
        }
        return false;
    }

    function getValidUrl(text) {
        const target = text.trim();
        if (!target || /\s/.test(target)) return null;

        const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
        const FILE_TLDS = new Set([
            'css', 'csv', 'doc', 'docx', 'exe', 'gif', 'htm', 'html', 'jpeg', 'jpg',
            'js', 'json', 'md', 'pdf', 'png', 'rar', 'ts', 'txt', 'xml', 'zip'
        ]);
        const HOSTNAME = '(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.)+[a-z]{2,63}';
        const SUFFIX = '(?::\\d{1,5})?(?:\\/[^\\s#?]*)?(?:\\?[^\\s#]*)?(?:#[^\\s]*)?';
        const IPV4 = '(?:(?:25[0-5]|2[0-4]\\d|1\\d{2}|[1-9]?\\d)\\.){3}(?:25[0-5]|2[0-4]\\d|1\\d{2}|[1-9]?\\d)';

        let toParse = null;
        if (/^https?:\/\//i.test(target)) {
            toParse = target;
        } else if (new RegExp(`^${HOSTNAME}${SUFFIX}$`, 'i').test(target)) {
            toParse = 'https://' + target;
        } else if (new RegExp(`^${IPV4}${SUFFIX}$`).test(target)) {
            toParse = 'https://' + target;
        } else if (new RegExp(`^localhost${SUFFIX}$`, 'i').test(target)) {
            toParse = 'https://' + target;
        } else {
            return null;
        }

        try {
            const url = new URL(toParse);
            if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

            const host = url.hostname;
            if (!host) return null;

            if (host === 'localhost') return url.href;

            if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(host)) {
                return host.split('.').every((octet) => {
                    const n = Number(octet);
                    return n >= 0 && n <= 255;
                }) ? url.href : null;
            }

            const labels = host.split('.');
            const tld = labels[labels.length - 1];
            if (!/^[a-z]{2,63}$/i.test(tld)) return null;
            if (labels.length === 2 && FILE_TLDS.has(tld.toLowerCase())) return null;
            if (!labels.every((label) => LABEL.test(label))) return null;

            return url.href;
        } catch (e) {
            return null;
        }
    }

    const linkSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24">
        <circle cx="12" cy="12" r="8" fill="rgba(0,200,100,0.9)" />
        <path d="M12 8v8M8 12h8" stroke="white" stroke-width="2" stroke-linecap="round"/>
    </svg>`;
    const linkIconUrl = `url("data:image/svg+xml;base64,${btoa(linkSvg)}") 12 12, auto`;

    const searchSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
        <circle cx="10" cy="10" r="7" fill="rgba(128, 224, 255, 0.9)" stroke="black" stroke-width="2"/>
        <path d="M15.8 15.8L20 20" stroke="black" stroke-width="2" stroke-linecap="round"/>
    </svg>`;
    const searchIconUrl = `url("data:image/svg+xml;base64,${btoa(searchSvg)}") 10 10, auto`;

    function setCustomCursor(iconType) {
        if (!customCursorApplied) {
            if (iconType === 'search') {
                document.body.style.cursor = searchIconUrl;
            } else if (iconType === 'link') {
                document.body.style.cursor = linkIconUrl;
            }
            customCursorApplied = true;
        }
    }

    function resetCursor() {
        if (customCursorApplied) {
            document.body.style.cursor = '';
            customCursorApplied = false;
        }
    }

    function cancelDragging() {
        canceled = true;
        cleanup();
    }

    function onKeyDown(e) {
        if (e.key === 'Escape' && dragging) {
            cancelDragging();
            e.preventDefault();
        }
    }

    function onMouseDown(e) {
        if (e.button === 2 && dragging) {
            cancelDragging();
            e.preventDefault();
            return;
        }
        if (e.button !== 0) return;
        candidateUrl = getTargetUrl(e.target);
        candidateText = window.getSelection()?.toString().trim();
        if (!candidateUrl && (!candidateText || !isCursorInSelection(e))) return;
        useNative = e.altKey;
        if (useNative) return;
        if (candidateUrl) {
            candidateText = null;
        } else if (candidateText) {
            const verifiedUrl = getValidUrl(candidateText);
            if (verifiedUrl) {
                candidateUrl = verifiedUrl;
                candidateText = null;
            }
        }
        startX = e.clientX;
        startY = e.clientY;
        dragging = false;
        canceled = false;
        e.preventDefault();
        document.addEventListener('mousemove', onMouseMove, true);
        document.addEventListener('mouseup', onMouseUp, true);
        document.addEventListener('keydown', onKeyDown, true);
    }

    function onMouseMove(e) {
        if (canceled || !candidateUrl && !candidateText) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        if (!dragging && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
            dragging = true;
            if (candidateText) {
                setCustomCursor('search');
            } else if (candidateUrl) {
                setCustomCursor('link');
            }
        }
    }

    function onMouseUp(e) {
        if (e.button !== 0) return;
        if (candidateText && !dragging) {
            window.getSelection()?.removeAllRanges();
        }
        if (dragging && !canceled) {
            if (candidateText) {
                chrome.runtime.sendMessage({ action: "search_text", query: candidateText });
            } else if (candidateUrl) {
                chrome.runtime.sendMessage({ action: "open_link", url: candidateUrl });
            }
        }
        cleanup();
    }

    function cleanup() {
        document.removeEventListener('mousemove', onMouseMove, true);
        document.removeEventListener('mouseup', onMouseUp, true);
        document.removeEventListener('keydown', onKeyDown, true);
        resetCursor();
        dragging = false;
        candidateUrl = null;
        candidateText = null;
        useNative = false;
    }

    document.addEventListener('mousedown', onMouseDown, true);
})();
