(function () {
    const DRAG_THRESHOLD = 10;
    let startX = 0, startY = 0;
    let dragging = false;
    let candidateUrl = null;
    let candidateText = null;
    let canceled = false;
    let useNative = false;
    let customCursorApplied = false;

    function findAnchor(el) {
        while (el && el !== document.documentElement) {
            if (el.tagName === 'A' && el.href) return el.href;
            el = el.parentElement;
        }
        return null;
    }

    function getTargetUrl(target) {
        const link = findAnchor(target);
        if (link) return link;
        return null;
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
