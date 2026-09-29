class Globals {
    static debug = false;

    static currentContextMenu = null;
    static currentContextMenuEvent = null;
    static currentRightClickTarget = null;
    static currentContentID = null;
    static currentFrameUrl = null;
    static currentTabID = null;
    static currentEvent = null;
    static currentEventTarget = null;
    static previousEventTarget = null;
    static currentHoverTarget = null;

    static lastChangeEvent;
    static tabOrEnterPressed;
    static keypressEvent;
    // Last focus-moving keypress. focusin also fires on window refocus and dialog close; only a preceding
    // keypress marks a real tab to an element.
    static focusKeyAt = 0;
    static FOCUS_KEY_WINDOW_MS = 400;

    // scroll positions before the input, so the scroll is measured in pixels (a wheel notch varies)
    static scrollBaseline = new Map();

    static seedScrollBaseline(node) {
        if (node instanceof Element)
            Globals.scrollBaseline.set(node, { top: node.scrollTop, left: node.scrollLeft });
    }
    static responseTracker = {};
    static lastWorkflowStep;
    // Image and geometry grabbed at pointerdown, before the click can remove or navigate away from the element.
    // { rect, target, at, imageData }
    static preClickCapture = null;
    // Date.now() when lastWorkflowStep was recorded. The step's own timestamp is a formatted string good only
    // to the second, which cannot separate a double-delivered event from a fast second click.
    static lastWorkflowStepAt = 0;
    static ignoreNextGoto;
    // count of modifiers pressed
    static modifierKeysPressed = 0;
    static ancestorActions;
    static currentUrl;
    static nonce;
    static simplifiedXPath;

    static dragAndDropInProgress = false;
    static draggedElement = null;
    static dragAndDropStartRecorded = false;
    static startX = 0;
    static startY = 0;
    static ignoreClickEvent = false;
    static ignoreNextFocusInEvent = false;
    static contextMenu = {};
    static contextMenuOpen = false;

    static selectedText = '';
    static weAreSaving = false;
    static hoverTime = null;

    static prevDOM = { InIframe: null, InShadow: null };

    // global object to record if a modifier key was pressed
    static modifierKeys = {
        Alt: false,
        Control: false,
        Shift: false,
        Meta: false,
    }

    static sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    static copySelectorOrPartToClipboard(event, propertyName) {
        // restore selectorsets after copy
        let selector = new SelectorSet(event.target, persistence.indices, false);
        if (!selector.selectorName) {
            const prefix = (event.target.id?.replaceAll('-', '') || event.target.tagName?.replaceAll('-', '').toLowerCase()) || 'element';
            selector.selectorName = prefix + 'Selector';
        }

        if ("imageData" === propertyName)
            try {
                // Send a message to the background script to take a screenshot
                let serialized = SelectorSet.serialize(selector);
                Messaging.sendMessageToBackground({ message: REQUEST.TAKE_SCREENSHOT2, data: serialized });
            } catch (error) {
                if (true == error.toString().includes('extension context invalidated'))
                    LogMessage(LOG_TYPE.WARN, `Ottomatic reloaded?<br> ${toastStrong('PLEASE REFRESH PAGE')}`);
                else
                    LogMessage(LOG_TYPE.CRITICAL, 'Error saving workflow step.', error);
                persistence.isRecording = false;
            }
        else if (propertyName) {
            let value = selector[propertyName];
            let stringified = JSON.stringify(value, null, 2);
            stringified = Globals.removeQuotesIfExist(stringified);

            if (0 === Globals.currentContentID)
                Globals.copyToClipboard(stringified);
            else
                Messaging.sendMessageToBackground({ message: REQUEST.COPY_TO_CLIPBOARD, data: stringified });
        } else {
            let stringified = JSON.stringify(selector, null, 2);
            stringified = Globals.removeQuotesIfExist(stringified);

            if (0 === Globals.currentContentID)
                Globals.copyToClipboard(stringified);
            else
                Messaging.sendMessageToBackground({ message: REQUEST.COPY_TO_CLIPBOARD, data: stringified });
        }
    }

    static removeQuotesIfExist(inputString) {
        // Check if the input string has at least two characters and starts and ends with double quotes
        if (inputString)
            if (inputString.length >= 2
                && (
                    (inputString.startsWith('"') && inputString.endsWith('"'))
                    || (inputString.startsWith("'") && inputString.endsWith("'"))
                )) {
                // Remove the first and last character (i.e., the double quotes)
                return inputString.slice(1, -1);
            }

        // If there are no double quotes at the beginning and end, return the original string
        return inputString;
    }
    // don't think we want this...
    static removeCurlyBracesIfExist(inputString) {
        // Check if the input string has at least two characters and starts and ends with double quotes
        if (inputString)
            if (inputString.length >= 2 && (inputString.startsWith('{') && inputString.endsWith('}'))) {
                // Remove the first and last character (i.e., the double quotes)
                return inputString.slice(1, -1);
            }

        // If there are no double quotes at the beginning and end, return the original string
        return inputString;
    }
    static copyObjectClassToClipboard(objectToCopy, objectName, propertyName) {

        // Convert the object class to a string representation (JSON)
        var objClassString;
        var jsonString;
        if (!propertyName)
            jsonString = JSON.stringify(objectToCopy, null, 2);
        else
            jsonString = JSON.stringify(objectToCopy[propertyName], null, 2);

        objClassString = `${objectName ? 'var ' + objectName + ' = ' : ''}${objectName ? jsonString : this.removeQuotesIfExist(jsonString)}`;
        // the popup writes directly: an unfocused content tab can't write the clipboard
        if (Globals.currentContentID === 'popup')
            Globals.copyToClipboard(objClassString, objectName);
        else
            Messaging.sendMessageToBackground({ message: REQUEST.COPY_TO_CLIPBOARD, data: objClassString, label: objectName });
    }

    static copyGPALSelectorToClipboard(selectorSet, selectorName) {
        const selectorTypes = [
            {
                name: "withCSS",
                value: selectorSet.css,
                func: "WithCSS",
            },
            {
                name: "withXPath",
                value: selectorSet.xPaths,
                func: "WithXPath",
            },
            // now added to the xPaths array
            //{
            //    name: "withFullXPath",
            //    value: selectorSet.fullXPath,
            //    func: "WithXPath",
            //    comment: "full xpath"
            //},
            //{   // this is a generic selector that will retrieve elements like the specific selectors above
            //    name: "withSimplifiedXPath",
            //    value: selectorSet.simplifiedXPath,
            //    func: "WithXPath",
            //    comment: "generic xpath, matches all similar elements, use .WithAllThatMatch(number) to limit"
            //},
            {
                name: "withText",
                value: selectorSet.text,
                func: "WithText",
            },
            {
                name: "matchText",
                value: selectorSet.text,
                func: "MatchText",
            },
            {
                name: "withValue",
                value: selectorSet.value,
                func: "WithValue",
            },
            {
                name: "matchValue",
                value: selectorSet.value,
                func: "MatchValue",
            },
            {
                name: "matchHref",
                value: selectorSet.href,
                func: "MatchHRef",
            },
            {
                name: "matchSrc",
                value: selectorSet.src,
                func: "MatchSrc",
            },
            {
                name: "matchPlaceholder",
                value: selectorSet.placeholder,
                func: "MatchPlaceholder",
            },
            {
                name: "withOffsetX",
                value:
                    selectorSet.offsetX,
                func: "WithOffsetX",
            },
            {
                name: "withOffsetY",
                value:
                    selectorSet.offsetY,
                func: "WithOffsetY",
            },
            {
                name: "withImage",
                value:
                    selectorSet.selectorName + 'File',    // now a GPALFile variable name
                func: "WithImage",
            },
            {
                name: "withDeltaX",
                value:
                    selectorSet.deltaX,
                func: "WithDeltaX",
            },
            {
                name: "withDeltaY",
                value:
                    selectorSet.deltaY,
                func: "WithDeltaY",
            },
        ];
        //// get html formatted code and strip
        let resultStrings = `public static Selector ${selectorName} = (Selector)GPAL.Selector\n` + selectorTypes.map((selectorType) =>
            getSelectorOutput(selectorType, persistence.settings)
        ).join('');

        resultStrings = Globals.cleanGPALSelector(resultStrings) + ';';

        // popup writes directly: it has focus and clipboard access
        if (Globals.currentContentID === 'popup')
            Globals.copyToClipboard(resultStrings, selectorName);
        else {
            Messaging.sendMessageToBackground({ message: REQUEST.COPY_TO_CLIPBOARD, data: resultStrings });
            LogMessage(LOG_TYPE.NOTICE, `GPAL Selector ${toastStrong(selectorName)}\nCopied to clipboard`);
        }
    }

    static cleanGPALSelector(htmlOrMessyString) {

        return htmlOrMessyString
            .replace(/<br\s*\/?>/gi, '\n')  // each selector line ends with <br/>
            .replace(/<\/?[^>]+>/g, '')     // strip all HTML
            .replace(/[ \t]+/g, ' ')        // collapse spaces/tabs, but keep newlines
            .split('\n')
            .map(line => line.trim())       // trim each line
            .filter(line => line.length)    // drop blank lines
            .join('\n')
            .trim();
    }

    static async copyToClipboard(text, label) {
        try {
            if (true /*await checkClipboardPermissionSync()*/) {
                navigator.clipboard.writeText(text)
                    .then(() => {
                        const displayName = label || (text.startsWith('var ') ? text.slice(4, text.indexOf(' =')) : text.substring(0, 20));
                        LogMessage(LOG_TYPE.NOTICE, `Selector [${displayName}]\nCopied to clipboard`);
                    })
                    .catch(err => {
                        const textarea = document.createElement('textarea');
                        textarea.value = text;
                        document.body.appendChild(textarea);

                        // Select the contents of the textarea
                        textarea.select();
                        // Copy the selected text to the clipboard
                        document.execCommand('copy');

                        // Remove the temporary textarea
                        document.body.removeChild(textarea);
                    });
            } else {
                LogMessage(LOG_TYPE.NOTICE, 'Clipboard access is not allowed on this page or has not been granted.');
            }
        } catch (error) {
            LogMessage(LOG_TYPE.NOTICE, `UNABLE to copy Selector [${text.substring(2, 20)} ...]\n[${error}]`);
            void BROWSER.runtime.lastError;
        }
    }

    // needs to run in background or somewhere else... 
    // throws an exception
    static async checkClipboardPermissionSync() {
        return new Promise((resolve, reject) => {
            BROWSER.permissions.getAll(permissions => {
                if (BROWSER.runtime.lastError) {
                    // Handle error
                    console.error('Error querying clipboard permissions:', BROWSER.runtime.lastError);
                    reject(BROWSER.runtime.lastError);
                } else {
                    // Check if the extension has the "clipboardRead" permission.
                    const hasClipboardReadPermission = permissions.permissions.includes("clipboardRead");

                    // Check if the extension has the "clipboardWrite" permission.
                    const hasClipboardWritePermission = permissions.permissions.includes("clipboardWrite");

                    resolve(hasClipboardReadPermission && hasClipboardWritePermission);
                }
            });
        });
    }

    static generateNonce(length) {
        var text = "";
        var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        for (var i = 0; i < length; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }

    // take our bse64 encoded audio string
    // convert it to a byte array, convert to a blob, then create a 'local' url to access the audio blob, akin to embedding it on the webpage
    // however, some CSP disallow any audio at all and this will still not play - 
    static beep() {
        let recordedSound = RECORDED_SOUND[persistence.settings.recordedSound];
        if ('none' == recordedSound.key)
            return;

        // background never plays: Firefox's event page has Audio but would play into a hidden page
        if (typeof contentId !== 'undefined') {
            Messaging.messageATab(Globals.currentTabID, 0, { message: REQUEST.PLAY_AUDIO, base64: recordedSound.value });
            return;
        }

        try {
            const audio = new Audio(`${recordedSound.value}`);
            audio.play();
        } catch {
            Messaging.messageATab(Globals.currentTabID, 0, { message: REQUEST.PLAY_AUDIO, base64: recordedSound.value });
        } // background has no audio
    }

    static isElementClickable(element) {
        if (!element) {
            return false;
        }

        // Disabled checks
        if (element.disabled || element.ariaDisabled === 'true') {
            return false;
        }

        let computedStyle;
        try {
            computedStyle = window.getComputedStyle(element);
        } catch (error) {
            //return false;
        }

        if (Globals.isDraggable(element)) {
            return true;
        }

        let pointerEvents = computedStyle?.getPropertyValue('pointer-events');

        if (pointerEvents === 'none') {
            return false;
        }

        if (pointerEvents === 'inherit') {
            let el = element.parentElement;   // use parentElement (skips non-Element nodes)
            while (el) {
                try {
                    computedStyle = window.getComputedStyle(el);
                    pointerEvents = computedStyle.getPropertyValue('pointer-events');
                    if (pointerEvents === 'none') return false;
                    if (pointerEvents !== 'inherit') break;
                } catch (e) {
                    return false;
                }
                el = el.parentElement;
            }
        }

        // Cursor check
        let cursorValue = 'pointer';
        try {
            cursorValue = computedStyle.getPropertyValue('cursor');
        } catch { }

        const clickableCursors = new Set([
            'pointer', 'hand', 'grab', 'crosshair', 'move', 'text',
            'row-resize', 'col-resize', 'all-scroll', 'alias', 'copy',
            'e-resize', 'n-resize', 'ne-resize', 'nw-resize',
            's-resize', 'se-resize', 'sw-resize', 'w-resize'
        ]);

        if (clickableCursors.has(cursorValue)) {
            return true;
        }

        // contentEditable handling (simplified)
        if (element.isContentEditable === true) {
            return true;
        }
        if (element.contentEditable === 'inherit') {
            let el = element;
            while (el && el.contentEditable === 'inherit') {
                el = el.parentElement;
            }
            if (el && el.isContentEditable) return true;
        }

        if (element.tagName.toLowerCase() === 'label') {
            // association using 'for'
            const associatedElement = document.getElementById(element.getAttribute('for'));
            if (true == Globals.isElementClickable(associatedElement))
                return true;

            // association by wrapping the input with a label
            const nestedInputs = element.querySelectorAll('input');
            if (nestedInputs.length > 0) {
                return true;
            }
        }

        // Tag-based quick wins
        const tag = element.tagName.toLowerCase();
        if (['button', 'input', 'a', 'select', 'textarea', 'video', 'option'].includes(tag)) {
            return true;
        }

        try {
            // Event / attribute checks
            if (element.hasAttribute('onclick') ||
                element.hasAttribute('onauxclick') ||
                element.hasAttribute('href') ||
                element.hasAttribute('onmousedown') ||
                element.hasAttribute('onmouseup')) {
                return true;
            }

            // ARIA roles
            const role = element.getAttribute('role');
            const clickableRoles = new Set(['button', 'link', 'menuitem', 'checkbox', 'radio', 'switch', 'togglebutton', 'tab', 'slider']);
            if (clickableRoles.has(role)) {
                return true;
            }

            if (element.classList.contains('Editable')) {
                return true;
            }

            // Last resort: walk up parents safely (using parentElement)
            if (element.parentElement) {
                return Globals.isElementClickable(element.parentElement);
            }
        } catch (error) { }

        return false;
    }

    static isElementEditable(target) {
        if (!target || !(target instanceof Element)) {
            return false;
        }

        // Quick exit for disabled/readonly elements
        if (target.disabled || target.readOnly) {
            return false;
        }

        try {
            // 1. Native form controls
            if (target.tagName === 'INPUT') {
                const editableTypes = new Set([
                    'text', 'email', 'password', 'search', 'number', 'url',
                    'tel', 'date', 'datetime-local', 'month', 'time', 'week',
                    'color' // debatable, but user can interact
                ]);
                return editableTypes.has(target.type);
            }

            if (target.tagName === 'TEXTAREA') {
                return true;
            }

            if (target.tagName === 'SELECT') {
                return true; // user can change value
            }

            // 2. Contenteditable (best way)
            if (target.isContentEditable === true) {
                return true;
            }

            // 3. Whole document is editable
            if (target.ownerDocument?.designMode === 'on') {
                return true;
            }

            // 4. CSS user-modify (older spec, still used sometimes)
            const style = window.getComputedStyle(target);
            if (style.userModify === 'read-write' ||
                style.webkitUserModify === 'read-write') {
                return true;
            }

            // 5. Cursor as a fallback (least reliable)
            if (style.cursor === 'text') {
                return true;
            }

            // 6. Common editable class names / attributes (configurable)
            const editableClasses = ['editable', 'content-editable', 'ck-editor', 'quill', 'tinymce'];
            for (const cls of editableClasses) {
                if (target.classList.contains(cls)) {
                    return true;
                }
            }

            if (target.getAttribute('contenteditable') === 'true') {
                return true;
            }

        } catch (e) {
            // Security error or detached element
            return false;
        }

        return false;
    }

    static isGoogleMapsDraggable(target) {
        if (!target) return false;

        // Walk up the DOM tree
        let el = target;
        while (el && el !== document.body) {
            // Modern Google Maps (2025-2026)
            if (el.tagName === 'GMP-MAP' ||
                el.getAttribute('role') === 'application' ||
                el.classList.contains('widget-scene') ||
                el.id?.includes('map') ||
                el.closest('gmp-map')) {
                return true;
            }

            // Older canvas-based fallback
            if (el.tagName === 'CANVAS' ||
                el.style.cursor === 'grab' ||
                el.style.cursor === 'grabbing') {
                return true;
            }

            el = el.parentElement;
        }
        return false;
    }

    static isDraggable(element) {
        if (!element) {
            return false;
        }

        try {
            // Check the HTML5 draggable attribute
            if (element.hasAttribute('draggable') && element.getAttribute('draggable').toLowerCase() === 'true') {
                return true;
            }

            // Check the ui-draggable class (jQuery UI)
            if (element.classList.contains('ui-draggable')) {
                return true;
            }

            // Check the data-draggable attribute
            if (element.hasAttribute('data-draggable') && element.getAttribute('data-draggable').toLowerCase() === 'true') {
                return true;
            }

            // Check if there's a dragstart event listener
            if (true == element.draggable) {
                return true;
            }

            // Check if it has any other custom indication of being draggable
            // For example, you could add your own class like "draggable" and check for it
            if (element.classList.contains('draggable')) {
                return true;
            }

            const elementStyle = window.getComputedStyle(element);

            // Check if the cursor property is set to "pointer"
            switch (elementStyle.cursor) {
                case 'hand':
                case 'grab':
                    return true;
                    break;

                default:
                    break;
            }

            if (true === Globals.isGoogleMapsDraggable(element))
                return true;

            // check if we are contained in a draggable element
            if (element.parentNode && '#document' !== element.parentNode.nodeName)
                return Globals.isDraggable(element.parentNode);
        } catch (error) { }

        // If none of the above conditions are met, it's not draggable
    }

    // ======================== SERIALIZATION ========================

    static serializeElement(element) {
        if (!element || !(element instanceof Element)) return null;
        let selector = new SelectorSet(element, persistence.indices, false);

        const data = {
            tagName: element.tagName,
            id: element.id || '',
            classList: Array.from(element.classList || []),
            attributes: {},
            _rawAttributes: {},
            innerText: element.innerText || element.textContent || '',
            value: element.value !== undefined ? element.value : '',
            textContent: element.textContent || '',
            alt: element.alt || '',
            href: element.href || '',
            src: element.src || '',
            placeholder: element.placeholder || '',

            offsetWidth: element.offsetWidth,
            offsetHeight: element.offsetHeight,
            offsetLeft: element.offsetLeft,
            offsetTop: element.offsetTop,
            scrollX: window.scrollX,
            scrollY: window.scrollY,

            boundingRect: element.getBoundingClientRect
                ? JSON.parse(JSON.stringify(element.getBoundingClientRect()))
                : null,

            clientRects: element.getClientRects
                ? Array.from(element.getClientRects()).map(r => JSON.parse(JSON.stringify(r)))
                : [],

            shadowRoot: !!element.shadowRoot,

            // NEW: pre-computed flags from real DOM
            isClickable: Globals.isElementClickable(element),
            isEditable: Globals.isElementEditable(element),
            isDraggable: Globals.isDraggable(element),

            pageURL: window.location.href,
            css: selector.css,
            // Pre-computed XPath data (critical for background)
            fullXPath: selector.fullXPath,
            simplifiedXPath: selector.simplifiedXPath,
            xPaths: selector.xPaths,
            absoluteRect: Globals.getAbsoluteRect(element),
            absoluteLeft: 0,
            absoluteTop: 0,
        };

        if (data.absoluteRect) {
            data.absoluteLeft = data.absoluteRect.left;
            data.absoluteTop = data.absoluteRect.top;
        }

        // Pre-compute XPath info while we still have real DOM
        try {
            const tempSelector = new SelectorSet(element, {}, false); // false = don't increment counters
            data.fullXPath = tempSelector.fullXPath;
            data.simplifiedXPath = tempSelector.simplifiedXPath;
            data.xPaths = tempSelector.xPaths || [];
        } catch (e) {
            // fallback
        }

        if (element.attributes) {
            for (let i = 0; i < element.attributes.length; i++) {
                const attr = element.attributes[i];
                const val = attr.value.replaceAll('gpal-box-shadow-line-element', '');
                if ('href' !== attr.name) data.attributes[attr.name] = val;
                data._rawAttributes[attr.name] = attr.value;
            }
        }

        return data;
    }

    static getAbsoluteRect(element) {
        if (!element || !element.getBoundingClientRect) {
            return { left: 0, top: 0, width: 0, height: 0, x: 0, y: 0 };
        }

        let rect = element.getBoundingClientRect();
        let absLeft = rect.left;
        let absTop = rect.top;

        let currentWin = element.ownerDocument.defaultView;
        let frameElement = currentWin.frameElement;

        let depth = 0;
        const debugFrames = [];

        while (frameElement && depth < 10) {   // safety limit
            const frameRect = frameElement.getBoundingClientRect();

            absLeft += frameRect.left;
            absTop += frameRect.top;

            // Subtract parent window scroll
            absLeft -= frameElement.ownerDocument.defaultView.scrollX;
            absTop -= frameElement.ownerDocument.defaultView.scrollY;

            currentWin = frameElement.ownerDocument.defaultView;
            frameElement = currentWin.frameElement;
            depth++;
        }

        // Final top window scroll
        absLeft -= currentWin.scrollX;
        absTop -= currentWin.scrollY;

        return {
            left: absLeft,
            top: absTop,
            x: absLeft,
            y: absTop,
            width: rect.width,
            height: rect.height,
            right: absLeft + rect.width,
            bottom: absTop + rect.height,
        };
    }

    static nowAsShortDate() {
        const now = new Date();
        const shortFormatter = new Intl.DateTimeFormat('en-US', {
            year: '2-digit',
            month: 'numeric',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric',
            fractionalSecondDigits: 3,
            hour12: true
        });

        return shortFormatter.format(now);
    }
}
// Mouse recorder - i'm including this, but am going to hide the checkbox to enable. we have a very robust SimulateMouseMove
// which randomizes a mouse movement between two points. but maybe at some point we will discover an edge case for this
let currentPath = null;
let isRecording = false;
let lastPointTime = 0;
const SAMPLE_RATE = 16;   // ms between samples (~60fps)

function startMouseRecording() {
    if (isRecording) return;

    currentPath = new MousePath();
    isRecording = true;
    lastPointTime = Date.now();
    persistence.recordMouse = true;
}

function onMouseMove(e) {
    if (!isRecording) return;

    const now = Date.now();
    if (now - lastPointTime < SAMPLE_RATE) return;   // throttle sampling

    // Use clientX/Y (viewport relative) or pageX/Y (scroll-aware)
    currentPath.addPoint(e.clientX, e.clientY);
    lastPointTime = now;
}

function stopMouseRecording() {
    if (!isRecording) return;

    persistence.recordMouse = false;
    isRecording = false;

    currentPath.clean();

    // Send to background / popup / GPAL script
    BROWSER.runtime.sendMessage({
        type: 'MOUSE_PATH_RECORDED',
        path: currentPath
    });

    return currentPath;
}
// end mouse recorder
class MousePoint {
    constructor(x, y, timestampMs) {
        this.x = Math.round(x);
        this.y = Math.round(y);
        this.timestampMs = timestampMs;   // relative to recording start
    }
}

class MousePath {
    constructor() {
        this.points = [];
        this.startTime = Date.now();
        this.viewportWidth = window.innerWidth;
        this.viewportHeight = window.innerHeight;
        this.pageUrl = window.location.href;   // for validation
    }

    addPoint(x, y) {
        const elapsed = Date.now() - this.startTime;
        this.points.push(new MousePoint(x, y, elapsed));
    }

    // Optional: clean duplicates / micro-jitter
    clean() {
        // remove consecutive identical points
        this.points = this.points.filter((p, i, arr) =>
            i === 0 || p.x !== arr[i - 1].x || p.y !== arr[i - 1].y
        );
    }
}
//////////////////////////

// this is not ideal, but expedient. these methods are needed in the popup for the context menu and i didn't feel like moving all dependencies inside Globals.
/*

1. Checks if it's okay to take a screenshot, and if so, removes highlighting from the element,
gets information about the element and creates an WorkflowStep object with the information.

2. It then takes a screenshot and crops it to just the element.

3. Finally, it saves the element action to the local storage.
If it's not okay to take a screenshot, it sends
a message to the background script to slow down and notifies the user that the previous action may
not have been recorded.

- only allows one screenshot event at a time, needs to be fixed
- to do: remove tooltip, because it's only removing the highlighting
- put picture in the stack and getting out (multiple threads, use webworker)
- put screen shot code in seperate file and the worker will implement into work flow step

*/
// === DROP-IN REPLACEMENT FOR recordEvent (in Globals.js) ===
async function recordEvent(event, stringAction, functionAndThen, realTarget, data, dragData) {
    let objectElement = realTarget || event.target;
    event.target.ignoreNextFocusInEvent = false;

    // NOTE: CAVEAT: not sure why this is here, cause meta to be undefined... why was this put in to cover what bug?
    //Globals.modifierKeys.Meta = event.metaKey;

    removeElementHighlight(objectElement);
    hideToastContainer();


    const mainElementData = Globals.serializeElement(objectElement);

    let ancestorDataList = [];
    if (workflowActions.AltWaitFor !== stringAction &&
        workflowActions.WaitFor !== stringAction &&
        workflowActions.AltGetGrid !== stringAction &&
        workflowActions.GetGrid !== stringAction &&
        workflowActions.StartWorkflow !== stringAction) {

        ancestorDataList = await getContainerElement(objectElement);
    }

    if (workflowActions.SetRange === stringAction || workflowActions.FillInFrom === stringAction || workflowActions.SelectClick === stringAction)
        data = event.target.value;

    if (event.target.type === "password")
        mainElementData.value = mainElementData.value.length <= 2 ? mainElementData.value : mainElementData.value[0] + '***' + mainElementData.value[mainElementData.value.length - 1];

    debugLog(`[GPAL] recordEvent: action=${stringAction} tag=${mainElementData?.tagName} ignoreClick=${Globals.ignoreClickEvent}`);
    if (false == Globals.ignoreClickEvent)
        Messaging.sendMessageToBackground({
            message: REQUEST.RECORD_FULL_ACTION,
            action: stringAction,
            mainElementData: mainElementData,
            ancestorDataList: ancestorDataList,
            data: data ?? Globals.modifierKeys,
            keys: Globals.modifierKeys,
            dragData: dragData,   // drag-and-drop deltas/offsets; applied to the selector in the background
            frameId: Globals.currentContentID
        }, functionAndThen);
    else
        Globals.ignoreClickEvent = false;

    if (workflowActions.SelectClick === stringAction)
        Globals.ignoreClickEvent = true;

    //, (newWorkflowStep) => {

    //    if (true === persistence.settings.withImage) {
    //        switch (stringAction) {
    //            case workflowActions.LeftClick:
    //            case workflowActions.AltLeftClick:
    //            case workflowActions.RightClick:
    //            case workflowActions.AltRightClick:
    //            case workflowActions.FillInFrom:
    //            case workflowActions.Focus:
    //            case workflowActions.AltFocus:
    //            case workflowActions.MoveTo:
    //            case workflowActions.AltMoveTo:
    //            case workflowActions.Hover:
    //            case workflowActions.AltHover:
    //            case workflowActions.WithSelector:
    //            case workflowActions.AltDragAndDrop:
    //            case workflowActions.DragAndDrop:
    //                try {
    //                    Messaging.sendMessageToBackground(
    //                        REQUEST.TAKE_SCREENSHOT,
    //                        function handleStringImageDataWrapper(stringImageData) {
    //                            ImageHelper.takeScreenShot(stringImageData, newWorkflowStep, functionAndThen);
    //                        }
    //                    );
    //                } catch (error) {
    //                    if (true == error.toString().includes('extension context invalidated'))
    //                        LogMessage(LOG_TYPE.WARN, `Ottomatic reloaded?<br> ${toastStrong('PLEASE REFRESH PAGE')}`);
    //                    else
    //                        LogMessage(LOG_TYPE.CRITICAL, 'Error saving workflow step.', error);
    //                    Messaging.sendMessageToBackground(REQUEST.STOP_RECORDING);
    //                    persistence.isRecording = false;
    //                }
    //                return;

    //            default:
    //                showToastContainer();
    //                Globals.beep();
    //                break;
    //        }
    //    } else {
    //        showToastContainer();
    //        Globals.beep();
    //    }

    //    if (typeof functionAndThen === "function")
    //        functionAndThen();
    //});
}
/*

The purpose of the function below is to record the ancestors of an element in a web page, along with any
shadow hosts or iFrames it may be contained within.

- An element's ancestors are the elements that are higher up in the document tree and contain
the element in question

- iFrame is like a window within a window, where the contents of the iFrame can be a separate webpage
 or application. On the other hand, Shadow DOM is used to encapsulate the markup and styles of a component
 so that they are separate from the rest of the web page, allowing for better encapsulation and modularity
 of code.

* needed because we won't be able to access the element directly, we will have to get access through iframe or shadowDOM
* ShadowDOM = storing elements in shadow domain
* ancestor action unshift/push
* iframe shoukd go in iframe and then select element

*/

// This function is responsible for creating a list of ancestor actions for a given object element.
async function getContainerElement(objectElement) {
    //Persistence.reloadPersistence(true).then(async () => {
    let ancestorData = [];
    let previousDOM = { InIframe: null, InShadow: null };
    try {
        previousDOM.InIframe = persistence.prevDOM ? persistence.prevDOM.InIframe : null;
        previousDOM.InShadow = persistence.prevDOM ? persistence.prevDOM.InShadow : null;
    } catch (e) { }

    // 1. Local shadows
    ancestorData = ancestorData.concat(WorkflowStep.getLocalContainingShadowSteps(objectElement));

    // 2. Remote iframe chain
    if (elementInIframe()) {
        let elementCss = "";
        try {
            elementCss = WorkflowStep.getUniqueSelector(objectElement);
        } catch (e) {
            elementCss = objectElement.tagName.toLowerCase();
        }

        doNotRespond = true;
        const waitPromise = Messaging.waitForShadowInfoResult();

        Messaging.sendMessageToBackground({
            message: REQUEST.GET_ANCESTOR_INFO,
            url: window.location.href,
            css: elementCss,
            referrer: document.referrer
        });

        const remoteData = await waitPromise;
        doNotRespond = false;

        if (Array.isArray(remoteData?.ancestorDataList)) {
            ancestorData = remoteData.ancestorDataList.concat(ancestorData);
        }
        else
            ancestorData = remoteData;
    }

    // === SMART DEDUPLICATION ===
    let currentDOM = {
        InIframe: stringify(ancestorData.filter(a => a && a.action === "InIframe")),
        InShadow: stringify(ancestorData.filter(a => a && a.action === "InShadowDom"))
    };

    // set locally for this frame; the background stores it
    persistence.prevDOM.InIframe = currentDOM.InIframe;
    persistence.prevDOM.InShadow = currentDOM.InShadow;

    Messaging.sendMessageToBackground({ message: REQUEST.SET_PREV_DOM, prevDOM: currentDOM });

    // Case 1: Exact same ancestors -> emit nothing
    if (currentDOM.InIframe === previousDOM.InIframe && currentDOM.InShadow === previousDOM.InShadow) {
        return [];
    }

    // Case 4: Deeper in same chain (previous is prefix of current) -> emit only new levels
    if (previousDOM.InIframe && currentDOM.InIframe && currentDOM.InIframe.startsWith(previousDOM.InIframe)) {
        // remove the common prefix (already emitted before)
        const prevParts = previousDOM.InIframe.split(" ^ ");
        ancestorData = ancestorData.slice(prevParts.length);
    }
    else if (previousDOM.InShadow && currentDOM.InShadow && currentDOM.InShadow.startsWith(previousDOM.InShadow)) {
        const prevParts = previousDOM.InShadow.split(" ^ ");
        ancestorData = ancestorData.slice(prevParts.length);
    }
    // Case 3: Totally different nesting -> reset to main dom first
    else if ((currentDOM.InIframe !== null || currentDOM.InShadow !== null) &&
        (previousDOM.InIframe !== null || previousDOM.InShadow !== null)) {
        ancestorData.unshift({ action: "InMainDom", elementData: null });
    }

    // Case 2: Back to main DOM
    if (currentDOM.InIframe === null && currentDOM.InShadow === null &&
        (previousDOM.InIframe !== null || previousDOM.InShadow !== null)) {
        ancestorData.unshift({ action: "InMainDom", elementData: null });
    }

    return ancestorData;
    //});
}

function stringify(workflow) {
    if (!workflow || (Array.isArray(workflow) && workflow.length === 0)) {
        return null;
    }

    let finalStr = "";

    try {
        const items = Array.isArray(workflow) ? workflow : [workflow];

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (!item) continue;

            if (item.selectorSet && item.selectorSet.selectorName) {
                finalStr += item.selectorSet.selectorName;
            }
            else if (item.action && item.elementData) {
                const ed = item.elementData;
                finalStr += item.action + "+" +
                    (ed.tagName || "unknown") + "+" +
                    (ed.id || "") + "+" +
                    (ed.selectorName || "") + "+" +
                    (ed.css || "") + "+" +
                    (ed.fullXPath || "") + "+" +
                    (ed.src ? ed.src.substring(Math.max(0, ed.src.length - 60)) : "");
            }
            else if (item.tagName) {
                finalStr += item.tagName.toLowerCase() + "+" + (item.id || "") + "+" + (item.className || "");
            }

            if (i < items.length - 1) {
                finalStr += " ^ ";
            }
        }

        if (finalStr !== "") {
            return finalStr;
        }

        // Failproof fallback - make it as unique as possible
        return "[complex:" + Date.now() + ":" + Math.random().toString(36).substring(2, 8) + "]";

    } catch (error) {
        LogMessage(LOG_TYPE.ERROR, "stringify error:", error);
        return "[stringify_failed:" + Date.now() + "]";
    }
}

//check if element is inside of an iframe
function elementInIframe() {
    try {
        // Primary check - most reliable for both iframe and frame
        if (window.self !== window.top) {
            return true;
        }

        // Additional check for legacy framesets
        if (window.frameElement) {
            return true;
        }

        // Fallback for cross-origin cases
        return window.parent !== window.self;
    } catch (e) {
        return true;   // safer to assume we are framed if we can't check
    }
}
