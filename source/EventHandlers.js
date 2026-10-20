// for drag and drop recording
const movementThreshold = 8; // KLUDGE: Adjust as needed - we move the mouse on each click, enough to be considered a drag event. so, do not detect drags under 8 pixels
const timeThreshold = 300; // Adjust as needed

//===============
// Handlers
//===============
async function handleKeyPress(event) {
    if (!persistence || !persistence.isRecording) return;

    Globals.keypressEvent = event;

    // the keys that move focus on their own. Enter counts because it moves off a button or submits, and both
    // land focus somewhere new
    if ('Tab' === event.key || 'Enter' === event.key || event.key?.startsWith('Arrow'))
        Globals.focusKeyAt = Date.now();

    let normalKeysPressed = false;
    let changedKeys;
    let modWorkflowStepData = null;

    if ((event.which >= 16 && event.which <= 18) || 91 == event.which) {
        pressModifierKeys(event);
    } else {
        changedKeys = getChangedKeys(prevModKeys, Globals.modifierKeys);
        prevModKeys = { ...Globals.modifierKeys };

        if (Globals.modifierKeysPressed && changedKeys.akeychanged) {
            modWorkflowStepData = {
                action: workflowActions.PressModifierKey,
                data: changedKeys,
                elementData: Globals.serializeElement(event.target)
            };
        }
    }

    if ("Enter" === event.key || "NumpadEnter" === event.key) {
        normalKeysPressed = true;
    } else if (!(16 <= event.which && event.which <= 18)) {
        normalKeysPressed = true;
    }

    let shiftAlone = !Globals.modifierKeys.Alt && !Globals.modifierKeys.Control &&
        !Globals.modifierKeys.Meta && Globals.modifierKeys.Shift;

    if ((Globals.modifierKeysPressed && normalKeysPressed && !shiftAlone) ||
        (normalKeysPressed && !isInTextField(event)) ||
        "Tab" === event.key) {

        const elementData = Globals.serializeElement(event.target);

        if (modWorkflowStepData) {
            Messaging.sendMessageToBackground({
                message: REQUEST.RECORD_ACTION,
                action: modWorkflowStepData.action,
                data: modWorkflowStepData.data,
                elementData: elementData,
                frameId: Globals.currentContentID
            });
        }

        if ("Tab" === event.key) {
            // Only capture FillInFrom when Tab leaves an editable field that has a value.
            // Non-editable targets (buttons, reset, submit, etc.) have nothing to fill in —
            // the focusin handler records the destination element (AltFocus) instead.
            if (!Globals.lastChangeEvent && Globals.isElementEditable(event.target)) {
                if (true == Globals.debug)
                    console.log("record fill in from " + event.target.value || event.target.text);
                recordUserInput(event);
            }
        } else if (("Enter" === event.key || "NumpadEnter" === event.key) &&
                   !Globals.isElementEditable(event.target) &&
                   Globals.isElementClickable(event.target)) {
            // Enter on a focused button/submit: Chrome submits the form as the keydown
            // default action before the click event fires, so recordUserActions never sees it.
            // Prevent the default here, record as LeftClick (with screenshot if enabled),
            // then activate the element after recording completes.
            event.preventDefault();
            const buttonEl = event.target;
            Messaging.sendMessageToBackground({ message: REQUEST.SET_CURRENT_FRAME_ID, contentId: Globals.currentContentID });
            Messaging.sendMessageToBackground({ message: REQUEST.SET_TOP_LEVEL_URL, url: window.top.location.href });
            recordEvent(event, workflowActions.LeftClick, (responseStep) => {
                const activate = () => buttonEl.click();
                if (persistence.settings.withImage && responseStep) {
                    Messaging.sendMessageToBackground({ message: REQUEST.CAPTURE_THEN_RESPOND }, (stringImageData) => {
                        if (stringImageData)
                            ImageHelper.takeScreenShot(stringImageData, responseStep, activate);
                        else
                            activate();
                    });
                } else {
                    activate();
                }
            }, event.target);
        } else {
          Messaging.sendMessageToBackground({
                message: REQUEST.RECORD_ACTION,
                action: workflowActions.SendKey,
                data: { keyCode: Messaging.getAsciiCharOrKeycode(event.which, event.key) },
                elementData: elementData,
                frameId: Globals.currentContentID
            });
        }
    }
}

async function handleKeyRelease(event) {
    if (!persistence || !persistence.isRecording) return;

    releaseModifierKeys(event);

    let changedKeys = getChangedKeys(prevModKeys, Globals.modifierKeys);
    let shiftAlone = !changedKeys.Alt && !changedKeys.Control && changedKeys.Shift;

    prevModKeys = { ...Globals.modifierKeys };

    if (changedKeys.akeychanged && !shiftAlone) {
        Messaging.sendMessageToBackground({
            message: REQUEST.RECORD_ACTION,
            action: workflowActions.ReleaseModifierKey,
            data: changedKeys,
            elementData: Globals.serializeElement(event.target),
            frameId: Globals.currentContentID
        });
    }
}

//async function handleKeyPress(event) {
//    let normalKeysPressed = false;
//    let changedKeys;
//    let modWorkflowStep;

//    if (persistence && persistence.isRecording) {
//        Globals.keypressEvent = event;
//        let changeEvent = new Event('change');
//        changeEvent = Object.assign({}, changeEvent, { target: event.target });

//        // press modifiers in our structure to use when a alpha key is pressed
//        // Check if at least one modifier key is pressed (Alt, Control, Shift)
//        if ((event.which >= 16 && event.which <= 18) || 91 == event.which) { // alt,ctrl, shift, meta - seems we don't get meta key press, so we will check on clicks
//            // Update the modifier object
//            pressModifierKeys(event);
//        } else {
//            changedKeys = getChangedKeys(prevModKeys, Globals.modifierKeys);
//            //save the keys
//            prevModKeys = { ...Globals.modifierKeys };

//            if (Globals.modifierKeysPressed && changedKeys.akeychanged) {
//                // Create a workflowStep for the modifier key, have it ready for when we detect a normal keypress below
//                modWorkflowStep = new WorkflowStep(
//                    event,
//                    persistence.indices,
//                    'PressModifierKey',
//                    changedKeys
//                );
//            }
//        }

//        // if no alpha key is pressed, we are uninterested
//        if ("Enter" === event.key || "NumpadEnter" === event.key)   // enter or tab, if we don't have the text yet, go get it
//        {
//            normalKeysPressed = true;   // enter is normal key
//            if (false == Globals.tabOrEnterPressed) {
//                Globals.tabOrEnterPressed = true;
//                if (event)
//                    if (isAnInputThatDoesNotAcceptEnter(event)) {
//                        if (!Globals.lastChangeEvent) { /// did we already get the text out of it? no, so go get it before recording the ENTER
//                            recordUserInput(changeEvent);

//                            // Save modifiers to workflow
//                            WorkflowStep.addWorkflowStep(modWorkflowStep);

//                            // Create a workflowStep for the non-modifier key
//                            let normWorkflowStep = new WorkflowStep(
//                                event,
//                                persistence.indices,
//                                workflowActions.SendKey,
//                                { keyCode: Messaging.getAsciiCharOrKeycode(event.which, event.key) } // ascii char or vkcode
//                            );
//                            // Save to workflow
//                            WorkflowStep.addWorkflowStep(modWorkflowStep);
//                        } else {
//                            Globals.lastChangeEvent = undefined;  // got here from onchange firing
//                        }
//                        return;
//                    }
//            } else {
//                Globals.tabOrEnterPressed = false;
//                Globals.lastChangeEvent = undefined;  // got here from onchange firing
//            }
//        }
//        else if (!(16 <= event.which && event.which <= 18)) {   // not modifieres?
//            // Check if a non-modifier key is pressed (a, b, c, etc.)
//            normalKeysPressed = true;
//            Globals.tabOrEnterPressed = false;
//        }

//        let shiftAlone = false == Globals.modifierKeys.Alt && false == Globals.modifierKeys.Control && false == Globals.modifierKeys.Meta && true == Globals.modifierKeys.Shift;

//        // If you are in an input, only capture a key with a modifier key
//        // If they are both pressed and same key is not being held, create a workflowStep
//        // todo: setting to capture keystrokes and not fillin
//        if ((Globals.modifierKeysPressed && normalKeysPressed && !shiftAlone) || (normalKeysPressed && !isInTextField(event)) || "Tab" === event.key) {   // arow or directi0n keys?
//            if (modWorkflowStep)    // if we are defined, we have modifiers to press
//                // Save to workflow
//                WorkflowStep.addWorkflowStep(modWorkflowStep);

//            // we tabbed out of an input, but did not capture the text. so fire the onchange event
//            if ("Tab" === event.key && !Globals.lastChangeEvent) {
//                Globals.tabOrEnterPressed = true;
//                recordUserInput(event);
//            } else {

//                // Create a workflowStep for the non-modifier key
//                let normWorkflowStep = new WorkflowStep(
//                    event,
//                    persistence.indices,
//                    workflowActions.SendKey,
//                    { keyCode: Messaging.getAsciiCharOrKeycode(event.which, event.key) } // ascii char or vkcode
//                );

//                // Save to workflow
//                WorkflowStep.addWorkflowStep(normWorkflowStep);
//            }
//        }
//    }
//}

// we only care about modifier keys being released
//async function handleKeyRelease(event) {
//    if (persistence && persistence.isRecording) {
//        //update the modifier object
//        releaseModifierKeys(event);

//        //check which keys went from true to false by comaparing saved to current keys
//        let changedKeys = getChangedKeys(prevModKeys, Globals.modifierKeys);

//        let shiftAlone = false == changedKeys.Alt && false == changedKeys.Control && true == changedKeys.Shift;

//        prevModKeys = { ...Globals.modifierKeys };

//        if (changedKeys.akeychanged && !shiftAlone) {
//            //create a workflowStep for released modifier keys
//            let workflowStep = new WorkflowStep(
//                event,
//                persistence.indices,
//                WorkflowActions.releaseModifierKeys,
//                changedKeys
//            );

//            // Save to persistence
//            WorkflowStep.addWorkflowStep(workflowStep);
//        }

//        // LogMessage(LOG_TYPE.DEBUG, 'released:', event.key);
//    }
//}

function unhandledRejection(event) {
    // Prevent the default behavior of the event, which is to log the error to the console
    event.preventDefault();

    // Access the error that caused the rejection
    const error = event.reason;
    if (event.type === 'unhandledrejection') {
        debugLog('unhandled rejection', error);
        return;
    } else if (true == error.message.includes('QUOTA_BYTES quota exceeded')) {
        LogMessage(LOG_TYPE.CRITICAL, `${toastStrong('WORKFLOW TOO BIG')}<br>Try turning off images<br>or break up the workflow.`);
    } else if (true == error.message.includes('A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received')) {
        debugLog(error.message);
    } else if (true == error.message.includes('Extension context invalidated.')) {
        LogMessage(LOG_TYPE.WARN, `Ottomatic Reloaded?\n${toastStrong('PLEASE REFRESH PAGE.')}`);
    } else {
        // Handle the error as desired
        LogMessage(LOG_TYPE.WARN, `Unexpected rejection<br>${toastStrong('PLEASE RFRESH PAGE.')}`, error);
    }
    Messaging.messageAllTabs(REQUEST.STOP_RECORDING); //send a message to all tabs to stop recording, this tab errored unexpectedly
    persistence.isRecording = false;
    Persistence.savePersistence();
}

function handleFormSubmission(event) {
    if (true === persistence.isRecording && !Globals.lastChangeEvent) {
        Globals.currentEvent = event;
        Messaging.sendMessageToBackground(REQUEST.IGNORE_NEXT_GOTO);

        //if (true == event.target.gpalAllowPropagationNowThatThisThingHasBeenRemembered) {
        //    event.target.gpalAllowPropagationNowThatThisThingHasBeenRemembered = false;
        //} else {
            //event.stopImmediatePropagation();
            //event.preventDefault();
            if ("input" === Globals.currentEvent.target.tagName.replaceAll("-", "").toLowerCase()) // remove dashes from tag name
            {
                if (true == Globals.tabOrEnterPressed) {
                    Globals.tabOrEnterPressed = false;
                    recordUserActions(Globals.currentEvent);
                }
            }
            //event.target.gpalAllowPropagationNowThatThisThingHasBeenRemembered = true;
            //event.target.dispatchEvent(event);
        //}
    }
}

// start drag and drop recording, only if the target is marked as draggable, else we will check on mouse move
// mousedown event
function beginDragAndDrop(mouseEvent) {
    if (persistence && persistence.isRecording && true === persistence.settings.recordDragNDrop && false == isItToast(mouseEvent.target)) {
        Globals.currentEvent = mouseEvent;
 
        if (mouseEvent.buttons && false === Globals.dragAndDropInProgress) {   // left mouse down
            if (Globals.isDraggable(mouseEvent.target)) {
                Globals.dragAndDropInProgress = true;   // Possible start - if not draggable element, we will determine on mouse move if button is depressed
                Globals.ignoreClickEvent = true;
                Globals.draggedElement = mouseEvent.target;
                Globals.startX = mouseEvent.clientX;    // locatioin in element
                Globals.startY = mouseEvent.clientY;    // locatioin in element

                Messaging.sendMessageToBackground({ message: REQUEST.SET_CURRENT_FRAME_ID, contentId: Globals.currentContentID });    // ensure background knows we are the focused content window
                Messaging.sendMessageToBackground({ message: REQUEST.SET_TOP_LEVEL_URL, url: window.top.location.href })
            }
        }
    }
}


/*
 1. In summary, this code below records the clicking of non-left mouse buttons and logs information about the event
 and the target element.
 2. Each case represents a different mouse button that could have been clicked, and the corresponding code block within each case is executed when the value of objectMouseEvent.button matches that case.
 3. Most mice have only 2 
*/
// mouseup event
function recordUserActivity(mouseEvent) {
    if (persistence && persistence.isRecording && false == isItToast(mouseEvent.target)) {
        let isDraggable = Globals.isDraggable(mouseEvent.target);

        if (2 == mouseEvent.button) {
            if (document.activeElement !== mouseEvent.currentTarget)    // NOTE: right click in input will fire focus in, but maybe we are updating the image... do not record rightclicks in inputs
                mouseEvent.target.ignoreNextFocusInEvent = true;
            return;     // right click, don't do anything, that's the context menu that wil record an action
        }

        if (true == Globals.ignoreClickEvent) {
            Globals.ignoreClickEvent = false;
            // The dismiss-click (e.g. context menu → left-click on input) still triggers focusin
            // before the click.  Set the flag so focusin is suppressed; the click records the step.
            if ('pointerdown' == mouseEvent.type &&
                (Globals.isElementEditable(mouseEvent.target) || Globals.isElementClickable(mouseEvent.target)))
                mouseEvent.target.ignoreNextFocusInEvent = true;
            return;
        }

        // Capture at pointerdown, the last moment the element surely exists as clicked; the rect is taken synchronously.
        // Not with clickThru, which captures on its own path.
        if ('pointerdown' === mouseEvent.type
            && true === persistence.settings?.withImage
            && true !== persistence.settings?.clickThru) {
            try {
                const capture = {
                    rect: JSON.parse(JSON.stringify(mouseEvent.target.getBoundingClientRect())),
                    target: mouseEvent.target,
                    at: Date.now(),
                    imageData: null
                };

                Globals.preClickCapture = capture;

                Messaging.sendMessageToBackground({ message: REQUEST.CAPTURE_THEN_RESPOND }, (stringImageData) => {
                    capture.imageData = stringImageData || null;
                });
            } catch (error) {
                Globals.preClickCapture = null;
                // The click still records, it just loses its before-image, which is worth knowing about.
                LogMessage(LOG_TYPE.ERROR, 'Unable to capture the image before this click.', error);
            }
        }

        /* callback function for the event */
        Globals.currentEvent = mouseEvent;
        Messaging.sendMessageToBackground({ message: REQUEST.SET_CURRENT_FRAME_ID, contentId: Globals.currentContentID });    // ensure background knows we are the focused content window
        Messaging.sendMessageToBackground({ message: REQUEST.SET_TOP_LEVEL_URL, url: window.top.location.href })

        if ("dragend" === mouseEvent.type | ("mouseup" === mouseEvent.type && true == isDraggable)) {
            // NOTE: for proper drag-and-drop, our mouse move might not see enough movement to cross the threshhold, so if we have a proper 'dragend' we don't care, it's not simulated
            if (true == Globals.dragAndDropInProgress && null != Globals.draggedElement && (true == Globals.dragAndDropStartRecorded || "dragend" === mouseEvent.type)) {
                // Deltas go with the record so the background writes step and selector together.
                // Globals.draggedElement, not mouseEvent.target, which is the drop zone on the mouseup fallback.
                try {
                    // offset = grab point relative to the element's top-left; playback releases at grab+delta, which must hit
                    // the drop zone for handlers using ev.target. At dragend a native drag's rect is still the pickup rect.
                    const pickupRect = Globals.draggedElement.getBoundingClientRect();
                    const dragData = {
                        deltaX: mouseEvent.clientX - Globals.startX,
                        deltaY: mouseEvent.clientY - Globals.startY,
                        offsetX: Globals.startX - pickupRect.left,
                        offsetY: Globals.startY - pickupRect.top,
                    };
                    recordEvent(mouseEvent, workflowActions.AltDragAndDrop, null, Globals.draggedElement, null, dragData);
                } catch (error) {

                }
            }
        } else if (persistence && persistence.isRecording && "mouseup" !== mouseEvent.type) {    // just pointerdown or click
            // if we have an A tag, context switching may prevent recording, so defer and emulate
            if ('pointerdown' == mouseEvent.type) {
                if ('A' === mouseEvent.target.tagName) {
                    mouseEvent.preventDefault();
                    mouseEvent.stopImmediatePropagation();
                    mouseEvent.stopPropagation();
                    Messaging.sendMessageToBackground(REQUEST.IGNORE_NEXT_GOTO);
                    mouseEvent.target.ignoreNextFocusInEvent = true;
                }
                else {
                    // focusin fires before click; suppress it so the click records the step instead.
                    // Covers editable inputs AND clickable non-editables (buttons, etc.) so that
                    // click-induced focusin is always suppressed regardless of recordFocus setting.
                    if (Globals.isElementEditable(mouseEvent.target) || Globals.isElementClickable(mouseEvent.target))
                        mouseEvent.target.ignoreNextFocusInEvent = true;
                    if (false == Globals.dragAndDropInProgress && true == isDraggable && true == persistence.settings.recordDragNDrop) {
                        Globals.draggedElement = mouseEvent.target;
                        Globals.dragAndDropInProgress = true;   // could be the start of a drag-and-drop?
                        Globals.startX = mouseEvent.clientX;    // locatioin in element
                        Globals.startY = mouseEvent.clientY;    // locatioin in element
                        mouseEvent.target.ignoreNextFocusInEvent = true;
                    }
                    return; // we are uninterested in pointerdown events unless we are clicking a A tag
                }
            }

            if (mouseEvent.button > 0) {
                /* check if extra mouse button was clicked */
                function recordClick() {
                    /* function to determine action name */
                    switch (mouseEvent.button) {
                        case 0:
                            return workflowActions.LeftClick;
                        case 1:
                            return "MiddleClick";
                        case 2:
                            return "PlaceHolder";    // RightClick - context menu, they will decide what they want to insert for this placeholder
                        case 3:
                            return "FourthClick";
                        case 4:
                            return "FifthClick";
                        case 5:
                            return "SixthClick";
                        case 6:
                            return "SeventhClick";
                        case 7:
                            return "EighthClick";
                        case 8:
                            return "NinthClick";
                        default:
                            return "UnrecognizedMouseButtonClick";
                    }
                }

                let clickType = recordClick();

                // don't record until we click on something in the context menu
                if (workflowActions.PlaceHolder !== clickType)
                    /* call recordEvent() function with event target and action name */
                    Messaging.sendMessageToBackground({ message: REQUEST.SET_CURRENT_FRAME_ID, contentId: Globals.currentContentID });    // ensure background knows we are the focused content window

                Messaging.sendMessageToBackground({ message: REQUEST.SET_TOP_LEVEL_URL, url: window.top.location.href })

                let lastWorkflowStep = WorkflowStep.getLastWorkflowStep();

                // an open WithSelector is completed in the background, see WorkflowStep.completeOpenSelector
                recordIt(mouseEvent, clickType, null, "pointerdown");
            }
        }
        Globals.dragAndDropStartRecorded = false;
        Globals.dragAndDropInProgress = false;
        Globals.draggedElement = undefined;
        Globals.startX = 0;
        Globals.startY = 0;
    }
}

    // helper to pierce shadowdom written by grok
    // there is no way to pierce a closed, instead we use the offsetx and y to get the click there, but input would have to be hardware

    function getRealTarget(event) {
        if (!event) return null;

        // composedPath gives the deepest VISIBLE element
        // for closed shadow this will be the host (exactly what we want)
        if (event.composedPath) {
            const path = event.composedPath();
            for (let i = 0; i < path.length; i++) {
                if (path[i].nodeType === Node.ELEMENT_NODE) {
                    return path[i];
                }
            }
        }

        return event.target;
    }


    //record html element clicked and info about it
    // click event
function recordUserActions(ClickEvent) {
    const realTarget = getRealTarget(ClickEvent);
    let isEditable = Globals.isElementEditable(realTarget);

    // right click on an input not already focused will focus, but we are accessing the context meny so don't do anything, the context menu wil record an action
    if ("focusin" == ClickEvent.type) {
        // Only keyboard focus is an action: window refocus and dialog close fire focusin too, and mouse focus is
        // covered by the click.
        if (Globals.FOCUS_KEY_WINDOW_MS < Date.now() - Globals.focusKeyAt)
            return;

        // recordFocus has no UI; it only affects Tab to a non-clickable, non-editable element (e.g. <div tabindex>)
        if (true == persistence.settings.recordFocus) {
            if (true === ClickEvent.target.ignoreNextFocusInEvent) {
                ClickEvent.target.ignoreNextFocusInEvent = false;
                return;
            }
        } else if (false == isEditable) {
            // Non-editable: only proceed if it's a clickable element (button, link, etc.)
            // reached via Tab — pointerdown sets ignoreNextFocusInEvent for click-induced focus,
            // so click-induced focusin is suppressed below and the click records LeftClick instead.
            if (!Globals.isElementClickable(realTarget)) {
                return;  // non-editable and non-clickable: always ignore
            }
            if (true === ClickEvent.target.ignoreNextFocusInEvent) {
                ClickEvent.target.ignoreNextFocusInEvent = false;
                return;  // click-induced focus on button: suppress, click records LeftClick
            }
            // Tab-induced focus on button/link: falls through to record AltFocus
        } else if (true === ClickEvent.target.ignoreNextFocusInEvent) {
            // focusin was caused by a mouse click on an editable element (pointerdown set this flag);
            // the click event fires next and records the step — suppress this one to prevent a duplicate.
            ClickEvent.target.ignoreNextFocusInEvent = false;
            return;
        }
    }

    /* Check if recording is currently enabled */
    if (persistence && persistence.isRecording && false == isItToast(ClickEvent.target)) {
        Messaging.sendMessageToBackground({ message: REQUEST.SET_CURRENT_FRAME_ID, contentId: Globals.currentContentID });
        Messaging.sendMessageToBackground({ message: REQUEST.SET_TOP_LEVEL_URL, url: window.top.location.href })
        // ensure background knows we are the focused content window
        Globals.lastChangeEvent = undefined;  // clear out flag indicating the last event
        Globals.currentEvent = ClickEvent;

        /* When clickThru is enabled, our synthetic re-dispatch clears the element flag and exits cleanly */
        if ('click' === ClickEvent.type && !ClickEvent.isTrusted && true === ClickEvent.target._gpalClickThruIgnore) {
            ClickEvent.target._gpalClickThruIgnore = false;
            return;
        }

        /* Check if the event target has a flag indicating that propagation is allowed */
        if (true == Globals.ignoreClickEvent) {
            Globals.ignoreClickEvent = false;
            // SelectClick (change) sets this to suppress the SELECT's own post-change click.
            // Dropdown SELECTs fire click AFTER change, so the SELECT click arrives here and is suppressed.
            // Listbox SELECTs fire click BEFORE change, leaving this flag set with no SELECT click following —
            // if the target isn't a SELECT, don't suppress; fall through and record the click normally.
            if ('SELECT' === ClickEvent.target.tagName)
                return;
        }
        if (ClickEvent.isTrusted) {
            /* Safety guard: if our own synthetic click somehow arrives as trusted, ignore it */
            if (true === ClickEvent.target._gpalClickThruIgnore) {
                ClickEvent.target._gpalClickThruIgnore = false;
                return;
            }

            /* clickThru mode: intercept the trusted click, record it, then re-dispatch a synthetic click */
            if ('click' === ClickEvent.type && persistence.settings.clickThru) {
                ClickEvent.preventDefault();
                ClickEvent.stopImmediatePropagation();
                ClickEvent.stopPropagation();
                if ('A' === ClickEvent.target.tagName)
                    Messaging.sendMessageToBackground(REQUEST.IGNORE_NEXT_GOTO);
                ClickEvent.target._gpalClickThruIgnore = true;
            } else if ('A' === ClickEvent.target.tagName) {
                /* If the event is trusted (i.e. not simulated), prevent its default action and stop propagation */
                ClickEvent.preventDefault();
                ClickEvent.stopImmediatePropagation();
                ClickEvent.stopPropagation();
                Messaging.sendMessageToBackground(REQUEST.IGNORE_NEXT_GOTO);
            }

            //ClickEvent.stopImmediatePropagation();
            //ClickEvent.preventDefault();

            /* Create a new pointer event that will be dispatched after the original event has been recorded */
            //let secondDispatch = new PointerEvent(ClickEvent.type, ClickEvent);
            let isCurrentShadowDom = isInShadow(ClickEvent.target);
            let lastWorkflowStep = WorkflowStep.getLastWorkflowStep();

            // Define a function to choose the appropriate action name based on whether the target is clickable (our best guess)
            // WithSelector is used to GetGrid and scrape that element altho it could be a click to clear an action or close a menu without a selection
            // but that would seem like a poor workflow step, so we assume clicking on a non-clickable item will eventually be used with GetGrid
            // NOTE: should we add GetGrid if the next click is a clickable Item?
            function chooseActionName() {
                if (false == Globals.isElementClickable(realTarget))
                    return workflowActions.WithSelector;
                else if ("focusin" == ClickEvent.type && false == isEditable)
                    return workflowActions.AltFocus;
                else
                    return workflowActions.LeftClick;
            };

            let newAction = chooseActionName();

            recordIt(ClickEvent, newAction, realTarget, "focusin");

            // Record the event target and the chosen action name, and provide a callback function to allow propagation after the event has been recorded
            
        }
    }
}

function recordIt(ClickEvent, newAction, realTarget, clickType) {
    // the step the background recorded, or null if blocked as a duplicate
    recordEvent(ClickEvent, newAction, (responseStep) => {
        if ('click' === ClickEvent.type && persistence.settings.clickThru) {
            const theTarget = realTarget || ClickEvent.target;
            const syntheticClickOptions = {
                bubbles: true, cancelable: true,
                clientX: ClickEvent.clientX, clientY: ClickEvent.clientY,
                screenX: ClickEvent.screenX, screenY: ClickEvent.screenY,
                ctrlKey: ClickEvent.ctrlKey, altKey: ClickEvent.altKey,
                shiftKey: ClickEvent.shiftKey, metaKey: ClickEvent.metaKey,
                button: ClickEvent.button, buttons: ClickEvent.buttons,
                view: window
            };
            const dispatchSyntheticClick = () => theTarget.dispatchEvent(new MouseEvent('click', syntheticClickOptions));

            if (persistence.settings.withImage && responseStep) {
                /* Capture screenshot now, before the synthetic click navigates the page.
                   responseStep is null when this click was a duplicate (blocked), so the
                   focusin path's WORKFLOW_STEP_ADDED fallback handles the screenshot instead. */
                const stepToCapture = responseStep;
                Messaging.sendMessageToBackground(
                    { message: REQUEST.CAPTURE_THEN_RESPOND },
                    (stringImageData) => {
                        if (stringImageData) {
                            ImageHelper.takeScreenShot(stringImageData, stepToCapture, dispatchSyntheticClick);
                        } else {
                            dispatchSyntheticClick();
                        }
                    }
                );
            } else {
                dispatchSyntheticClick();
            }
        } else {
            //ClickEvent.target.gpalAllowPropagationNowThatThisThingHasBeenRemembered = true;
            if ('undefined' !== typeof ClickEvent.target.href && clickType !== ClickEvent.type)
                if (ClickEvent.target.href && !ClickEvent.target.href.startsWith('javascript:')) {
                    if (ClickEvent.target.target === '_blank') {
                        window.open(ClickEvent.target.href, '_blank');
                    } else {
                        window.location.href = ClickEvent.target.href;
                    }
                }
                else {
                    try {
                        // This triggers all the original JavaScript attached to the element
                        ClickEvent.target.click();
                    } catch (e) {
                        console.error("Failed to replay click", e);
                    }
                }
        }

        if (true == Globals.getOneSelector) {   // from the menu or extension, to update a selector image we are just getting one we are not recording it, just faux recording...
            Globals.getOneSelector = false;
            // responseStep is the step the background just made from this click. This tab's copy of the workflow
            // gets it only after its storage reload, so its last step would still be the one before. A duplicate
            // click makes no step and answers null; its selector is then the last step's, which this tab has.
            var jsonSelector = responseStep ? responseStep.selectorSet : WorkflowStep.getLastWorkflowStep()?.selectorSet;
            Messaging.sendMessageToBackground({ message: REQUEST.SEND_SELECTOR, selectorSet: jsonSelector });  // in background
            Messaging.messageAllTabs(REQUEST.STOP_RECORDING); //send a message to all tabs to stop recording, this tab got the ONE selector
            persistence.isRecording = false;
        }

        //ClickEvent.target.dispatchEvent(secondDispatch);

        //else
        // NOTE: we may have a closed dom, or have clicked on a shadowdom element
        // this means we have an InShadowDom workflowstep that has to change to LeftClick
        // why? cause we can't switch to a shadowdom then look for the shadowdom in the shadowdom, we won't find it so change to LeftClick
        //if (true == isCurrentShadowDom) {
        //    Messaging.sendMessageToBackground({ message: REQUEST.REPLACE_LAST_STEP_WITH_CLICK });
        //WorkflowStep.deleteWorkflowStep();  // remove the WithSelector
        //lastWorkflowStep = WorkflowStep.getLastWorkflowStep();
        //// change InShadowDom to LeftClick
        //lastWorkflowStep.action = workflowActions.LeftClick;
        //}
    }, realTarget);
}

/*
The purpose of this code below is to prevent the user from accidentally closing the BROWSER window
or navigating away from the page while a recording is in progress. The code adds an event listener
for the "beforeunload" event, which fires when the user is about to leave the page.

- to do: before you the page is unloaded, he planned to block something, what did he plan
*/

/* When the page is about to be unloaded... */

function beforeUserLeavesPage(objectEvent) {
    /* Check if recording is currently in progress */
    if (persistence && persistence.isRecording) {

        /* If unloading should be suspended to prompt for confirmation */
        if (suspendUnloadToPromptForConfirmation) {
            /* Prevent the page from unloading */
            objectEvent.preventDefault();
            /* Set the return value to an empty string to display a prompt */
            objectEvent.returnValue = "";
        }
    }
}


/*
 In summary, this code below is used to capture user input and record it for later use in the extension.
 */
function recordUserInput(event) {
    /* Check if recording is enabled in the persistence object */
    if (persistence && persistence.isRecording) {
        if (true == Globals.ignoreClickEvent) { // we just did a set range?
            Globals.ignoreClickEvent = false;
            return;
        }
        Globals.currentEvent = event;
        if (Globals.lastChangeEvent) {  // possible keyboard repeat
            Globals.lastChangeEvent = undefined;
            return;
        } else
            Globals.lastChangeEvent = event;

        /* Determine the type of action that was performed */
        let actionName = "";
        let realTarget = getRealTarget(event);

        switch (event.target.tagName) {
            case "INPUT":
                /* If the changed element is not a text input, ignore */
                if (["text", "email", "password", "search", "number",
                    "date", "time", "datetime-local", "month", "week",
                    "color", "tel", "url"].includes(event.target.type))
                    actionName = workflowActions.FillInFrom;
                else if (["radio", "checkbox", "submit", "reset", "button", "image"].includes(event.target.type))
                    return;  // button-type inputs have no value to fill in; click event handles them
                else if ("range" === event.target.type) {
                    actionName = workflowActions.SetRange;
                    Globals.ignoreClickEvent = true;
                }
                else {    // what form of input is this?
                    actionName = workflowActions.FillInFrom;
                    LogMessage(LOG_TYPE.WARN, `Unknown Input type [${event.target.type}] default to FillInFrom`);
                    return;
                }

                break;
            case "SELECT":
                actionName = workflowActions.SelectClick;
                realTarget = event.target.options[event.target.selectedIndex];
                break;

            case "TEXTAREA":
                actionName = workflowActions.FillInFrom;
                break;

            case 'DIV':
                if (true == event.target.isContentEditable)
                    actionName = workflowActions.FillInFrom;
                else
                    actionName = workflowActions.LeftClick;
                break;

            default:
                actionName = workflowActions.LeftClick;;
                /* If the changed element is not an input, select, or textarea, do not record the action */
                return;
        }

        /* Record the action by calling the recordEvent() function */
        Messaging.sendMessageToBackground({ message: REQUEST.SET_CURRENT_FRAME_ID, contentId: Globals.currentContentID });
        Messaging.sendMessageToBackground({ message: REQUEST.SET_TOP_LEVEL_URL, url: window.top.location.href })

        recordEvent(event, actionName, () => {
            // event.target.gpalAllowPropagationNowThatThisThingHasBeenRemembered = false

            if (true == Globals.tabOrEnterPressed && Globals.keypressEvent) {
                // Send SendKey to background instead of creating locally
                Messaging.sendMessageToBackground({
                    message: REQUEST.RECORD_ACTION,
                    action: workflowActions.SendKey,
                    data: {
                        keyCode: Messaging.getAsciiCharOrKeycode(
                            Globals.keypressEvent.which,
                            Globals.keypressEvent.key
                        )
                    },
                    elementData: Globals.serializeElement(event.target),
                    frameId: Globals.currentContentID
                });
            }
        }, realTarget);
    }
}

// list of classes we do not outline as possible to select...
function isItToast(element) {
    try {
        const classesToCheck = ['gpal-popup-container', 'gpal-menuContent', 'gpal-popup-span', 'gpal-popup-menu', 'gpaltoast-container', 'gpaltoast', 'gpaltoast-title', 'gpaltoast-close', 'gpaltoast-close-container', 'gpaltoast-icon', 'gpaltoast-content-container', 'gpaltoast-message', 'gpaltoast-strong', 'gpaltoast-data'];
        const hasMatchingClass = classesToCheck.some(className => element.classList.contains(className));

        if (hasMatchingClass)
            return true;
        else
            return false;
    } catch {
        return false;
    }
}
/*
Function nelow used to identify what element is being selected by using a tooltip.
The tooltip is positioned above the element and follows the cursor as it moves.
The tooltip is also styled with a specific background color, font, outline, and size.
The purpose of this code is likely to aid in identifying and selecting elements on the
webpage during the recording process.
*/
// "mousemove" event handler
function highlightElementHovered(mouseEvent) {
    /* Check if the "persistence.isRecording" flag is set to true */
    if (persistence && persistence.isRecording) {
        //Globals.currentEvent = mouseEvent;  // do not save for drag and drop event
        if (!isItToast(mouseEvent.target)) {
            /* Check if the "suspendHighlightingToTakeScreenshot" flag is not set to true */
            if (!suspendHighlightingToTakeScreenshot) {
                if (0 === mouseEvent.buttons) { // not holding mouse down, so no drag-n-drop, so highlight
                    if (null !== Globals.hoverTimer) {
                        clearTimeout(Globals.hoverTimer);
                        Globals.hoverTimer = null;
                    }

                    Globals.previousEventTarget = Globals.currentEventTarget;
                    Globals.currentEventTarget = mouseEvent.target;

                    if (null == Globals.previousEventTarget)
                        Globals.previousEventTarget = Globals.currentEventTarget;

                    // check for recording hovers
                    if (true == persistence.settings.recordHoverFocus) {
                        Globals.hoverTimer = setTimeout(() => {
                            Globals.hoverTimer = null;

                            if (false == Globals.dragAndDropInProgress && Globals.currentEventTarget === Globals.previousEventTarget && Globals.currentHoverTarget !== Globals.currentEventTarget) {
                                Globals.currentHoverTarget = Globals.currentEventTarget;
                                const elementData = Globals.serializeElement(Globals.currentEventTarget);

                                Messaging.sendMessageToBackground({
                                    message: REQUEST.RECORD_ACTION,
                                    action: workflowActions.Hover,
                                    data: persistence.settings.waitForHover,
                                    elementData: elementData,
                                    frameId: Globals.currentContentID
                                });
                            }
                        }, persistence.settings.waitForHover * 100)
                    }

                    let element = mouseEvent.target;

                    /* Add a CSS class to the target element */
                    try {
                        if (true == persistence.settings.showHoverOutline)
                            mouseEvent.target.classList.add(HIGHLIGHTED_ELEMENT_CLASS);     // iunno, maybe when we right click we get something with no add?
                    } catch { }

                    if (true == persistence.settings.showHoverDetail && mouseEvent.target.getBoundingClientRect) {
                        tooltip.innerHTML = "";

                        /* Add a tooltip element to the body of the document */
                        document.body.appendChild(tooltip);

                        /* Set the style of the tooltip element */
                        tooltip.style["background"] = "rgba(0, 170, 203, 1)";
                        tooltip.style["color"] = "rgba(255, 255, 255, 1)";
                        tooltip.style["font-family"] = "sans-serif";
                        tooltip.style["font-size"] = "12px";
                        tooltip.style["outline"] = "2px solid rgba(0, 170, 203, 1.0)";
                        tooltip.style["font-size"] = "12px";
                        tooltip.style["position"] = "absolute";
                        tooltip.style["z-index"] = "2147483647";
                        tooltip.style["top"] =
                            mouseEvent.target.getBoundingClientRect().y -
                            20 + // 8 is really nice but gets in screen capture
                            window.scrollY +
                            "px";
                        tooltip.style["left"] =
                            mouseEvent.target.getBoundingClientRect().x + "px";

                        //if element is inside shadow dom, name it 'SHADOWDOM'
                        let isShadowDom = isInShadow(element);

                        if (isShadowDom)
                            tooltip.innerHTML = "&lt;" + "SHADOWDOM" + "&gt;";
                        tooltip.innerHTML += "&lt;" + element.tagName + "&gt;";
                        if ('IFRAME' === element.tagName) {
                            const url = new URL(element.src)
                            tooltip.innerHTML += `[${url.hostname.replace('www.', '').substring(0, 15)}]`
                        }
                        let canClick = Globals.isElementClickable(mouseEvent.target);
                        let canEdit = isInTextField(mouseEvent);
                        if (element.id)
                            tooltip.innerHTML += "[" + element.id + "]";
                        tooltip.innerHTML += " [" + (canClick ? "clickable" : "non-clickable") + "]";
                        tooltip.innerHTML += " [" + (canEdit ? "editable" : "non-editable") + "]";
                    }

                    if (true == persistence.settings.showGenericMatches)
                        toggleHighlightMatches(element, true);

                } else if (mouseEvent.buttons) {    // drag-n-drop
                    // Calculate the distance moved
                    var deltaX = Math.abs(mouseEvent.clientX - Globals.startX);
                    var deltaY = Math.abs(mouseEvent.clientY - Globals.startY);

                    // Calculate the time elapsed
                    //const elapsedTime = mouseEvent.timeStamp - mouseEvent.target.mousedownTime; // mouseDownTime does not exist, how'd i get that?

                    // Check if it's a drag-and-drop based on criteria and set flag indicating it has started
                    // do we have a delta change and dragging?
                    // NOTE: for simulated drag-and-drop, we track mouse movement with the mouse down, proper drag-and-drop will stop sending mouvemove, so this prolly won't pass the threshold
                    if ((deltaX >= movementThreshold || deltaY >= movementThreshold/* || elapsedTime >= timeThreshold*/) && (mouseEvent.buttons & 1) && false == Globals.dragAndDropStartRecorded && true == Globals.dragAndDropInProgress) {
                        Globals.dragAndDropStartRecorded = true;
                        //Globals.ignoreClickEvent = true;
                        Messaging.sendMessageToBackground({ message: REQUEST.SET_CURRENT_FRAME_ID, contentId: Globals.currentContentID });    // ensure background knows we are the focused content window
                        Messaging.sendMessageToBackground({ message: REQUEST.SET_TOP_LEVEL_URL, url: window.top.location.href })
                    //    recordEvent(mouseEvent, workflowActions.DragAndDrop, () => {    // we will use the initial pickup drag event, the dropoff event.target is not the picked up object
                    //        Messaging.sendMessageToBackground({ message: REQUEST.SET_CURRENT_FRAME_ID, contentId: Globals.currentContentID });    // ensure background knows we are the focused content window
                    //    });
                    }
                }
            }
        }
    }
}

function toggleHighlightMatches(element, hightlightOrRemove) {
    let fullxpath = new SelectorSet(element, null, false).fullXPath;
    let matches = SelectorSet.findMatchingXPaths(fullxpath);

    if (1 < matches.count)
        matches.matches.forEach(newElement => {
            if (element !== newElement)
                if (true == hightlightOrRemove)
                    newElement.classList.add(HIGHLIGHTED_DASHED_THIN_BLUE_ELEMENT_CLASS);
                else
                    newElement.classList.remove(HIGHLIGHTED_DASHED_THIN_BLUE_ELEMENT_CLASS);
        });

    // remove highlight
    // remove from all elements, sometimes moving around quickly would leave elements highlighted and never able to unhighlight, so do all that match each time
    if (false == hightlightOrRemove) {
        const elements = document.getElementsByClassName(HIGHLIGHTED_DASHED_THIN_BLUE_ELEMENT_CLASS);

        // Loop through the elements and remove the class
        for (let i = 0; i < elements.length; i++) {
            elements[i].classList.remove(HIGHLIGHTED_DASHED_THIN_BLUE_ELEMENT_CLASS);
        }
    }

    //if (true == hightlightOrRemove && 1 < matches.matches) {
    //    ShowNotification(LOG_TYPE.NOTICE, `Generic pattern\n${simplifiedXPath}`);
    //}

}
function elementHighlightRemoved(objectEvent) {
    if (persistence && true == persistence.isRecording) {
        removeElementHighlight(objectEvent.target);

        if (null !== Globals.hoverTimer) {
            clearTimeout(Globals.hoverTimer);
            Globals.hoverTimer = null;
        }
    }
}

function removeElementHighlight(objectElement) {

    try {
        /* Remove the CSS class that was added in the "mousemove" event handler */
        objectElement.classList.remove(HIGHLIGHTED_ELEMENT_CLASS);

        /* Remove the tooltip element from the document */
        if (document.body.contains(tooltip)) {
            async function removeTooltipAndTakeScreenshot() {
                return new Promise(resolve => {
                    document.body.removeChild(tooltip);
                    resolve();
                });
            }
            // can we do this synchronously so the tooltip is not in the image picture? we are having timing issues
            removeTooltipAndTakeScreenshot();
        }

        if (objectElement.classList.contains(HIGHLIGHTED_BOX_SHADOW_ELEMENT_CLASS))
            objectElement.classList.remove(HIGHLIGHTED_BOX_SHADOW_ELEMENT_CLASS);

        toggleHighlightMatches(objectElement, false);
    } catch (error) {
        //
    }
}
function handleContextMenu(event) {
    const target = getRealTarget(event);
    Globals.currentRightClickTarget = target;
    Globals.currentEvent = event;
    Globals.currentContextMenuEvent = event;
    Globals.ignoreClickEvent = true;    // do not capture a menu click as a workflowstep
    Messaging.sendMessageToBackground(REQUEST.COPY_SELECTED_TEXT);  // showing context menu will destroy selected text. could multiple tabs have selected text? yes, but we target the active tab

    if (persistence && persistence.isRecording) {
        // try creating a custom right click menu to replace the system menu

        // if we are right clicking the Tiny MCE editor, we have to use the system context menu. our custom menu gets inserted as a text list
        if (true == hasTinyMCEElement(target)) {     // we are over a Tiny MCE edit window, it will not display our custom context, it will display as a list
            GPALContextMenu.SendToBackgroundShowGPALContextMenu();  // display context menu with gpal submenu
        } else {    // we are recording and over an element, show our custom context menu
            GPALContextMenu.showCustomContextMenu(event, document.body);
        }
    } else { // we are not recording and have a valid right click, so show 'copy selector to clipboard'
        GPALContextMenu.SendToBackgroundShowCopyToClipContextMenu();
    }
}
//===============
// END OF Handlers
//===============
