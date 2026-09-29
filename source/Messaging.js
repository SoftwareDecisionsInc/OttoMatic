class Messaging {
    static port;
    ///////////////////////
    // Message Helpers
    ///////////////////////
    // read a command from stdin and send a command to popup.js
    static readFromNativeApp(request, sender, sendResponse) {
        // showToast("Native Message Received\n" + request.message, "basic");
        switch (request.message) {
            case REQUEST.GET_SETTINGS:
                const filteredSettingsKeys = Object.keys(persistence.settings).filter(key => key.startsWith('with'));
                const Settings = {};
                for (const key in filteredSettingsKeys)
                    Settings[filteredSettingsKeys[key]] = persistence.settings[filteredSettingsKeys[key]];
                var message = { message: REQUEST.SEND_SETTINGS, settings: Settings };
                Messaging.sendToNativeApp(message);
                break;
            case REQUEST.GET_GPAL_SETTINGS:
                // Create a new object to store the filtered settings
                const GPALSettings = {};

                // Iterate through the properties of Settings
                for (const key in gpalSettings) {
                    // Check if the corresponding property in browserSettings is true
                    if (gpalSettings.hasOwnProperty(key) && true == persistence.settings[key]) {
                        // Add the property to GPALSettings from browserSettings
                        GPALSettings[key] = gpalSettings[key];
                    }
                }
                var message = { message: REQUEST.SEND_GPAL_SETTINGS, gpalSettings: GPALSettings };
                Messaging.sendToNativeApp(message);
                break;
            case REQUEST.GET_BROWSER_SETTINGS:
                // Create a new object to store the filtered settings
                const BrowserSettings = {};

                // Iterate through the properties of Settings
                for (const key in browserSettings) {
                    // Check if the corresponding property in browserSettings is true
                    if (browserSettings.hasOwnProperty(key) && true == persistence.settings[key]) {
                        // Add the property to GPALSettings from browserSettings
                        BrowserSettings[key] = browserSettings[key];
                    }
                }
                var message = { message: REQUEST.SEND_BROWSER_SETTINGS, browserSettings: BrowserSettings };
                Messaging.sendToNativeApp(message);
                break;
            case REQUEST.GET_SELECTOR:
                Messaging.messageAllTabs(REQUEST.GET_SELECTOR); //send a message to all tabs to start recording
                //persistence.isRecording = true;	// enable context menu
                //Persistence.savePersistence();
                break;

            case REQUEST.GET_SELECTORS:
                var jsonSelectors = persistence.Workflow.map(step => step.selectorSet);
                var message = { message: REQUEST.SEND_SELECTORS, selectorSets: jsonSelectors };
                Messaging.sendToNativeApp(message);
                break;

            case REQUEST.GET_WORKFLOW:
                var jsonWorkflow = persistence.Workflow.map(step => step);
                var message = { message: REQUEST.SEND_WORKFLOW, workflow: jsonWorkflow };
                Messaging.sendToNativeApp(message);
                break;

            case "started":
                Messaging.sendToPopup({ message: 'apiStarted' });
                break;

            case "stopped":
                Messaging.sendToPopup({ message: 'apiStopped' });
                break;
        }
    }

    static sendToPopup(command) {
        try {
            BROWSER.runtime.sendMessage(command);
        } catch (err) {
            showToast(err, "basic");
        }
    }

    static  sendToNativeApp(command) {
        // 'die' is a deliberate shutdown -- stop onDisconnect from respawning it.
        if ('die' === command) {
            nativeAppShuttingDown = true;
        }
        try {
            Messaging.port.postMessage(command);
        } catch (err) {
            showToast(err, "basic");
        }
    }


    //!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    // NOTE: DO NOT ATTEMPT TO ShowToast from sendMessageToBackground if there is a comms error
    // cause it just tries to send a message to background to show it. use showNotification
    //!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    static sendMessageToBackground(message, callback) {

        async function sendIt(objectMessage) {
            if (callback)
                return new Promise((resolve, reject) => {
                    BROWSER.runtime.sendMessage(
                        //BROWSER.runtime.id,
                        objectMessage,
                        (response) => {
                          void BROWSER.runtime.lastError;
                          if (response || 0 === response)
                                resolve(response);
                            else
                                reject('because');
                        }
                    );
                }).catch(error => {
                    // Handle different types of errors that can occur when sending messages to tabs
                    debugLog('sendMessageToBackground error', error.message);
                    void BROWSER.runtime.lastError;
                });
            else {
                try {
                    return BROWSER.runtime.sendMessage(objectMessage);
                } catch (error) {
                    debugLog('sendMessageToBackground error', error.message);
                    void BROWSER.runtime.lastError;
                }
            }
        }

        async function doit() {
            try {
                var response = await sendIt(message);
                if (typeof callback === "function")
                    callback(response);
                else
                    return response;    // must have this return
            } catch (error) {
                //try {   // try again
                //    response = await sendIt(message);
                //    if (typeof callback === "function")
                //        callback(response);
                //    else
                //        return response;    // must have this return
                //} catch (error) {
                    if ('because' !== error.reason) {
                        debugLog('Error Sending Message to BG', message, error.reason);
                        //showNotification(LOG_TYPE.ERROR, 'Turning off recording on this page.\nPLEASE REFRESH PAGE');
                        //BROWSER.debugger.detach({ tabId: Globals.currentTabID });
                        Messaging.messageAllTabs(REQUEST.STOP_RECORDING); //send a message to all tabs to stop recording, this tab got the ONE selector
                        persistence.isRecording = false;
                    }
                //}
            }
        }
        return doit();
    }

    static waitForShadowInfoResult() {

        return new Promise(resolve => {

            function handler(msg, sender) {
                if (msg && msg.message === REQUEST.GET_SHADOW_INFO_RESULT) {
                    BROWSER.runtime.onMessage.removeListener(handler);
                    resolve(msg.data);
                }
            }

            BROWSER.runtime.onMessage.addListener(handler);
        });
    };

    static getAsciiCharOrKeycode(which, key) {
        return (0x20 == which) // space
            || (0x30 <= which && which <= 0x5A) // ascii
            || (0x60 <= which && which <= 0x6f) // numpad
            || (0xBA <= which && which <= 0xC0) //punctuation
            || (0xDB <= which && which <= 0xDF) //punctuation
            ? key : which;
    }

    static isPrintable(keypressEvent) {
        return (0x20 == keypressEvent.which) // space
            || (0x30 <= keypressEvent.which && keypressEvent.which <= 0x5A) // ascii
            || (0x60 <= keypressEvent.which && keypressEvent.which <= 0x6f) // numpad
            || (0xBA <= keypressEvent.which && keypressEvent.which <= 0xC0) //punctuation
            || (0xDB <= keypressEvent.which && keypressEvent.which <= 0xDF) //punctuation
            ;
    }

    /*
        The overall goal of the messageAllTabs function is to send a message to all tabs in the current window,
        and optionally execute a function after each tab has responded to the message.
    */
    static messageAllTabs(message, callback) {
        // Query all tabs in the current window
        try {
            BROWSER.tabs.query({ lastFocusedWindow: true }, (tabs) => {
                // For each tab
                for (const TAB of tabs)
                    this.messageATab(TAB.id, null, message, callback);
            });
        } catch (error) {
            debugLog('messageAllTabs BROWSER.tabs.query error', error);
        }
    }

    static messageATab(tabId, contentId, message, callback) {

        if (REQUEST.CAN_WE_COMMUNICATE === message)	// prepare to track the replies
            this.Globals.responseTracker[tabId] = {
                responded: false
            };

        try {
            message.contentId = contentId;
        } catch (error) {
            // if we have a object, then we can set the contentid, if it's a string, it's a simple broadcast message not directed at a content
        }

        async function messageTab(tabId, contentId, message) {
            let tab;
            try {
                void BROWSER.runtime.lastError;
                // Check if the tab is still open - but might have a stale content script not listening..
                if (tabId)  // if we don't have a tabid, then we have no content listening, so don't dispatch
                    // trying to check to see if the tab open returns and doesn't resolve the promise
                    tab = await BROWSER.tabs.get(tabId);

                if (tab) {
                    return new Promise((resolve, reject) => {
                        // Send the message to the tab
                        try {
                            BROWSER.tabs.sendMessage(
                                tabId,
                                message,
                                { frameId: contentId },
                                (response) => {
                                    void BROWSER.runtime.lastError;
                                    if (response) {   // we can get a -1 frameid from popup
                                        resolve(response);
                                    }
                                    //else
                                    //    reject('because:' + response);
                                });
                        } catch (error) {
//                            if (false == (error || error.message)?.includes('No tab'))
                                LogMessage(LOG_TYPE.WARN, `Can't send ${message || message.message} to tab:${toastStrong(tabId)}`, toastStrong(error));
                            void BROWSER.runtime.lastError;
                        }
                    }).catch(error => {
                        void BROWSER.runtime.lastError;
                        // Handle different types of errors that can occur when sending messages to tabs
                        if (!error.message && 'because' === error.slice(0, 7))
                            debugLog(`Message [${toastStrong(message.message)}]<br>Got no response.`, error);
                        else
                            switch (error.message) {
                                // If the message context or extension context is invalidated, log a warning message
                                case "Message context invalidated.":
                                case "Extension context invalidated.":
                                    LogMessage(LOG_TYPE.WARN, "Tab Messaging Error",
                                        "Ottomatic has been reloaded since the recording began, and tab ID " +
                                        tabId +
                                        " is now stale.");
                                    break;

                                // If the receiving end of the message does not exist (i.e., the tab has closed), log a warning message
                                case "Could not establish connection. Receiving end does not exist.":
                                    LogMessage(LOG_TYPE.WARN, "Tab Messaging Error",
                                        "Tab ID " +
                                        tabId +
                                        " has closed since recording began."
                                    );
                                    break;
                                // Otherwise, re-throw the error
                                default:
                                case "The message port closed before a response was received.":
                                    LogMessage(LOG_TYPE.WARN, "Default: Tab Messaging Error", error.message);
                            }
                    });
                }
            } catch (error) {
                if (BROWSER.runtime.lastError && false == BROWSER.runtime.lastError.includes('No tab'))
                    LogMessage(LOG_TYPE.WARN, `${toastStrong('Tab closed.')}\nCan\'t send [${toastStrong(message.message ? message.message : message)}]\nto tab ${tabId}`, toastStrong(error));
            }
            void BROWSER.runtime.lastError;
        }
        async function sendTabMessage() {
            let x;
            if (callback)
                x = await messageTab(tabId, contentId, message);
            else
                messageTab(tabId, contentId, message);

            // If a callback function is provided, execute it with the response as the argument
            if (x && typeof callback === "function")
                callback(x);
        }

        return sendTabMessage();
    }
    ///////////////////////
    // Background Message Handler- read from popup
    ///////////////////////

    // captureVisibleTab allows 2 calls/second: captures are spaced out and a quota rejection is retried once
    static lastCaptureAt = 0;
    static CAPTURE_SPACING_MS = 600;   // just over the 2/second the browser allows

    static captureThrottled(whenDone, attempt = 0) {
        const wait = Math.max(0, Messaging.CAPTURE_SPACING_MS - (Date.now() - Messaging.lastCaptureAt));

        setTimeout(function () {
            Messaging.lastCaptureAt = Date.now();

            BROWSER.tabs.captureVisibleTab(function (stringImageData) {
                const err = BROWSER.runtime.lastError;

                if (!err) {
                    whenDone(stringImageData, null);
                    return;
                }

                // only a quota rejection is worth retrying
                if (attempt < 2 && true == String(err.message).includes('MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND'))
                    Messaging.captureThrottled(whenDone, attempt + 1);
                else
                    whenDone(null, err.message);
            });
        }, wait);
    }

    /* Defines a function to listen/handle incoming messages from other content/tabs/popup */
    static handleMessageForBackground(message, sender, functionSendResponse) {
        let responseVal = false;    // false, close port we returned value - true, leave port open for an async return
        debugLog(`[GPAL] bg received: ${message?.message ?? message} / persistence ${persistence ? 'loaded' : 'NOT LOADED'} / steps: ${persistence?.Workflow?.length}`);
        if (!message.message)
            switch (message) {
                case REQUEST.START_API:
                    Messaging.sendToNativeApp('start');
                    sendToPopup({ message: 'apiStarted' }); // assume it worked fine, notify popup to change button
                    break;

                case REQUEST.STOP_API:
                    Messaging.sendToNativeApp('stop');
                    sendToPopup({ message: 'apiStopped' }); // assumed it worked fine, notify popup to change button
                    break;

                case REQUEST.QUERY_API:
                    Messaging.sendToNativeApp('status');  // started or stopped read in readFromNativeApp
                    break;
                case 'die':
                    // the reload happens on the resulting disconnect
                    Messaging.sendToNativeApp('die');
                    break;
                case REQUEST.CLOSE_ME:
                    Globals.ignoreNextGoto = true;
                    setTimeout(() => { Globals.ignoreNextGoto = false }, 1000);   // ignore new tabs and any url changes for 5 seconds following a click event (why were told to ignore)
                    BROWSER.tabs.remove(sender.tab.id);
                    break;
                case REQUEST.GET_TOP_LEVEL_URL:
                    functionSendResponse(Globals.currentUrl);
                    break;
                case REQUEST.STOP_RECORDING:
                    // set now: this message can arrive before the popup's save, and the flush below would write isRecording back
                    if (persistence)
                        persistence.isRecording = false;

                    // a run still accumulating belongs in the workflow being stopped, not thrown away
                    WorkflowStep.flushScroll();
                    //BROWSER.debugger.detach({ tabId: Globals.currentTabID });
                    //BROWSER.contextMenus.update('GPALContextMenu', { enabled: false });   // no more using system context menu, we build our own
                    break;
                case REQUEST.START_RECORDING:
                    GPALTabs.recordingTabId = null;
                    GPALTabs.excursions.clear();
                    //BROWSER.contextMenus.update('GPALContextMenu', { enabled: true });   // no more using system context menu, we build our own
                    //BROWSER.debugger.attach({ tabId: Globals.currentTabID }, "1.2");
                    break;
                /* If the message is to take a screenshot */
                case REQUEST.RETAKE_IMAGE:
                    /* Captures a visible tab safely without nesting timers */
                    Messaging.messageATab(Globals.currentTabID, null, REQUEST.REMOVE_HIGHLIGHT, () => {
                        // Run capture immediately when the tab reports it removed the highlight
                        BROWSER.tabs.captureVisibleTab(function (stringImageData) {
                            // Check for runtime errors (like active window loss)
                            if (0 <= persistence.Workflow.length - 1) {
                                let selectorSet = Object.assign({}, SelectorSet.findSelector(message.data));

                                // we might have ancestors also put into the workflow
                                if (0 <= persistence.Workflow.length - 1) // set global last wfs
                                    Globals.lastWorkflowStep = Object.assign({}, persistence.Workflow[persistence.Workflow.length - 1]);
                                else
                                    Globals.lastWorkflowStep = undefined;

                                ImageHelper.cropImageByBoundingRectangle(   // this updates the wfs selectorset imagedata directly, we just have to acknowledge with a toast
                                    stringImageData,
                                    selectorSet,
                                    persistence.settings.marginSize,
                                    function (croppedImageData) {
                                        Persistence.savePersistence();
                                        LogMessage(LOG_TYPE.NOTICE, `Image Updated on<br>Selector: ${toastStrong(selectorSet.selectorName)}`)
//                                        setTimeout(() => { BROWSER.tabs.remove(sender.tab.id) }, 1000);
                                    }
                                );
                            }
                        });
                    });
                    responseVal = true; // Kept to ensure the channel stays open on function exit
                    break;
                case REQUEST.RELOAD_PERSISTENCE:
                    Messaging.messageAllTabs(REQUEST.RELOAD_PERSISTENCE2);
                    Persistence.reloadPersistence(true);    // for now, seems to take 3 times to ensure it syncs across frames, same with BG? iunno
                    break;
                case REQUEST.GET_MY_TAB_ID:
                    // on first startup, known behavior before things settle is the first request is mssing the tab.id, but retry anyway
                    try {
                        functionSendResponse(sender.tab.id);
                    } catch (error) {
                        try {
                            functionSendResponse(sender.tab.id);
                        } catch (error) {
                            try {
                                functionSendResponse(sender.tab.id);
                            } catch (error) { }
                        }
                    }
                    break;

                case REQUEST.GET_MY_FRAME_ID:
                    functionSendResponse(sender.frameId);
                    break;

                // we track url changes, which can happen if an anchor tag is clicked (we capture the url at the click and ignore the url change event)
                // if we leave the browser area, we could be going to type in a url, so then we capture that so we know a new url was typed in (or bookmark clicked)
                // so, if anchor is clicked, ignore capturing a url change, if nothing is clicked, capture url change
                case REQUEST.IGNORE_NEXT_GOTO:  // ignore next goto is only needed by background script
                    Globals.ignoreNextGoto = true;
                    //setTimeout(() => { Globals.ignoreNextGoto = false }, 5000);   // ignore new tabs and any url changes for 5 seconds following a click event (why were told to ignore)
                    debugLog('Ignore Next Goto');    // moving the mouse out of the document will reset this so they can enter url or click bookmark
                    break;

                case REQUEST.RESET_NEXT_GOTO:
                    Globals.ignoreNextGoto = false;
                    debugLog('Reset Next Goto');
                    break;

                case REQUEST.SHOW_GPAL_ON_CONTEXT_MENU:
                    GPALContextMenu.ShowGPALonSystemContext();
                    break;

                case REQUEST.SHOW_COPY_TO_CLIP_ON_CONTEXT:
                    GPALContextMenu.ShowCopyToClipboardOnSystemContext();
                    break;

                case REQUEST.TRANSLATE_TEXT:
                case REQUEST.COPY_SELECTED_TEXT:
                    Messaging.messageATab(Globals.currentTabID, Globals.currentContentID, message);
                    break;
                case REQUEST.DELETE_WORKFLOWSTEP:
                    WorkflowStep.deleteWorkflowStep(WorkflowStep.getLastWorkflowStep());
                    break;
            }
        else {
            switch (message.message) {
                case REQUEST.TAKE_SCREENSHOT2:
                    /* Captures a visible tab safely without nesting timers */
                    Messaging.messageATab(Globals.currentTabID, null, REQUEST.REMOVE_HIGHLIGHT, () => {
                        // Run capture immediately when the tab reports it removed the highlight
                        BROWSER.tabs.captureVisibleTab(function (stringImageData) {
                            // Check for runtime errors (like active window loss)
                            if (BROWSER.runtime.lastError) {
                                console.error(BROWSER.runtime.lastError.message);
                            } else {
                                Messaging.messageATab(Globals.currentTabID, 0, { message: REQUEST.COPY_IMAGE_DATA_TO_CLIPBOARD, selector: message.data, data: stringImageData });
                            }
                        });
                    });
                    responseVal = true;
                    break;
                case REQUEST.RETAKE_IMAGE2:
                    Messaging.messageATab(Globals.currentTabID, null, { message: REQUEST.RETAKE_IMAGE, data: message.data });    // ask one content script to do this for us. :)
                    break;
                case REQUEST.CAPTURE_THEN_RESPOND:
                    /* Capture visible tab and respond directly with image data (used by clickThru to sequence screenshot before navigation) */
                    Messaging.messageATab(Globals.currentTabID, null, REQUEST.REMOVE_HIGHLIGHT, () => {
                        // throttled: runs on every pointerdown while recording with images
                        Messaging.captureThrottled(function (stringImageData, error) {
                            functionSendResponse(error ? null : stringImageData);
                        });
                    });
                    responseVal = true;
                    break;
                case REQUEST.TAKE_SCREENSHOT:
                    /* Captures a visible tab safely without nesting timers */
                    Messaging.messageATab(Globals.currentTabID, null, REQUEST.REMOVE_HIGHLIGHT, () => {
                        // always sent: content finishes the step on it; null data means no image
                        Messaging.captureThrottled(function (stringImageData, error) {
                            if (error)
                                debugLog(`[GPAL] capture failed, step keeps no image: ${error}`);

                            Messaging.messageATab(Globals.currentTabID, Globals.currentContentID, { message: REQUEST.SCREENSHOT_READY, data: stringImageData, step: message.step });
                            functionSendResponse(error || null);
                        });
                    });
                    responseVal = true;
                    break;
                case REQUEST.SEND_SELECTOR:
                case REQUEST.SEND_SELECTORS:
                case REQUEST.SEND_WORKFLOW:
                    Messaging.sendToNativeApp(message);
                    break;
                case REQUEST.SET_TOP_LEVEL_URL: // we get this from frame 0, top document, but any iframes have no idea... so broadcast this to them
                    Globals.currentUrl = message.url;
                    Messaging.messageATab(Globals.currentTabID, null, { message: REQUEST.SET_TOP_LEVEL_URL, url: message.url });
                    break;
                case REQUEST.SHOW_TOAST:
                    Messaging.messageATab(Globals.currentTabID, null, { message: REQUEST.SHOW_TOAST, title: message.title, contents: message.contents });
                    break;
                case REQUEST.SET_CURRENT_FRAME_ID:
                    //if (sender.tab.id && Globals.currentTabID !== sender.tab.id && true == persistence.isRecording)
                    //    try {
                    //    //    BROWSER.debugger.detach({ tabId: Globals.currentTabID });
                    //    //    BROWSER.debugger.attach({ tabId: Globals.currentTabID }, "1.2");
                    //    } catch { }     // we aren't attached yet

                    try {
                        Globals.currentTabID = sender.tab.id;
                    } catch {
                        try {
                            Globals.currentTabID = sender.tab.id;
                        } catch {
                            try {
                                Globals.currentTabID = sender.tab.id;
                            } catch {
                            }
                        }
                    }
                    Globals.currentContentID = message.contentId;
                    break;
                case REQUEST.GET_ANCESTOR_INFO:
                    (async () => {
                        let allAncestorData = [];                    //  changed name + type
                        let currentUrl = message.url;
                        let currentCss = message.css;
                        let currentReferrer = message.referrer;
                        let currentFrameId = sender.frameId;

                        const hierarchy = await Messaging.getFrameHierarchy(Globals.currentTabID);

                        while (currentFrameId !== -1) {
                            const frameInfo = hierarchy.map.get(currentFrameId);
                            if (!frameInfo) break;

                            currentFrameId = frameInfo.parentFrameId;

                            let resp = null;
                            if (currentFrameId !== 0) {
                                resp = await new Promise(resolve => {
                                    BROWSER.tabs.sendMessage(
                                        Globals.currentTabID,
                                        {
                                            message: REQUEST.GET_ANCESTOR_INFO2,
                                            url: currentUrl,
                                            css: currentCss,
                                            referrer: currentReferrer
                                        },
                                        { frameId: currentFrameId },
                                        r => resolve(r)
                                    );
                                });
                            } else {
                                resp = await new Promise(resolve => {
                                    BROWSER.tabs.sendMessage(
                                        Globals.currentTabID,
                                        {
                                            message: REQUEST.GET_ANCESTOR_INFO2,
                                            url: currentUrl,
                                            css: currentCss,
                                            referrer: currentReferrer
                                        },
                                        r => resolve(r)
                                    );
                                });
                            }

                            if (resp?.ancestorDataList) {
                                allAncestorData.unshift(...resp.ancestorDataList);   //  changed
                            }

                            if (!resp?.nextCss) {
                                break;
                            }

                            currentCss = resp.nextCss;
                            currentUrl = resp.nextUrl || currentUrl;
                        }

                        // Send result back to the originating frame (or whoever called waitForShadowInfoResult)
                        BROWSER.tabs.sendMessage(Globals.currentTabID, {
                            message: REQUEST.GET_SHADOW_INFO_RESULT,
                            data: allAncestorData,           //  now pure data, not WorkflowSteps
                            ancestorDataList: allAncestorData   // make both keys available for safety during transition
                        });
                    })();

                    responseVal = true;
                    break;
                case REQUEST.COPY_TO_CLIPBOARD:
                    Messaging.messageATab(Globals.currentTabID, 0, { message: message.message, data: message.data, label: message.label });
                    break;
                case REQUEST.RECORD_ACTION:
                    (async () => {
                      try {
                        await Persistence.ready();
                        if (workflowActions.SendKey == message.action && 13 === message.data.keyCode) { // Enter
                            let lastWorkflowStep = WorkflowStep.getLastWorkflowStep();
                            // NOTE: KLUDGE: we just left clicked on the same element we are recording an Enter, so don't record it
                            if (workflowActions.LeftClick == lastWorkflowStep.action && true == SelectorSet.boundingRectangleAreEquivalent(lastWorkflowStep.selectorSet.boundingRect, message.elementData.boundingRect))
                                return;
                        }

                        if (message.keys) step.keys = message.keys;

                        if (workflowActions.Hover == message.action) {
                            const withSelectorStep = WorkflowStep.fromElementData(
                                workflowActions.WithSelector,
                                message.elementData,
                                message.data
                            );

                            await WorkflowStep.addWorkflowStep(withSelectorStep);
                        }

                        const step = WorkflowStep.fromElementData(
                            message.action,
                            message.elementData,
                            message.data
                        );

                        await WorkflowStep.addWorkflowStep(step);
                      } catch (error) {
                        // an async handler's throw is otherwise a silent unhandled rejection
                        debugLog(`[GPAL] RECORD_ACTION failed: ${message?.action}`, error);
                      }
                    })();
                    break;
                case REQUEST.CLEAR_UPDATE_TARGET:
                    (async () => {
                      try {
                        await Persistence.ready();
                        persistence.elementToUpdateSelectorName = undefined;
                        Persistence.savePersistence();
                      } catch (error) {
                        debugLog('[GPAL] CLEAR_UPDATE_TARGET failed', error);
                      }
                    })();
                    break;
                case REQUEST.RECORD_SCROLL:
                    (async () => {
                      try {
                        await Persistence.ready();

                        if (true !== persistence.isRecording) return;

                        WorkflowStep.accumulateScroll(message.pixels, message.horizontal, message.containerData);
                      } catch (error) {
                        debugLog('[GPAL] RECORD_SCROLL failed', error);
                      }
                    })();
                    break;
                case REQUEST.SET_PREV_DOM:
                    (async () => {
                      try {
                        await Persistence.ready();

                        persistence.prevDOM = message.prevDOM;
                        Persistence.savePersistence();
                      } catch (error) {
                        debugLog('[GPAL] SET_PREV_DOM failed', error);
                      }
                    })();
                    break;
                case REQUEST.ATTACH_IMAGE:
                    // cropped image from content; applied here because the background owns persistence
                    (async () => {
                      try {
                        await Persistence.ready();

                        const named = persistence.Workflow.filter(step =>
                            step.selectorSet?.selectorName === message.selectorName);
                        const variableName = message.selectorName + "File";
                        const filename = message.selectorName + "Image" + '.' + persistence.settings.imageType.split('/')[1];

                        Variable.AddVariable(new Variable(variableName, VariableType.GPALFile, filename));

                        named.forEach(step => {
                            step.variableName = variableName;
                            step.selectorSet.imageData = message.imageData;
                            step.selectorSet.boundingRect = message.boundingRect;
                            step.selectorSet.absoluteLeft = message.absoluteLeft;
                            step.selectorSet.absoluteTop = message.absoluteTop;
                        });

                        const sel = SelectorSet.findSelector(message.selectorName);

                        if (sel) {
                            sel.imageData = message.imageData;
                            sel.boundingRect = message.boundingRect;
                            sel.absoluteLeft = message.absoluteLeft;
                            sel.absoluteTop = message.absoluteTop;
                        }

                        debugLog(`[GPAL] ATTACH_IMAGE ${message.selectorName}: ${named.length} step(s), selector ${sel ? 'found' : 'MISSING'} / steps: ${persistence.Workflow.length}`);
                        Persistence.savePersistence();
                      } catch (error) {
                        debugLog(`[GPAL] ATTACH_IMAGE failed: ${message?.selectorName}`, error);
                      }
                    })();
                    break;
                case REQUEST.RECORD_FULL_ACTION:
                    (async () => {
                      try {
                        await Persistence.ready();

                        const mainStep = WorkflowStep.fromElementData(
                            message.action,
                            message.mainElementData,
                            message.data
                        );
                        mainStep.keys = message.keys;

                        // drag deltas/offsets come from content at dragend, so step and selector commit in one write
                        if (message.dragData && mainStep.selectorSet) {
                            mainStep.selectorSet.deltaX = message.dragData.deltaX;
                            mainStep.selectorSet.deltaY = message.dragData.deltaY;
                            mainStep.selectorSet.offsetX = message.dragData.offsetX;
                            mainStep.selectorSet.offsetY = message.dragData.offsetY;
                        }

                        persistence.currentWorkflowStep = mainStep;
                        const added = await WorkflowStep.addWorkflowStep(mainStep);
                        debugLog(`[GPAL] RECORD_FULL_ACTION ${message.action} ${mainStep.selectorSet?.selectorName}: added=${added} / steps: ${persistence.Workflow.length} / selectors: ${persistence.selectorSets.length}`);

                        if (added) {
                            BROWSER.tabs.sendMessage(Globals.currentTabID, {
                                message: REQUEST.WORKFLOW_STEP_ADDED,
                                step: mainStep
                            }, { frameId: Globals.currentContentID });
                        }
                        // step, or null when blocked; the clickThru path uses it directly
                        Persistence.savePersistence(() => functionSendResponse(added ? mainStep : null));
                      } catch (error) {
                        debugLog(`[GPAL] RECORD_FULL_ACTION failed: ${message?.action}`, error);
                        // the content script is waiting on this port; leaving it open loses the step silently
                        try { functionSendResponse(null); } catch { }
                      }
                    })();
                    responseVal = true;
                    break;
                case REQUEST.REPLACE_LAST_STEP_WITH_CLICK:
                    WorkflowStep.deleteWorkflowStep();  // remove the WithSelector
                    let lastWorkflowStep = WorkflowStep.getLastWorkflowStep();
                    // change InShadowDom to LeftClick
                    lastWorkflowStep.action = workflowActions.LeftClick;
                    Persistence.savePersistence();
                    break;
                case REQUEST.REPLACE_LAST_STEP_WITH_BACK:
                    WorkflowStep.deleteWorkflowStep();  // remove the WithSelector
                    lastWorkflowStep = WorkflowStep.getLastWorkflowStep();
                    // change goto to back
                    lastWorkflowStep.action = workflowActions.Back;
                    Persistence.savePersistence();
                    break;
                case REQUEST.REPLACE_LAST_STEP_WITH_FORWARD:
                    WorkflowStep.deleteWorkflowStep();  // remove the WithSelector
                    lastWorkflowStep = WorkflowStep.getLastWorkflowStep();
                    // change goto to forward
                    lastWorkflowStep.action = workflowActions.Forward;
                    Persistence.savePersistence();
                    break;            }

            // Ignore any runtime errors
            void BROWSER.runtime.lastError;

            return responseVal;
        }
    }

    ///////////////////////
    // Content Message Handler
    ///////////////////////
    /*
        The overall purpose of this code below is to listen for messages sent from other parts of the
        extension or from content scripts, using the BROWSER.runtime.onMessage API. It checks the
        type of message received and takes appropriate action based on the message type.

        - objectMessage: the message that was sent
        - objectSender: information about the sender of the message
        - functionSendResponse: a function that can be used to send a response back to the sender of the message

        *** Content scripts are used to modify the appearance and behavior of web pages, and to communicate with the background script of the extension.

        * To do: what are 'THINGS', give better description
        * while recording, when you click on an element a screen shot is taken
        * possibly asks all tabs for permission

    */
    static handleMessageForContent(
        message,
        sender,
        functionSendResponse
    ) {
        let retval = false;
        let newWorkflowStep;
        /* Listen for messages from the extension popup */
        if (!message.message)
            switch (message) {
                case REQUEST.COPY_SELECTED_TEXT:
                    const selectedText = window.getSelection().toString();
                    if (selectedText)
                        Globals.selectedText = selectedText;
                    break;
                case REQUEST.TRANSLATE_TEXT:
                    try {
                        if (Globals.selectedText) {
                            // Replace 'si' with the selected text
                            const replacedText = 'https://translate.google.com/?sl=auto&tl=en&text=' + encodeURIComponent(Globals.selectedText) + '&op=translate';
                            // Open a new tab with the modified URL
                            window.open(replacedText, '_blank');
                        }
                    } catch (error) {
                        debugLog('Unable to get selected text');
                    }
                    break;
                /* Determine the type of message received */
                case REQUEST.CAN_WE_COMMUNICATE:
                    /* If the message is a request to check if communication is possible, 
                          send a response indicating that it is */
                    functionSendResponse(RESPONSE.YES_IT_SEEMS_WE_CAN);
                    break;
                case REQUEST.GET_SELECTOR:
                    persistence.getOneSelector = true;
                case REQUEST.START_RECORDING:
                    /* If the message is a request to start recording user actions, 
                          set the "isRecording" flag to true in the persistence object */
                    if (window.self === window.top)
                        showToast(LOG_TYPE.RECORDING, `${toastStrong('STARTED')}`);
                    persistence.isRecording = true;
                    functionSendResponse(true);
                    break;
                case REQUEST.STOP_RECORDING:
                    /* If the message is a request to stop recording user actions, 
                          set the "isRecording" flag to false in the persistence object */
                    if (true == persistence.isRecording && window.self === window.top)
                        showToast(LOG_TYPE.RECORDING, `${toastStrong('STOPPED')}`);
                    persistence.isRecording = false;
                    functionSendResponse(true);
                    break;
                case REQUEST.RELOAD_PERSISTENCE2:
                    // for whatever reasons, it takes 3 tries to sync persistence sometimes, could it be more if there are more iframes?
                    Persistence.reloadPersistence(true);
                    functionSendResponse(true);
                    break;
                case REQUEST.OTTOMATIC_RELOAD:
                    if (window.self === window.top)
                        LogMessage(LOG_TYPE.WARN, `Ottomatic was reloaded.<br>${toastStrong('PLEASE REFRESH PAGE')}`);
                    functionSendResponse(true);
                    break;
                case REQUEST.REMOVE_HIGHLIGHT:
                    if (Globals.currentEvent && Globals.currentEvent.target)  // some frames don't have this set yet (nothing hovered)
                        removeElementHighlight(Globals.currentEvent.target);
                    functionSendResponse(true);
                    break;
            }
        else {
            switch (message.message) {
                case REQUEST.COPY_IMAGE_DATA_TO_CLIPBOARD:
                    let selector = SelectorSet.fromSerialized(message.selector);
                    ImageHelper.getElementImage(
                        message.data,
                        selector,
                        () => {
                            Globals.copyObjectClassToClipboard(selector, selector.selectorName || "undefined", "imageData");
                        });
                    break;
                case REQUEST.PLAY_AUDIO:
                    const audio = new Audio(`${message.base64}`);
                    audio.play();
                    break;
                case REQUEST.COPY_TO_CLIPBOARD:
                    Globals.copyToClipboard(message.data, message.label);
                    break;
                case REQUEST.CONTEXT_MENU_CLICK:
                    if (Globals.currentContentID === message.contentId)
                        GPALContextMenu.handleMenuItemClick(message.data);
                    break;
                case REQUEST.SET_TOP_LEVEL_URL:
                    if (typeof Globals.currentUrl === 'undefined' || 0 !== Globals.currentContentID)     // if we are content 0, we initiated a broadcast to all frames to set their top level ur;
                        Globals.currentUrl = message.url;
                    functionSendResponse(true);
                    break;
                case REQUEST.RETAKE_IMAGE:
                    let element = document.querySelector(SelectorSet.findSelector(message.data).css);
                    if (message.contentId === Globals.currentContentID || element)
                        Messaging.sendMessageToBackground(REQUEST.RETAKE_IMAGE, (stringImageData) => {  // string data is the visible tab area
                            if (0 <= persistence.Workflow.length - 1) {
                                let selectorSet = Object.assign({}, SelectorSet.findSelector(message.data));

                                // we might have ancestors also put into the workflow
                                if (0 <= persistence.Workflow.length - 1) // set global last wfs
                                    Globals.lastWorkflowStep = Object.assign({}, persistence.Workflow[persistence.Workflow.length - 1]);
                                else
                                    Globals.lastWorkflowStep = undefined;

                                ImageHelper.cropImageByBoundingRectangle(   // this updates the wfs selectorset imagedata directly, we just have to acknowledge with a toast
                                    stringImageData,
                                    selectorSet,
                                    persistence.settings.marginSize,
                                    function (croppedImageData) {
                                        functionSendResponse(true);
                                        Persistence.savePersistence();
                                        LogMessage(LOG_TYPE.NOTICE, `Image Updated on<br>Selector: ${toastStrong(selectorSet.selectorName)}`)
                                        setTimeout(() => { BROWSER.tabs.remove(sender.tab.id) }, 1000);
                                    }
                                );
                            }
                        });
                    return true;
                    break;
                case REQUEST.TOAST_POSITION:
                    repositionToast(message.data);
                    functionSendResponse(true);
                    break;
                case REQUEST.SHOW_TOAST:
                    if (window.self === window.top)
                        functionSendResponse(showToast(message.title, message.contents));
                    break;
                case REQUEST.CONTEXT_MENU_ITEM1_CLICKED:
                    if (Globals.currentContentID === message.contentId)
                        functionSendResponse(showToast("Sucess", 'context menu item clicked'));   // a particular frame got the message back, but the toast always displays in the topmost document
                    break;
                case REQUEST.GET_ANCESTOR_INFO2:
                    if (true == doNotRespond) break;

                    (async () => {
                        let ancestorDataList = [];

                        const iframes2 = Messaging.findAllIframesIncludingShadow();

                        for (const iframe of iframes2) {
                            let iframeRealUrl = iframe.src;

                            // Try to get the actual loaded URL inside the iframe
                            try {
                                if (iframe.contentWindow && iframe.contentWindow.location) {
                                    iframeRealUrl = iframe.contentWindow.location.href;
                                }
                            } catch (e) {
                                // Cross-origin error is normal for Google Forms we just fall back to src
                            }

                            const url = iframe.src.toLowerCase();
                            const target = message.url.toLowerCase();

                            const isGoogleForm = url.includes('docs.google.com/forms') || url.includes('google.com/forms');
                            const targetIsForm = target.includes('docs.google.com/forms') || target.includes('google.com/forms');

                            // Generic fallback
                            const matches =
                                Messaging.isSameResource(iframe.src, message.url) ||
                                Messaging.isSameResource(iframe.src, message.referrer) ||
                                (isGoogleForm && targetIsForm);
                                
                             if (true == matches) {
                                let iframeDoc;
                                if (false == isGoogleForm && false == targetIsForm)
                                    iframeDoc = iframe.contentDocument || (iframe.contentWindow && iframe.contentWindow.document);

                                if ((true == isGoogleForm & true == targetIsForm) || (iframeDoc && Messaging.deepQueryExists(iframeDoc, message.css))) {

                                    const outerShadowData = WorkflowStep.getLocalContainingShadowSteps(iframe);
                                    ancestorDataList.unshift(...outerShadowData);

                                    ancestorDataList.unshift({
                                        action: "InIframe",
                                        elementData: Globals.serializeElement(iframe)
                                    });

                                    let responseData = { ancestorDataList };

                                    if (elementInIframe()) {
                                        let iframeCss = "";
                                        try {
                                            iframeCss = WorkflowStep.getUniqueSelector(iframe);
                                        } catch (e) {
                                            iframeCss = `iframe[src*="${iframe.src}"]`;
                                        }
                                        responseData.nextCss = iframeCss;
                                        responseData.nextUrl = window.location.href;
                                    }

                                    functionSendResponse(responseData);
                                    return;
                                }
                            }
                        }
                    })();
                    retval = true;
                    break;
                case REQUEST.SCREENSHOT_READY:
                    ImageHelper.takeScreenShot(message.data, message.step);
                    break;
                case REQUEST.WORKFLOW_STEP_ADDED:
                    const newWorkflowStep = message.step;
                    Globals.lastWorkflowStep = newWorkflowStep;  // store for clickThru screenshot sequencing

                    if (true === persistence.settings.withImage) {
                        // Trigger screenshot from background if needed
                        const needsScreenshot = [
                            workflowActions.LeftClick, workflowActions.AltLeftClick,
                            workflowActions.RightClick, workflowActions.AltRightClick,
                            workflowActions.Focus, workflowActions.AltFocus,
                            workflowActions.MoveTo, workflowActions.AltMoveTo,
                            workflowActions.Hover, workflowActions.AltHover,
                            workflowActions.WithSelector,
                            workflowActions.AltDragAndDrop, workflowActions.DragAndDrop,
                            workflowActions.SelectClick
                        ].includes(newWorkflowStep.action);


                        if (needsScreenshot) {
                            let sourceOfTruth = SelectorSet.findSelector(newWorkflowStep.selectorSet.selectorName);
                            // SelectClick on a closed dropdown has a zero-rect OPTION — skip, screenshot would be garbage
                            const selectHasBounds = newWorkflowStep.action !== workflowActions.SelectClick ||
                                (newWorkflowStep.selectorSet?.boundingRect?.width > 0 || newWorkflowStep.selectorSet?.boundingRect?.height > 0);
                            // The clickThru path sets imageData first, so the guard prevents a second capture; this covers
                            // tab-induced focusin and a failed clickThru capture.
                            // Prefer the pointerdown capture: taken before the page acted on the click.
                            const preClick = Globals.preClickCapture;
                            const preClickUsable = preClick
                                && preClick.imageData
                                && preClick.rect
                                && 3000 > Date.now() - preClick.at;

                            if (selectHasBounds && !newWorkflowStep.selectorSet.imageData && !sourceOfTruth?.imageData && preClickUsable) {
                                Globals.preClickCapture = null;   // one step per capture
                                ImageHelper.takeScreenShot(preClick.imageData, newWorkflowStep, undefined, preClick.rect);
                            }
                            else if (selectHasBounds && !newWorkflowStep.selectorSet.imageData && !sourceOfTruth?.imageData)
                                setTimeout(() => {
                                    try {
                                        Messaging.sendMessageToBackground({ message: REQUEST.TAKE_SCREENSHOT, step: newWorkflowStep });
                                    } catch (error) {
                                        if (true == error.toString().includes('extension context invalidated'))
                                            LogMessage(LOG_TYPE.WARN, `Ottomatic reloaded?<br> ${toastStrong('PLEASE REFRESH PAGE')}`);
                                        else
                                            LogMessage(LOG_TYPE.CRITICAL, 'Error saving workflow step.', error);
                                        Messaging.sendMessageToBackground(REQUEST.STOP_RECORDING);
                                        persistence.isRecording = false;
                                    }

                                }, 300);
                        }
                    }
                    //retval = true;
                    break;
            }
        }
        // Ignore any runtime errors
        void BROWSER.runtime.lastError;
        /* Return true to indicate that the response callback function will be called asynchronously */
        return retval;
    }

    static findAllIframesIncludingShadow() {
        const frames = [];

        function walk(root) {
            if (!root) return;

            // 1. Collect both <iframe> and <frame> elements
            if (root.querySelectorAll) {
                const iframes = root.querySelectorAll("iframe, frame");
                for (const f of iframes) {
                    frames.push(f);
                }
            }

            // 2. Walk into Shadow DOMs
            if (root.querySelectorAll) {
                const elements = root.querySelectorAll("*");
                for (const el of elements) {
                    if (el.shadowRoot) {
                        walk(el.shadowRoot);
                    }
                }
            }
        }

        walk(document);

        return frames;
    }
    static isElementContainedInIframe(elementRect, iframeRect) {
        return (
            elementRect.left >= iframeRect.left &&
            elementRect.top >= iframeRect.top &&
            elementRect.width <= iframeRect.width &&
            elementRect.height <= iframeRect.height
        );
    }

    static deepQueryExists(root, selector) {

        if (!root) return false;

        // 1. normal DOM match
        if (root.querySelector && root.querySelector(selector)) {
            return true;
        }

        // 2. walk shadow roots only
        const elements = root.querySelectorAll ? root.querySelectorAll("*") : [];

        for (const el of elements) {
            if (el.shadowRoot) {
                if (Messaging.deepQueryExists(el.shadowRoot, selector)) {
                    return true;
                }
            }
        }

        return false;
    }

    static async getFrameHierarchy(tabId) {
        return new Promise(resolve => {
            BROWSER.webNavigation.getAllFrames({ tabId }, frames => {
                const map = new Map();           // frameId > frame info
                const children = new Map();      // parentId > [childIds]

                for (const f of frames) {
                    if (f.documentLifecycle !== 'active') continue;

                    map.set(f.frameId, f);

                    const parentId = f.parentFrameId !== -1 ? f.parentFrameId : null;
                    if (parentId !== null) {
                        if (!children.has(parentId)) children.set(parentId, []);
                        children.get(parentId).push(f.frameId);
                    }
                }
                resolve({ map, children, allFrames: frames });
            });
        });
    }

    static isSameResource(url1, url2) {
        if (!url1 || !url2) return false;

        const u1 = url1.toLowerCase();
        const u2 = url2.toLowerCase();

        // Exact match
        if (u1 === u2 || u1.includes(u2) || u2.includes(u1)) {
            return true;
        }

        try {
            const p1 = new URL(u1);
            const p2 = new URL(u2);

            // Same hostname + significant path overlap
            if (p1.hostname === p2.hostname) {
                const path1 = p1.pathname.replace(/\/$/, '');
                const path2 = p2.pathname.replace(/\/$/, '');

                // One path is prefix of the other (common with wrapper frames)
                if (path1.startsWith(path2) || path2.startsWith(path1)) {
                    return true;
                }

                // Share long common path segment (e.g. /forms/d/ vs /forms/d/e/)
                const segments1 = path1.split('/').filter(Boolean);
                const segments2 = path2.split('/').filter(Boolean);

                // Check for at least 2 common segments in order
                for (let i = 0; i < Math.min(segments1.length, segments2.length) - 1; i++) {
                    if (segments1[i] === segments2[i] && segments1[i + 1] === segments2[i + 1]) {
                        return true;
                    }
                }
            }

            // Special common embed patterns
            if ((p1.hostname.includes('google.com') && p2.hostname.includes('google.com')) ||
                (p1.hostname.includes('youtube.com') && p2.hostname.includes('youtube.com'))) {
                return true;
            }

        } catch (e) {
            // malformed URL fallback
        }

        return false;
    }

    static sendMessageWithTimeout(tabId, messageType, messageData, functionSendResponse) {
        let responseHandled = false;
        //setTimeout(() => {
        //    if (!responseHandled) {
        //        responseHandled = true;
        //        functionSendResponse([]);  // no response from any content in 5 seconds, nobody has it, send empty response
        //    }
        //}, 750);

        Messaging.messageATab(tabId, null, {
            message: messageType,
            ...messageData
        }, (response) => {
            if (responseHandled) return;
            responseHandled = true;
            if (BROWSER.runtime.lastError) {
                void BROWSER.runtime.lastError;
                functionSendResponse([]);
            } else if (response) {
                functionSendResponse(response);
            }
        });
    }
}