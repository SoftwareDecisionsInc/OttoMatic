/* FROM HERE === STATE variables of some sort, sequence events via these */
let fadeTimeout = [];   // keep track of toaster fade-out timers, if we hover over one, we want to pause all

/* These variables are used to control certain behaviors */
let suspendHighlightingToTakeScreenshot = false;
let suspendUnloadToPromptForConfirmation = false;
/* TO HERE =====STATE variables of some sort, sequence events via these */

/* This creates a new <span> element to be used as a tooltip */
let tooltip = document.createElement("span");
tooltip.id = 'tooltip';

let showBanner = false;

// Flag to prevent creating new workflows while pressing the same key
let sameKeyPressFlag = false;
//save the keys pressed when keypress workflow is created, for release key press
let prevModKeys = { ...Globals.modifierKeys };

var doNotRespond = false;

//===============
// Helpers
//===============
/**********
 * Toast container position
 * ********/
// Function to apply the selected mode
function repositionToast(mode) {
    /************ content: on-page toast ***************************/
    if (!toastContainer && 0 === Globals.currentContentID) {    // only create a container in the top doc, we bubble toast up to the top
        // Create the toast container if it doesn't exist
        toastContainer = document.createElement('div');
        toastContainer.id = 'gpaltoast-container';
        toastContainer.classList.add('gpaltoast-container');
        toastContainer.classList.add('bottom-right');
        document.body.appendChild(toastContainer);
    }

    if (toastContainer) {
        // Remove all mode classes
        toastContainer.classList.remove(
            TOAST_POSITION.bottomCenter,
            TOAST_POSITION.bottomLeft,
            TOAST_POSITION.bottomRight,
            TOAST_POSITION.topCenter,
            TOAST_POSITION.topLeft,
            TOAST_POSITION.topRight
        );

        // Apply the selected mode class
        toastContainer.classList.add(mode);
    }
}

//grab entire document encapsulating html element
function findTopNode(element) {
    if (element === null) {
        return null;
    }
    while (element.parentNode) {
        element = element.parentNode;
    }
    return element;
}

//recursivley look for shadowDom's root
//function getShadowRoot(element) {
//    element = element.parentNode;
//    while (element && element !== document) {
//        if (element.shadowRoot)
//            return element;
//        else if (element.tagName && element.tagName.toLowerCase() === "iframe")
//            return null;
//        element = element.parentNode;
//    }
//    return null;
//}

//check if element is inside of a shadowDom
function isInShadow(element) {
    return !!getShadowRoot(element);
}

function getShadowRoot(element) {
    if (!element) return null;

    // Try Chrome privileged API first
    if (BROWSER && BROWSER.dom && BROWSER.dom.openOrClosedShadowRoot) {
        try {
            return BROWSER.dom.openOrClosedShadowRoot(element);
        } catch (e) { }
    }

    // Firefox
    if (element.openOrClosedShadowRoot) {
        try {
            return element.openOrClosedShadowRoot();
        } catch (e) { }
    }

    // Standard open shadow
    if (element.shadowRoot) {
        return element.shadowRoot;
    }

    return null;
}

function areObjectsEqual(obj1, obj2) {
    // compare character by character and locale, jic
    return (0 === obj1.localeCompare(obj2) ? true : false)
}

/*
The code below is used to capture modifier keys
*/
// Event listener for keydown event to handle modifier keys
function pressModifierKeys(event) {
    if (!Globals.modifierKeys.Shift && true === event.shiftKey) {
        Globals.modifierKeys.Shift = event.shiftKey;;
        Globals.modifierKeysPressed++;
    }
    if (!Globals.modifierKeys.Control && true === event.ctrlKey) {
        Globals.modifierKeys.Control = event.ctrlKey;
        Globals.modifierKeysPressed++;
    }
    if (!Globals.modifierKeys.Alt && true === event.altKey) {
        Globals.modifierKeys.Alt = event.altKey;
        Globals.modifierKeysPressed++;
    }
    if (!Globals.modifierKeys.Meta && true === event.metaKey) {
        Globals.modifierKeys.Meta = event.metaKey;;
        Globals.modifierKeysPressed++;
    }
}

// Event listener for keyup event to release modifier keys
function releaseModifierKeys(event) {
    if (Globals.modifierKeys.Shift && false === event.shiftKey) {
        Globals.modifierKeys.Shift = event.shiftKey;
        Globals.modifierKeysPressed--;
    }
    if (Globals.modifierKeys.Control && false === event.ctrlKey) {
        Globals.modifierKeys.Control = event.ctrlKey;
        Globals.modifierKeysPressed--;
    }
    if (Globals.modifierKeys.Alt && false === event.altKey) {
        Globals.modifierKeys.Alt = event.altKey;
        Globals.modifierKeysPressed--;
    }
    if (Globals.modifierKeys.Meta && false === event.metaKey) {
        Globals.modifierKeys.Meta = event.metaKey;;
        Globals.modifierKeysPressed--;
    }
}

//get the modifier keys that went from true to false or vice versa
function getChangedKeys(previousState, modifierKeys) {

    const changedKeys = {
        Alt: false,
        Control: false,
        Shift: false,
        Meta: false,
    };
    // Iterate over the keys of the modifierKeys object
    Object.keys(modifierKeys).forEach(function (key) {

        // Check if the key was true in the previousState and is now false in modifierKeys
        if (previousState[key] !== modifierKeys[key]) {
            changedKeys[key] = true; // Add the key to the changedKeys object
            changedKeys["akeychanged"] = true;
        }
    });

    return changedKeys; // Return the object containing the changed keys
}

function getModKeys2(modifierKeys) {
    let result = '';
    //check for all modifier keys pressed 
    for (const modKey in modifierKeys) {
        //only show if a obj key is true 
        if ("akeychanged" !== modKey && "keyCode" !== modKey)
            if (modifierKeys[modKey] === true) {
                result += "ModifierKeys." + modKey.charAt(0).toUpperCase() + modKey.slice(1) + " | ";
            }
    }
    //replace last space and line with closing paranthesis 
    if (result[result.length - 2] === "|") {
        result = result.slice(0, -3);
    }
    return result;
}
function isAnInputThatDoesNotAcceptEnter(event) {
    return ("INPUT" === event.target.tagName
        && (event.target.type === "text" || event.target.type === "email" || event.target.type === "password" || event.target.type === "search"))
        || ('TEXTAREA' === event.target.tagName && "hard" != event.target.wrap)   // text area that does not accept enter
        || ('DIV' === event.target.tagName && true == event.target.isContentEditable);
}
function isInTextField(event) {
    return Globals.isElementEditable(event.target);
}

function showStartupBanner() {
    if (false == showBanner && persistence && persistence.settings && persistence.settings.toastPosition) {
        showBanner = true;
        repositionToast(persistence.settings.toastPosition);
        if (persistence && persistence.isRecording && (window.self === window.top)) { // we are the top level document
            LogMessage(LOG_TYPE.RECORDING, `${toastStrong('IN PROGRESS')}`);
            Messaging.sendMessageToBackground(REQUEST.SHOW_GPAL_ON_CONTEXT_MENU);	// show the gpal menu options, if we are recording
        } else
            Messaging.sendMessageToBackground(REQUEST.SHOW_COPY_TO_CLIP_ON_CONTEXT);	// show the copy options on context on startup, if not recording
    }
}

function highlightElementByCss(cssSelector, pageURL) {
    let bestCss = null;
    if (0 === cssSelector.length) return;

    setTimeout(() => {
        var matchingElements;
        try {
            // Swapped document.evaluate for querySelectorAll to process the CSS param
            matchingElement = document.querySelector(cssSelector);
        } catch (error) {
            return null;
        }

        if (matchingElement) {
            if ('undefined' !== typeof persistence && 'undefined' !== typeof persistence.elementToHighlightCss)
                persistence.elementToHighlightCss = undefined; // one and done...

            // the same frame that locates this will also have the same pageURL as the element 
            // because we have multiple attempts due to page load timing, only do this once (elem to highlight is undefined) 
            if (pageURL == window.location.href) {
                debugLog('Element to highlight', cssSelector);
                matchingElement.classList.add(HIGHLIGHTED_DASHED_ELEMENT_CLASS);
                matchingElement.classList.add(HIGHLIGHTED_BOX_SHADOW_ELEMENT_CLASS);
                matchingElement.scrollIntoView({ alighnToTop: true, block: 'start', behavior: "smooth" });
            }
        }
        Persistence.savePersistence();
    }, 500);
}

//===============
// END OF Helpers
//===============

//===============
// INIT
//===============

function init() {
    //Get the default persistence object
    Messaging.sendMessageToBackground(
        REQUEST.GET_MY_TAB_ID,
        (tabId) => {
            Globals.currentTabID = tabId;
            Messaging.sendMessageToBackground(REQUEST.GET_MY_FRAME_ID, (response) => {
                Globals.currentContentID = response;
                if (0 === Globals.currentContentID) {   // top document
                    Messaging.sendMessageToBackground({ message: REQUEST.SET_TOP_LEVEL_URL, url: window.top.location.href })
                    Messaging.sendMessageToBackground({ message: REQUEST.SET_CURRENT_FRAME_ID, contentId: Globals.currentContentID })    // let background track that i'm now active content
                }
                if (true == Globals.debug)
                    console.log("content starting up @", window.location.href, "contentId:" + Globals.currentContentID, "currentTabId:" + Globals.currentTabID);
                setTimeout(secondInit, persistence.settings.contentDelay);
            });
        }
    );
}

function secondInit() {
    
    // mouse wheel in every content or just frameid 0?
    // Add an event listener to the document for the 'wheel' event
    document.addEventListener('wheel', handleMouseWheel);
    // capture phase: scroll doesn't bubble, and its target is what actually moved (the wheel target is just under the pointer)
    document.addEventListener('scroll', handleScrolled, true);

    // wheel marks a gesture; the following scroll says what moved and how far. A wheel at an end stop expires.
    let wheelPending = false;
    let wheelTimer = null;

    // element whose scrollbar is being dragged (a drag scrolls with no wheel events)
    let scrollbarDrag = null;

    document.addEventListener('pointerdown', notePossibleScrollbarGrab, true);
    document.addEventListener('pointerup', () => { scrollbarDrag = null; }, true);
    document.addEventListener('pointercancel', () => { scrollbarDrag = null; }, true);

    // a press past clientWidth/clientHeight is on the native scrollbar
    function scrollRecordingOn() {
        return !!persistence
            && true === persistence.isRecording
            && true === persistence.settings?.recordScrollWheel;
    }

    function notePossibleScrollbarGrab(event) {
        scrollbarDrag = null;

        if (false === scrollRecordingOn()) return;

        const el = event.target;

        if (!(el instanceof Element)) return;

        const root = document.documentElement;
        const onPage = el === root || el === document.body;

        // the page is measured in viewport coordinates; offsetX/Y on <html> are document coordinates
        const pastTheEdge = onPage
            ? (event.clientX > root.clientWidth || event.clientY > root.clientHeight)
            : (event.offsetX > el.clientWidth || event.offsetY > el.clientHeight);

        if (false === pastTheEdge) return;

        // window, not <html>: a scroll of the page arrives with the Document as its target, and that is what
        // the gate below compares against
        if (onPage) {
            scrollbarDrag = window;
            Globals.scrollBaseline.set(window, { top: window.scrollY, left: window.scrollX });
        } else {
            scrollbarDrag = el;
            Globals.seedScrollBaseline(el);
        }
    }

    // Event handler for the 'wheel' event
   
    function handleMouseWheel(event) {
        // Check the deltaY property of the event to determine the scroll direction
        if (true === scrollRecordingOn()) {
            if (0 === event.deltaY && 0 === event.deltaX) return;

            // what scrolls is an ancestor of what the pointer is over; composedPath includes shadow roots
            const path = event.composedPath ? event.composedPath() : [];

            for (const node of path)
                Globals.seedScrollBaseline(node);

            Globals.scrollBaseline.set(window, { top: window.scrollY, left: window.scrollX });

            wheelPending = true;
            clearTimeout(wheelTimer);
            wheelTimer = setTimeout(() => { wheelPending = false; }, 200);
        }
    }

    function handleScrolled(event) {
        if (false === scrollRecordingOn()) return;

        const target = event.target;
        const isPage = !target
                    || target === document
                    || target === document.documentElement
                    || target === document.body;

        // window for the page, the element otherwise (a page-scrollbar press hits <html> but the scroll reports Document)
        const key = isPage ? window : target;

        // Only wheel or scrollbar drag. Scrolling keys are recorded as the keypress; anything else is the page
        // scrolling itself, which playback reproduces.
        const userScrolled = wheelPending || scrollbarDrag === key;
        const baseline = Globals.scrollBaseline;
        const current = isPage
            ? { top: window.scrollY, left: window.scrollX }
            : { top: target.scrollTop, left: target.scrollLeft };

        // nothing seeded for this one, so take it as already where it is and let the next event measure from
        // here rather than reporting the whole scroll offset as a delta
        const before = baseline.has(key) ? baseline.get(key) : current;

        // moved on every scroll, recorded or not: several events can come from one input and their deltas add,
        // and scrolling we ignore must not pile up and land on the next thing we do record
        baseline.set(key, current);

        if (false === userScrolled) return;

        const down = Math.round(current.top - before.top);
        const across = Math.round(current.left - before.left);

        // one axis per step. a trackpad puts a little of the other axis into almost every gesture, and taking
        // both would interleave two runs and split each of them at every alternation
        const horizontal = Math.abs(across) > Math.abs(down);
        const pixels = horizontal ? across : down;

        if (0 === pixels) return;

        Messaging.sendMessageToBackground({
            message: REQUEST.RECORD_SCROLL,
            pixels: pixels,
            horizontal: horizontal,
            containerData: isPage ? null : Globals.serializeElement(target)
        });
    }
    
    //Update the persistence object when you change tabs (due to context switching)
    document.addEventListener("visibilitychange", function () {
        if (document.visibilityState === "hidden") {
        } else {
            try {
                Persistence.reloadPersistence().then(showStartupBanner());
            } catch (error) {
                showToast(LOG_TYPE.WARN, `Ottomatic Reloaded?\n${toastStrong('PLEASE REFRESH PAGE.')}`);
            }
        }
    });

    // our message event handler
    BROWSER.runtime.onMessage.addListener(Messaging.handleMessageForContent);

    // CAVEAT: what happens with dynamically added forms?
    const forms = document.querySelectorAll('form');

    forms.forEach(function (form) {
        form.addEventListener('submit', handleFormSubmission, true); // true, get the event first
    })

    // Broader and more reliable selector
    const editableElements = document.querySelectorAll(`
        input,
        textarea,
        select,
        [contenteditable="true"],
        [contenteditable=""],
        div[role="textbox"],
        [role="textbox"]
    `);

    editableElements.forEach(el => {
        // Only attach if it's actually editable
        if (Globals.isElementEditable(el)) {
            // el.addEventListener('input', recordUserInput, true);
            el.addEventListener('change', recordUserInput, true);

            // Optional: also catch paste, blur, etc.
            // el.addEventListener('paste', recordUserInput, true);
            // el.addEventListener('blur', recordUserInput, true);
        }
    });

    /**/
    // Add event listeners to track changes (clicking off input and input value changes) in input/text fields
    //when a keys is pressed or released the apropriate functions are ran
    document.addEventListener("keydown", handleKeyPress, true);
    document.addEventListener("keyup", handleKeyRelease, true);

    window.addEventListener("beforeunload", beforeUserLeavesPage, true);
    // Attach the `onload` event listener
    window.addEventListener('load', function () {
        // Code to be executed when the page has finished loading
        // this event seems quite fickle and not a reliable way to fire anything off
    });

    document.addEventListener("focusin", recordUserActions, true);    // to capture tabbing to an item which does not fire a mouse event
    document.addEventListener("click", recordUserActions, true);    // just for right and other mouse buttons, mouseup detects a click
    /* This code adds an event listener to the document object that listens for a "mousemove" event */
    document.addEventListener("mousemove", highlightElementHovered, true); // false, get the event last so we highlight it
    /* This code adds an event listener to the document object that listens for a "mouseout" event */
    document.addEventListener("mouseout", elementHighlightRemoved, true); // true, get the event first
    document.addEventListener("mouseup", recordUserActivity, true); // necessary for drag and drop
    document.addEventListener("pointerdown", recordUserActivity, true); // necesary ONLY for A tag clicks

    // Add an event listener to the `window` object of the page
    // The unhandledrejection event is fired when a Promise is rejected (i.e., fails with an error), and no .catch() handler is attached to handle that rejection.
    window.addEventListener('unhandledrejection', unhandledRejection);

    document.addEventListener('mouseleave', function (event) {
        // Mouse has left the document area
        // we track url changes, which can happen if an anchor tag is clicked (we capture the url at the click and ignore the url change event)
        // if we leave the browser area, we could be going to type in a url, so then we capture that so we know a new url was typed in (or bookmark clicked)
        // so, if anchor is clicked, ignore capturing a url change, if nothing is clicked, capture url change
        if (persistence && persistence.isRecording) {
            if (event.target && !event.target.parentNode && event.target.location.href === document.location.href)
                Messaging.sendMessageToBackground(REQUEST.RESET_NEXT_GOTO);     // user has left browsing area, could be entering a url or clicking a bookmark, clear flag jic it is set

            const x = event.clientX;
            const y = event.clientY;
            const width = window.innerWidth;
            const height = window.innerHeight;

            // Check which boundary edge was crossed
            const leftSide = x <= 0;
            const rightSide = x >= width;
            const topSide = y <= 0;
            const bottomSide = y >= height;

            if (leftSide || rightSide || topSide || bottomSide) {
                if (true == Globals.debug)
                    console.log(`Mouse left viewport at coordinates: X=${x}, Y=${y}`);

                Globals.currentHoverTarget = null;
                if (null !== Globals.hoverTimer) {
                    clearTimeout(Globals.hoverTimer);
                    Globals.hoverTimer = null;
                }
            }
        }
    });

    // TODO: continue developing drag-and-drop capture
    document.addEventListener('dragstart', beginDragAndDrop);   // cannot do this until we drag, altho possibly if we click on a draggable item?
    document.addEventListener("dragend", recordUserActivity, true);

    document.addEventListener('contextmenu', handleContextMenu);

    BROWSER.storage.onChanged.addListener(async (changes, area) => {
        if (area !== "local" || !changes.persistence)
            return;

        // skip only this frame's own writes
        if (changes.persistence.newValue?.savedByID === Globals.currentContentID)
            return;

        setTimeout(() => {
            Persistence.reloadPersistence(true);
        }, 10);
    });

    showStartupBanner();    // we will try a lot until it succeeds, hopefully before a user records any action
    //setTimeout(() => {
    //    showStartupBanner();
    //    flashyHighlight();
    //    //if ('undefined' !== typeof persistence && 'undefined' !== typeof persistence.elementToUpdateSelectorName && persistence.elementToUpdateSelectorName)
    //    //    updateImage(persistence.elementToUpdateSelectorName);
    //}, 1000);    // complete fallback when all else is failing... wait...
    //setTimeout(() => {
    //    showStartupBanner();
    //    flashyHighlight();
    //    //if ('undefined' !== typeof persistence && 'undefined' !== typeof persistence.elementToUpdateSelectorName && persistence.elementToUpdateSelectorName)
    //    //    updateImage(persistence.elementToUpdateSelectorName);
    //}, 2000);    // complete fallback when all else is failing... wait...
    setTimeout(() => {
        showStartupBanner();
        flashyHighlight();
        // the background clears it
        if ('undefined' !== typeof persistence && persistence.elementToUpdateSelectorName) {
            updateImage(persistence.elementToUpdateSelectorName);
            persistence.elementToUpdateSelectorName = undefined;    // we must clear this so other pages don't accidentally think this is for them
            Messaging.sendMessageToBackground({ message: REQUEST.CLEAR_UPDATE_TARGET });
        }
    }, 2000);    // complete fallback when all else is failing... wait...
}

function flashyHighlight() {
    if ('undefined' !== typeof persistence && 'undefined' !== typeof persistence.elementToHighlightCss && persistence.elementToHighlightCss) {
        highlightElementByCss(persistence.elementToHighlightCss, persistence.elementToHighlightURL);
    }
}

function findNodeByXpath(xpath) {
    try {
        const result = document.evaluate(xpath, document, null, XPathResult.ANY_TYPE, null);
        let node = result.iterateNext();
        return {
            result: result,
            node: node
        }
    } catch (error) {
        LogMessage(LOG_TYPE.NOTICE, `Element ${toastStrong('NOT FOUND')}\n${xpath}`);
        return {
            result: null,
            node: null
        }
    }
}

function updateImage(selectorName) {
    let selectorSetIdx = SelectorSet.findSelector(selectorName, true);
    if (0 > selectorSetIdx) return;

    let node = document.querySelector(persistence.selectorSets[selectorSetIdx].css);
    if (!node) {
        LogMessage(LOG_TYPE.NOTICE, `Image ${toastStrong('NOT')} Updated on<br>Selector: ${toastStrong(selectorName)}`, `Please go to ${toastStrong(persistence.selectorSets[selectorSetIdx].parentURL)}\nand right click the element.\nSelect ${toastStrong('GPAL > Update Image')}`);
        setTimeout(() => Messaging.sendMessageToBackground(REQUEST.CLOSE_ME), 10000);
        return;
    }

    node.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' });
    requestAnimationFrame(() => {
        Messaging.sendMessageToBackground({ message: REQUEST.CAPTURE_THEN_RESPOND }, (stringImageData) => {
            if (!stringImageData) {
                LogMessage(LOG_TYPE.NOTICE, `Image ${toastStrong('NOT')} Updated on<br>Selector: ${toastStrong(selectorName)}`);
                setTimeout(() => Messaging.sendMessageToBackground(REQUEST.CLOSE_ME), 5000);
                return;
            }
            let persisted = persistence.selectorSets[selectorSetIdx];
            let fresh = new SelectorSet(node, persistence.indices, false);
            persisted.boundingRect = fresh.boundingRect;
            persisted.absoluteLeft = fresh.absoluteLeft;
            persisted.absoluteTop = fresh.absoluteTop;
            ImageHelper.cropImageByBoundingRectangle(
                stringImageData, persisted, persistence.settings.marginSize,
                () => {
                    persistence.Workflow
                        .filter(s => s.selectorSet?.selectorName === selectorName)
                        .forEach(s => { s.selectorSet.imageData = persisted.imageData; });

                    // Advance the "Update All Missing" queue if one is running
                    const queue = persistence.selectorNamesToUpdate;
                    if (queue && queue.length > 0) {
                        const nextName = queue[0];
                        const nextSel = SelectorSet.findSelector(nextName);
                        persistence.selectorNamesToUpdate = queue.slice(1);
                        persistence.elementToUpdateSelectorName = nextName;
                        Persistence.savePersistence().then(() => {
                            if (nextSel?.parentURL)
                                window.location.href = nextSel.parentURL;
                            else
                                setTimeout(() => Messaging.sendMessageToBackground(REQUEST.CLOSE_ME), 1000);
                        });
                    } else {
                        persistence.elementToUpdateSelectorName = undefined;
                        persistence.selectorNamesToUpdate = [];
                        Persistence.savePersistence();
                        LogMessage(LOG_TYPE.NOTICE, `Image Updated on<br>Selector: ${toastStrong(selectorName)}`);
                        setTimeout(() => Messaging.sendMessageToBackground(REQUEST.CLOSE_ME), 3000);
                    }
                }
            );
        });
    });
}

// if we are in the TinyMCE editor anywhere, the popup gets inserted as a text list
function hasTinyMCEElement(element) {
    // First pass: Check child elements
    if ('undefined' === typeof element)
        return false;

    function checkChildren(element) {
        if (true === testElementForForbiddenCustomContextMenu(element)) {
            return true;
        }
        for (let i = 0; i < element.children.length; i++) {
            if (checkChildren(element.children[i])) {
                return true;
            }
        }
        return false;
    }

    // Second pass: Check parent elements
    function checkParents(element) {
        if (element === null) {
            return false; // Reached the document root
        }
        if (true === testElementForForbiddenCustomContextMenu(element)) {
            return true;
        }
        return checkParents(element.parentElement);
    }

    function testElementForForbiddenCustomContextMenu(element) {
        return element.classList.contains('tinymce-editor-class') || element.classList.contains('mce-content-body') || ('undefined' !== typeof element.id && 'tinymce' === element.id);
    }

    // Perform the two passes
    return checkChildren(element) || checkParents(element.parentElement);
}
 
function CheckClipboardPermission() {
    var readPerm;
    var writePerm;

    navigator.permissions.query({ name: 'clipboard-write', allowWithoutGesture: false }).then((result) => {
        writePerm = result.state;
        debugLog('clipboard Write: ' + writePerm.state);
    });
}

Persistence.reloadPersistence(true).then(init);