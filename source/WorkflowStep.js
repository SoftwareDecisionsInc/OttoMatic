/*
This code defines a class called WorkflowStep which represents a workflow step and
provides methods for getting the containing frame or shadow host of an HTML element.

*/

//to do: basically a workflow step, should be renamed
class WorkflowStep {
    action; // action performed on element
    selectorSet; // selector information of element
    keys; //alt, shift, control, or none while clicking, also single keys.keycode
    timestamp;

    // for any action that has a parameter, separate from keys
    data;
    variableName;   // does this step have a variable parameter? it's name is this
    objectSourceElement;

    // constructor of WorkflowStep
    constructor(
        eventOrElement,
        modifiableObjectTagIndices,
        stringAction,
        data,
        realTarget
    ) {
        Globals.weAreSaving = true; // prevent any persistence loading while we are doing stuff

        if (null == stringAction || '' == stringAction)
            debugger;

        let weHaveEvent = false;
        if (eventOrElement && eventOrElement.target) {   // if we have .target we are an event
            this.objectSourceElement = realTarget || eventOrElement.target;
            weHaveEvent = true;
        } else {
            this.objectSourceElement = eventOrElement;
        }

        this.action = stringAction;

        //withselector must come with action that requires a selector
        // Creates a new SelectorSet object for the current objectSourceElement using the specified modifiableObjectTagIndices
        //Persistence.reloadPersistence().then(() => {
        switch (stringAction) {
            case workflowActions.AltLeftClick:
            case workflowActions.LeftClick:
                if (typeof contentId !== 'undefined')   // background
                    Globals.ignoreNextGoto = true;
                else
                    Messaging.sendMessageToBackground(REQUEST.IGNORE_NEXT_GOTO);
            case workflowActions.AltRightClick:
            case workflowActions.RightClick:
            case workflowActions.InIframe:
            case workflowActions.InShadowDom:
            case workflowActions.RetakeImage:
            case workflowActions.AltFocus:
            case workflowActions.Focus:
            case workflowActions.PlaceHolder:
            case workflowActions.WithSelector:
                this.selectorSet = this.createOrReuseSelectorSet(
                    this.objectSourceElement,
                    persistence.indices,
                    persistence,
                    stringAction
                );
                if (true == weHaveEvent) {
                    this.selectorSet.offsetX = eventOrElement.offsetX;   // mouse location inside element
                    this.selectorSet.offsetY = eventOrElement.offsetY;   // mouse location inside element
                }
                break;

            // we just need the text for workflow output, not a new selector
            // the selector will be created when the user clicks on the element to fill in
            case workflowActions.FillInFrom:
                this.selectorSet = this.createOrReuseSelectorSet(
                    this.objectSourceElement,
                    persistence.indices,
                    persistence,
                    stringAction
                );
                this.data = this.selectorSet.text;
                break;

            case workflowActions.AltHover:
            case workflowActions.Hover:
                // takes a selector like Focus, plus data (the hover duration)
                this.data = data;
                if (this.objectSourceElement) {
                    this.selectorSet = this.createOrReuseSelectorSet(
                        this.objectSourceElement,
                        persistence.indices,
                        persistence,
                        stringAction
                    );
                    if (true == weHaveEvent) {
                        this.selectorSet.offsetX = eventOrElement.offsetX;
                        this.selectorSet.offsetY = eventOrElement.offsetY;
                    }
                }
                break;

            case workflowActions.AltWaitFor:
            case workflowActions.WaitFor:
            case workflowActions.GoTo:  // bg and content
            case workflowActions.GoToTab:  // bg
            case workflowActions.CloseTab:  // bg
            case workflowActions.WithNewTab:    // bg
            case workflowActions.ScrollElementVertical:
            case workflowActions.ScrollElementHorizontal:
            case workflowActions.ScrollWindowVertical:
            case workflowActions.ScrollWindowHorizontal:
            case workflowActions.CastDesktop:
            case workflowActions.CastTab:
                this.data = data;
                break;

            case workflowActions.SendKey:
            case workflowActions.PressModifierKey:
            case workflowActions.ReleaseModifierKey:
                this.keys = data;
                break;

            // create variables
            case workflowActions.AndDownload:
                this.variableName = tempWorkflowStep.selectorSet.selectorName + "File";
                var filename = tempWorkflowStep.selectorSet.selectorName + "Image" + '.' + persistence.settings.imageType.split('/')[1];
                Variable.AddVariable(new Variable(this.variableName, VariableType.GPALFile, filename));   // now a GPALFile variable name
                break;
            case workflowActions.GetGrid:
                var index = persistence.indices["GPALGrid"] || 0;
                this.variableName = 'grid' + index;
                Variable.AddVariable(new Variable(this.variableName, VariableType.Grid, ''));
                persistence.indices["GPALGrid"] = ++index;
                break;

            case workflowActions.Back:
            case workflowActions.Forward:
            case workflowActions.Refresh:
                break;

            default:    // arbitrary default behavior cause this is all we can assume is safe...
                if (this.objectSourceElement) {
                    this.selectorSet = this.createOrReuseSelectorSet(
                        this.objectSourceElement,
                        persistence.indices,
                        persistence,
                        stringAction
                    );

                    if (true == weHaveEvent) {
                        this.selectorSet.offsetX = eventOrElement.offsetX;   // mouse location inside element
                        this.selectorSet.offsetY = eventOrElement.offsetY;   // mouse location inside element
                    }
                }
                break;
        }
        //Persistence.savePersistence();
        this.timestamp = getTimestamp();
        Globals.weAreSaving = false;

        // a live DOM node: Firefox's storage.local throws DataCloneError on it
        delete this.objectSourceElement;
        //});
        Persistence.savePersistence(() => {
            if (true == Globals.debug)
                console.log(`${Globals.nowAsShortDate()} - ${typeof contentId !== 'undefined' ? contentId : Globals.currentContentID} created workflowstep ${stringAction} / steps: ${persistence.Workflow.length} / selectors ${persistence.selectorSets.length}`);
        });
    }


    static getLocalContainingShadowSteps(element) {
        const ancestorData = [];

        let current = element;
        while (current && current !== document.documentElement) {
            let shadowRoot = null;
            try { shadowRoot = getShadowRoot(current); } catch (e) { }

            if (shadowRoot) {
                ancestorData.unshift({
                    action: "InShadowDom",
                    elementData: Globals.serializeElement(current)
                });
                current = current.parentNode;
                continue;
            }

            if (current instanceof ShadowRoot) {
                const host = current.host;
                current = (host && typeof host === "object") ? host : null;

            } else {
                current = current.parentNode;
            }
        }
        return ancestorData;
    }

    /**
     * Generates a unique CSS selector for a given HTML element.
     * @param {HTMLElement} el - The element to generate a selector for.
     * @returns {string} - The unique CSS selector.
     */
    static getUniqueSelector(el) {
        if (!(el instanceof Element)) return '';
        const path = [];

        while (el && el.nodeType === Node.ELEMENT_NODE) {
            let selector = el.nodeName.toLowerCase();

            if (el.id) {
                // CSS.escape handles IDs that start with numbers or contain special chars
                path.unshift(`#${CSS.escape(el.id)}`);
                break; // IDs are unique, so we can stop climbing the tree
            }

            // Only calculate nth-of-type if the element has siblings of the same tag
            let siblings = el.parentNode ? Array.from(el.parentNode.children).filter(e => e.tagName === el.tagName) : [];
            if (siblings.length > 1) {
                let index = siblings.indexOf(el) + 1;
                selector += `:nth-of-type(${index})`;
            }

            path.unshift(selector);
            el = el.parentNode;
        }

        return path.join(" > ");
    }

    //Function adds unique selectorSet to selectorSets
    createOrReuseSelectorSet(objectSourceElement, modifiableObjectTagIndices, persistence, stringAction) {
        // popup steps have no element
        if (!objectSourceElement)
            return undefined;

        // Used to assign new or reuse selectorSet, test first if we passed in a shadowdom element, we may mid- InShadowDom
        let newSet = new SelectorSet(objectSourceElement, persistence.indices, false);    // false - do not increment counters
        //Iterate over the source of truth: selectorSets
        if (persistence.selectorSets) {
            for (let selectorSet of persistence.selectorSets) {
                // check if the CSS and XPath selectors of the new SelectorSet match any of the existing ones
                // === is the best way to compare js string equivalence
                if (true == SelectorSet.areEquivalent(newSet, selectorSet, stringAction))
                    // path is the same, we already have this selector
                    // test to see if the text has changed from what we captured. if YES, then we need a unique selector to contain the new text
                    // but the old selector works to know the location of the element, so this one remains hidden, it's just used for text
                    // but the counter needs to increment since we refer to it internally
                    if (workflowActions.FillInFrom === stringAction && (selectorSet.value !== newSet.value || selectorSet.text !== newSet.text)) {    // are we filling in a string?
                        // we need a selector to create the workflowStep for the new text, but we don't need a new selector for code markup
                        // so don't add this selector to persistence.SelectorSets because that will produce markup, just for the workflow output
                        var x = new SelectorSet(objectSourceElement, persistence.indices, false, stringAction);
                        // FillInFrom does not truncate text
                        return x;
                    } else if (workflowActions.DragAndDrop === stringAction || workflowActions.AltDragAndDrop === stringAction) {
                        break;  // create new
                    } else {
                        // a match is found, return it!
                        return selectorSet;
                    }
            }
        } else
            persistence.selectorSets = [];

        newSet = new SelectorSet(objectSourceElement, persistence.indices, true, stringAction);
        if (true == newSet.textTruncated && workflowActions.PlaceHolder !== stringAction)
            showTheToast(LOG_TYPE.WARN, `${toastStrong(newSet.selectorName)} text truncated to ${persistence.settings.truncateTextTo} chars`, newSet.text);
        // show the toast in the same frame as the element, unlike other toast which bubble up

        // if the new SelectorSet does not match any existing SelectorSets set, add it to the selectorSets, it's unique
        persistence.selectorSets.push(newSet);  // NOTE: we do not yet have imagedata
        //Assign the WorkflowStep a unique selectorSet
        if (true == Globals.debug)
            console.log(`${Globals.nowAsShortDate()} - ${typeof contentId !== 'undefined' ? contentId : Globals.currentContentID} returning selector ${newSet.selectorName} / steps: ${persistence.Workflow.length} / selectors ${persistence.selectorSets.length}`);
        return newSet;
    }
    // delete the specified wfs from the workflow
    // or if no parameter, delete the last entry
    // if there are global ancestoractions, we have to remove those as well... they are all placeholders put in on the right click
    // TODO: what about the goto?
    static deleteWorkflowStep(workflowStep) {
        let idx = 0;
        let tempWfs;
        let selectorName;

        if (workflowStep) {
            // by identity
            idx = persistence.Workflow.indexOf(workflowStep);

            if (0 <= idx)
                persistence.Workflow.splice(idx, 1);
            else
                LogMessage(LOG_TYPE.WARN, 'Workflow step to delete is not in the workflow', workflowStep?.action);
        }
        else {
            tempWfs = Object.assign({}, persistence.Workflow[persistence.Workflow.length - 1]);
            persistence.Workflow.splice(persistence.Workflow.length - 1, 1);    // no param, remove the last element entered (currently only for 'rightclick')
        }

        Persistence.savePersistence();

        return;
        /*
        // logging we prolly do not require
        if (tempWfs.selectorSet && tempWfs.selectorSet.selectorName) {
            selectorName = tempWfs.selectorSet.selectorName;
        }

        // Create the toast message with the action and selectorName
        let message = `Action: ${toastStrong(tempWfs.action)}<br>`;
        switch (tempWfs.action) {
            case workflowActions.Hover:
            case workflowActions.AltHover:
            case workflowActions.Focus:
            case workflowActions.AltFocus:
                message += `Selector:  ${toastStrong(selectorName)}`;
                break;
            case workflowActions.FillInFrom:
                message += `Selector:  ${toastStrong(selectorName)}<br>With:  ${toastStrong(tempWfs.selectorSet.text ? tempWfs.selectorSet.text : tempWfs.selectorSet.value)}`;
                break;
            case workflowActions.SendKey:
                message += `Key:  ${toastStrong(tempWfs.keys.keyCode)}`;
                break;
            case workflowActions.PressModifierKey:
            case workflowActions.ReleaseModifierKey:
                message += `Key:  ${toastStrong(getModKeys2(tempWfs.keys))}`;
                break;
            default:
                break;
        }
        // Show the toast message with "Recorded" as the title and the step information as the message
        LogMessage(LOG_TYPE.RECORDED, message);
        */
    }

    static addGoto(url) {
        let URLWorkStep = new WorkflowStep(
            {}, // [placeholder, not needed for goto]
            persistence.indices,
            workflowActions.GoTo,
            url
        );
        //push to array
        persistence.Workflow.push(URLWorkStep);
    }

    // A bare WithSelector (something non-clickable was picked) gets a GetGrid when the next real action arrives;
    // these context actions don't count as that action.
    // Built lazily: Constants.js loads after this file in content, so workflowActions isn't defined yet here.
    static _selectorContextActions = null;

    static isSelectorContextAction(action) {
        if (!WorkflowStep._selectorContextActions)
            WorkflowStep._selectorContextActions = new Set([
                workflowActions.WithSelector,
                workflowActions.InIframe,
                workflowActions.InShadowDom,
                workflowActions.GetGrid,
                workflowActions.PlaceHolder
            ]);

        return WorkflowStep._selectorContextActions.has(action);
    }

    static completeOpenSelector(nextAction) {
        const last = persistence.Workflow[persistence.Workflow.length - 1];

        if (!last || workflowActions.WithSelector !== last.action) return;
        if (true == WorkflowStep.isSelectorContextAction(nextAction)) return;

        persistence.Workflow.push(WorkflowStep.fromElementData(workflowActions.GetGrid, {}, null));
    }

    static scrollTimer = null;
    static SCROLL_IDLE_MS = 1000;   // quiet for this long: save it and say so. not a boundary, only a moment to write

    // identifies the scrolled container so a run can be matched without rebuilding a selector per wheel event
    static scrollTargetKey(containerData) {
        return containerData?.fullXPath ?? null;
    }

    static accumulateScroll(pixels, horizontal, containerData) {
        if (0 === pixels) return;

        const targetKey = WorkflowStep.scrollTargetKey(containerData);
        const action = containerData
            ? (horizontal ? workflowActions.ScrollElementHorizontal : workflowActions.ScrollElementVertical)
            : (horizontal ? workflowActions.ScrollWindowHorizontal : workflowActions.ScrollWindowVertical);
        const last = persistence.Workflow[persistence.Workflow.length - 1];
        const sameRun = last
                     && last.action === action
                     && (0 < last.data) === (0 < pixels)
                     && (last.scrollTargetKey ?? null) === targetKey;   // the sidebar and the page are separate runs

        if (sameRun)
            last.data += pixels;
        else
            WorkflowStep.startScrollRun(pixels, containerData, targetKey, action);

        debugLog(`[GPAL] scroll ${pixels}px on [${targetKey ?? 'window'}]: last=${last?.action} data=${last?.data} merged=${sameRun} / steps: ${persistence.Workflow.length}`);

        clearTimeout(WorkflowStep.scrollTimer);
        WorkflowStep.scrollTimer = setTimeout(() => WorkflowStep.flushScroll(), WorkflowStep.SCROLL_IDLE_MS);
    }

    static startScrollRun(pixels, containerData, targetKey, action) {
        // close out a picked element before scrolling, while it still exists (virtualised lists destroy rows on scroll)
        WorkflowStep.completeOpenSelector(action);

        // a container scroll needs a WithSelector for the container, unless the previous scroll already named it
        const last = persistence.Workflow[persistence.Workflow.length - 1];
        const alreadyNamed = last
                          && last.action
                          && last.action.startsWith('Scroll')
                          && (last.scrollTargetKey ?? null) === targetKey;

        if (containerData && false === alreadyNamed)
            persistence.Workflow.push(WorkflowStep.fromElementData(workflowActions.WithSelector, containerData, null));

        // addWorkflowStep inserts the opening GoTo for the first step
        const scrollStep = WorkflowStep.fromElementData(action, {}, pixels);
        scrollStep.scrollTargetKey = targetKey;

        if (0 === persistence.Workflow.length)
            WorkflowStep.addWorkflowStep(scrollStep);
        else
            persistence.Workflow.push(scrollStep);
    }

    // save and toast the scroll run; called on idle and before the next step is added
    static flushScroll() {
        clearTimeout(WorkflowStep.scrollTimer);
        WorkflowStep.scrollTimer = null;

        const last = persistence.Workflow[persistence.Workflow.length - 1];

        if (!last || !last.action || !last.action.startsWith('Scroll')) return;

        Globals.lastWorkflowStep = last;
        Persistence.savePersistence();
        LogMessage(LOG_TYPE.RECORDED, `Action: ${toastStrong(last.action)}<br>Scrolled: ${toastStrong(last.data + 'px')}`);
    }

    static getLastWorkflowStep() {
        return persistence.Workflow[persistence.Workflow.length - 1];
    }

    static DUPLICATE_WINDOW_MS = 250;   // an identical step inside this window is one event arriving twice

    static async addWorkflowStep(workflowStep) {
        // a scroll run that has not been written yet gets written before this step goes in
        if (WorkflowStep.scrollTimer)
            WorkflowStep.flushScroll();

        WorkflowStep.completeOpenSelector(workflowStep.action);

        // blocks one event arriving twice; the same action repeated by hand is outside the time window
        const sinceLast = Date.now() - (Globals.lastWorkflowStepAt || 0);

        if (workflowActions.SendKey !== workflowStep.action
            && sinceLast < WorkflowStep.DUPLICATE_WINDOW_MS
            && true == this.areEquivalent(Globals.lastWorkflowStep, workflowStep)) {
            debugLog(`[GPAL] addWorkflowStep BLOCKED after ${sinceLast}ms: action=${workflowStep.action} selector=${workflowStep.selectorSet?.selectorName} | last: action=${Globals.lastWorkflowStep?.action} selector=${Globals.lastWorkflowStep?.selectorSet?.selectorName}`);
            return false;
        }

        Globals.lastWorkflowStep = workflowStep;
        Globals.lastWorkflowStepAt = Date.now();
        //if workflowStep is empty then create a goto URL workflowStep unless the first command is withnewtab which will be followed by a goto
        if (persistence.Workflow.length === 0 && workflowActions.GoTo !== workflowStep.action
            && workflowActions.WithNewTab !== workflowStep.action && workflowActions.PlaceHolder !== workflowStep.action
            && workflowActions.GoToTab !== workflowStep.action) {
            try {
                if (0 === (typeof contentId !== 'undefined' ? contentId : Globals.currentContentID))
                    Globals.currentUrl = window.top.location.href;

                this.addGoto(Globals.currentUrl);   // this is set via messaging as it changes and as background is made aware, it is sent to current tab
            } catch (error) {
                LogMessage(LOG_TYPE.WARN, 'Unable to add goto url for addWorkflowStep', error);
            }
        } else if (workflowActions.GoTo === workflowStep.action || workflowActions.WithNewTab === workflowStep.action || workflowActions.GoToTab === workflowStep.action) {
            // ignore resetting the previous dom if we are entering our first GoTo to start the workflow
            // it does not represent a change but the start
        }


        // Push worflowStep into persistence's workflow array
        persistence.Workflow.push(workflowStep);
        // Wrap it like this so you can await it:

        await new Promise(resolve => {
            Persistence.savePersistence(() => {
                if (Globals.debug === true) {
                    console.log(
                        `${Globals.nowAsShortDate()} - ` +
                        `${typeof contentId !== 'undefined' ? contentId : Globals.currentContentID} ` +
                        `saved step ${workflowStep.action} / steps: ${persistence.Workflow.length} / selectors: ${persistence.selectorSets.length}`
                    );
                }
                resolve();
            });
        });
    
        let action = "";
        if (workflowStep.action) {
            action = workflowStep.action;
        }

        let selectorName = "";
        if (workflowStep.selectorSet && workflowStep.selectorSet.selectorName) {
            selectorName = workflowStep.selectorSet.selectorName;
        }

        if (workflowActions.PlaceHolder !== workflowStep.action) {
            // Create the toast message with the action and selectorName
            let message = `Action: ${toastStrong(action)}<br>`;
            switch (action) {
                case workflowActions.AltFocus:
                case workflowActions.AltHover:
                case workflowActions.AltMoveTo:
                case workflowActions.AltLeftClick:
                case workflowActions.LeftClick:
                case workflowActions.RightClick:
                case workflowActions.WithSelector:
                case workflowActions.InIframe:
                case workflowActions.InShadowDom:
                    message += `Selector: ${toastStrong(selectorName)}`;
                    break;
                case workflowActions.FillInFrom:
                    message += `Selector: ${toastStrong(selectorName)}<br>With: ${toastStrong(workflowStep.selectorSet?.text ? workflowStep.selectorSet.text : workflowStep.selectorSet?.value)}`;
                    break;
                case workflowActions.SendKey:
                    message += `Key: ${toastStrong(workflowStep.keys.keyCode)}`;
                    break;
                case workflowActions.PressModifierKey:
                case workflowActions.ReleaseModifierKey:
                    message += `Key: ${toastStrong(typeof getModKeys2 === 'function' ? getModKeys2(workflowStep.keys) : JSON.stringify(workflowStep.keys))}`;
                    break;
                case workflowActions.GoTo:
                case workflowActions.GoToTab:
                case workflowActions.WithNewTab:
                    let url = Globals.currentUrl;

                    try {
                        url = toastStrong(Globals.currentUrl.slice(0, 25));
                        if (25 < Globals.currentUrl.length)
                            url += '...';
                    } catch { }

                    message += `URL: ${url}`
                    break;
                default:
                    break;
            }
            // Show the toast message with "Recorded" as the title and the step information as the message
            LogMessage(LOG_TYPE.RECORDED, message);
        }

        return true;
    }

    /**
     * Determines if two WorkflowSteps are equivalent (represent the same logical action).
     * Ignores runtime-specific properties like timestamp and objectSourceElement.
     * 
     * @param {WorkflowStep} step1 
     * @param {WorkflowStep} step2 
     * @returns {boolean}
     */
    static areEquivalent(step1, step2) {
        if (!step1 || !step2) return step1 === step2;

        if (step1.action !== step2.action) return false;

        if (step1.keys || step2.keys) {
            if (!step1.keys || !step2.keys) return false;
            if (step1.keys.keyCode !== step2.keys.keyCode ||
                step1.keys.altKey !== step2.keys.altKey ||
                step1.keys.ctrlKey !== step2.keys.ctrlKey ||
                step1.keys.shiftKey !== step2.keys.shiftKey) {
                return false;
            }
        }

        if (step1.data !== step2.data) {
            if (typeof step1.data === 'number' && typeof step2.data === 'number') {
                if (step1.data !== step2.data) return false;
            } else {
                return false;
            }
        }

        if (step1.selectorSet || step2.selectorSet) {
            if (!step1.selectorSet || !step2.selectorSet) return false;

            const s1 = step1.selectorSet;
            const s2 = step2.selectorSet;

            return (
                s1.css === s2.css &&
                s1.xPath === s2.xPath &&
                s1.fullXPath === s2.fullXPath &&
                s1.selectorName === s2.selectorName &&
                s1.alt === s2.alt &&
                s1.absoluteLeft === s2.absoluteLeft &&
                s1.absoluteTop === s2.absoluteTop &&
                s1.text === s2.text &&
                s1.value === s2.value &&
                // drags of the same element differ by movement and pickup point
                s1.deltaX === s2.deltaX &&
                s1.deltaY === s2.deltaY &&
                s1.offsetX === s2.offsetX &&
                s1.offsetY === s2.offsetY
            );
        }

        return true;
    }

    // ======================== BACKGROUND-ONLY CREATION (Serialized Element Support) ========================

    /**
     * Creates a pseudo-element that mimics enough of a real DOM element
     * for SelectorSet + WorkflowStep constructors to work correctly.
     */
    static createPseudoElement(serializedElement) {
        if (!serializedElement) return null;

        const pseudo = {
            ...serializedElement,

            // Safe stubs so original methods don't throw
            getAttribute: (name) => serializedElement._rawAttributes?.[name] ?? serializedElement.attributes?.[name] ?? null,
            getBoundingClientRect: () => serializedElement.boundingRect || { left: 0, top: 0, width: 0, height: 0 },
            getClientRects: () => serializedElement.clientRects || [],
            hasAttribute: (name) => !!serializedElement._rawAttributes?.[name] || !!serializedElement.attributes?.[name],
            querySelectorAll: () => [],                    // for label check
            classList: { contains: () => false },          // safe for .contains()
            parentElement: null,
            disabled: false,
            ariaDisabled: null,
            isContentEditable: false,
            contentEditable: 'false',
            tagName: serializedElement.tagName || 'DIV',

            getAttribute: (name) => serializedElement._rawAttributes?.[name] ?? null,
            isClickable: !!serializedElement.isClickable,
            isEditable: !!serializedElement.isEditable,
            isDraggable: !!serializedElement.isDraggable,

            fullXPath: serializedElement.fullXPath,
            simplifiedXPath: serializedElement.simplifiedXPath,
            xPaths: serializedElement.xPaths || [],
            absoluteLeft: serializedElement.absoluteLeft || 0,
            absoluteTop: serializedElement.absoluteTop || 0,
            absoluteRect: serializedElement.absoluteRect || null,
            css: serializedElement.css,
            fullXPath: serializedElement.fullXPath,
            simplifiedXPath: serializedElement.simplifiedXPath,
            xPaths: serializedElement.xPaths,
        };

        return pseudo;
    }

    /**
     * ONLY background should call this.
     * Content scripts send serialized element data > background creates real WorkflowStep.
     */
    static fromElementData(action, elementData, extraData = null) {
        const pseudoElement = WorkflowStep.createPseudoElement(elementData);

        // This calls the real constructor (exactly like before)
        const step = new WorkflowStep(
            pseudoElement,
            persistence.indices,
            action,
            extraData
        );

        return step;
    }

    /**
     * Creates a deep clone of an existing WorkflowStep
     * @param {WorkflowStep} original - The step to clone
     * @returns {WorkflowStep} A new WorkflowStep instance
     */
    /*
    static clone(original) {
        if (!original) {
            console.warn("WorkflowStep.clone called with null/undefined");
            debugger;
            return null;
        }

        // Create a new WorkflowStep using the minimal constructor path
        const clone = new WorkflowStep(
            original.objectSourceElement,
            persistence.indices,
            original.action,
            original.data
        );

        // Copy scalar properties
        clone.keys = original.keys ? { ...original.keys } : null;
        clone.data = original.data;                    // can be primitive or object
        clone.variableName = original.variableName;
        clone.timestamp = getTimestamp();              // new timestamp for clone

        // Deep clone selectorSet (most important part)
        if (original.selectorSet) {
            // Try to reuse/create selectorSet properly so it stays in sync with persistence
            if (original.selectorSet.element) {
                clone.selectorSet = clone.createOrReuseSelectorSet(
                    original.selectorSet.element,           // use original element if available
                    persistence.indices,
                    persistence,
                    original.action
                );
            } else {
                // Fallback: manual deep copy of selector data
                clone.selectorSet = { ...original.selectorSet };
            }

            // Copy mouse offsets if they exist
            if (original.selectorSet.offsetX !== undefined) {
                clone.selectorSet.offsetX = original.selectorSet.offsetX;
            }
            if (original.selectorSet.offsetY !== undefined) {
                clone.selectorSet.offsetY = original.selectorSet.offsetY;
            }
        }

        // Special handling for certain actions
        if (original.action === workflowActions.AndDownload) {
            // Re-run variable creation logic if needed
            // (adjust if you want to reuse the same variable name)
        }

        Globals.lastWorkflowStep = clone;
        return clone;
    }
    */
}
