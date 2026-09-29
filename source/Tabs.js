// Define a helper class to store URL history
class UrlHistory {
    constructor(previousUrl, currentUrl) {
        this.previousUrl = previousUrl;
        this.currentUrl = currentUrl;
    }
}

class GPALTabs {
    static newWorkflowStep;
    // Create a Map to store tab ID and URL pairs
    static tabMap;
    static previousUrls;
// Track the URL history for each tab
    static previousUrls = {};

    // tabId -> the arrival step, when it opened, and the workflow length then; unchanged length at close means nothing was done there
    static excursions = new Map();
    // Which tab the workflow is currently on, as far as recording is concerned
    static recordingTabId = null;
    static NOTHING_HAPPENED_MS = 500;   // shorter than anything a person can open, read and close

    static recordArrival(tabId, step, previousTabId) {
        GPALTabs.excursions.set(tabId, {
            step: step,
            openedAt: Date.now(),
            workflowLength: persistence.Workflow.length,
            previousTabId: previousTabId
        });
    }

    static init() {
        let updatedTab;
        let previousUrls = {};
        GPALTabs.url = '';

        // on tab create
        BROWSER.tabs.onCreated.addListener(function (tab) {
            if (!GPALTabs.tabMap)
                GPALTabs.tabMap = new Map();

            Globals.currentTabID = tab.id;

            // give page 1 second to settle in and load content script
            // then grab the url, if we got an 'ignore next goto' from content, for the next five seconds, ignore tab changes
            // because they are from a webapge click
            // however, if there is not message, then a new tab created, or a url has been entered or the browser back and forward buttons are being pressed
            setTimeout(() => {
                GPALTabs.getTabDetails(tab.id, (updatedTab) => {
                    // Fetch the full tab details including the URL
                    Globals.currentUrl = updatedTab.url || updatedTab.pendingUrl;
                    GPALTabs.tabMap.set(tab.id, Globals.currentUrl);    // Retrieve the URL using the tab ID, store it for our use when closing a tab

                    // CAVEAT: should we/do we need to do this? tab visibility event fires on the tab and it tells background, but all content on pageneed to hear it...
                    Messaging.messageATab(Globals.currentTabID, null, { message: REQUEST.SET_TOP_LEVEL_URL, url: Globals.currentUrl });

                    // ignorenextgoto - we just got word of an event preceeding this that will open or close tabs/windows we don't want to record, so ignore it...
                    if (!Globals.ignoreNextGoto && persistence && persistence.isRecording) {
                        if (GPALTabs.tabMap.has(tab.id))
                            // Retrieve the URL using the tab ID
                            GPALTabs.url = GPALTabs.tabMap.get(tab.id);

                        GPALTabs.newWorkflowStep = new WorkflowStep(
                            {}, // empty obj to pass validation, not used
                            persistence.indices,
                            workflowActions.WithNewTab,
                            'chrome://newtab/' !== GPALTabs.url ? GPALTabs.url : ''
                        );
                        // Save to workflow, we don't set currentTabId becuase 'newtab' does not have contents that can respond, only when we go somewhere
                        WorkflowStep.addWorkflowStep(GPALTabs.newWorkflowStep);

                        /* now that withnewtab has a url, we don't require this except in the case a new tab is opened and a user enters a url? but that will be an onupdate */
                        /*
                        if (GPALTabs.url && 'chrome://newtab/' !== GPALTabs.url) { // no firefox equivalent
                            GPALTabs.newWorkflowStep = new WorkflowStep(
                                {}, // empty obj to pass validation, not used
                                persistence.indices,
                                workflowActions.GoTo,
                                GPALTabs.url
                            );
                            // Save to workflow
                            WorkflowStep.addWorkflowStep(GPALTabs.newWorkflowStep);
                        }
                        */
                    } else if (true == Globals.ignoreNextGoto)
                        Globals.ignoreNextGoto = false;
                });
            }, 1000);
        });

        BROWSER.tabs.onActivated.addListener((activeInfo) => {
            const tabId = activeInfo.tabId;
            BROWSER.tabs.get(tabId, (tab) => {
                Globals.currentUrl = tab.url || tab.pendingUrl;
                Globals.currentTabID = tab.id;
                // baseline onUpdated compares against to detect navigation; it follows the active tab
                GPALTabs.url = Globals.currentUrl;
                debugLog(`[GPAL] tabs.onActivated tab=${tabId} url=${Globals.currentUrl} recordingTabId=${GPALTabs.recordingTabId} ignoreNextGoto=${Globals.ignoreNextGoto} isRecording=${persistence?.isRecording}`);
                Messaging.messageATab(Globals.currentTabID, null, { message: REQUEST.SET_TOP_LEVEL_URL, url: Globals.currentUrl });
                // focus returned to the tab being recorded (e.g. a window it opened closed itself), nothing to record
                if (GPALTabs.recordingTabId === tabId) {
                    debugLog(`[GPAL] tabs.onActivated SKIP same tab ${tabId}`);
                // not gated on ignoreNextGoto: that flag suppresses onUpdated's GoTo for a click's navigation, not the GoToTab for a tab the click opened
                } else if (persistence && persistence.isRecording) {
                    const cameFrom = GPALTabs.recordingTabId;
                    GPALTabs.recordingTabId = tabId;

                    if ('chrome://newtab/' === Globals.currentUrl)
                        GPALTabs.newWorkflowStep = new WorkflowStep(
                            {}, // empty obj to pass validation, not used
                            persistence.indices,
                            workflowActions.WithNewTab,
                            ''
                        );
                    else
                        GPALTabs.newWorkflowStep = new WorkflowStep(
                            {}, // empty obj to pass validation, not used
                            persistence.indices,
                            workflowActions.GoToTab,
                            Globals.currentUrl || ''    // no URL yet while the tab is still redirecting; onUpdated fills it in
                        );

                    // Save to workflow
                    WorkflowStep.addWorkflowStep(GPALTabs.newWorkflowStep);
                    debugLog(`[GPAL] tabs.onActivated RECORDED ${GPALTabs.newWorkflowStep.action} url=${Globals.currentUrl} cameFrom=${cameFrom}`);
                    GPALTabs.recordArrival(tabId, GPALTabs.newWorkflowStep, cameFrom);
                }
                // ignoreNextGoto is left for onUpdated to consume

                // Attach the wheel event listener to the tab
                //BROWSER.tabs.executeScript(tabId, {
                //    code: `
                //          document.addEventListener('wheel', (event) => {
                //            // Handle the mouse wheel scroll event
                //            const delta = Math.sign(event.deltaY);
                //            console.log('Mouse wheel scroll:', delta);
        
                //            // Perform additional actions based on the scroll direction
                //            if (delta === 1) {
                //              // Scroll down
                //            } else if (delta === -1) {
                //              // Scroll up
                //            }
                //          });
                //        `
                //});
            });
        });

        // on tab removed
        BROWSER.tabs.onRemoved.addListener(function (tabId, removeInfo) {
                if (!GPALTabs.tabMap)
                    GPALTabs.tabMap = new Map();
                // Tab was closed
                let url = '';
                if (GPALTabs.tabMap.has(tabId))
                    // Retrieve the URL using the tab ID
                    url = GPALTabs.tabMap.get(tabId);

            if (!Globals.ignoreNextGoto && persistence && persistence.isRecording) {
                const excursion = GPALTabs.excursions.get(tabId);
                debugLog(`[GPAL] tabs.onRemoved tab=${tabId} hadExcursion=${!!excursion} steps=${persistence.Workflow.length} atArrival=${excursion?.workflowLength} recordingTabId=${GPALTabs.recordingTabId}`);
                GPALTabs.excursions.delete(tabId);

                // nothing recorded in the tab and it closed almost at once (a page's own popup): remove the arrival instead of recording a close
                const emptyExcursion = excursion
                                    && persistence.Workflow.length === excursion.workflowLength
                                    && excursion.step;

                if (emptyExcursion && Date.now() - excursion.openedAt < GPALTabs.NOTHING_HAPPENED_MS) {
                    WorkflowStep.deleteWorkflowStep(excursion.step);
                    // as far as the workflow is concerned we never left, so focus coming back to that tab is
                    // not a step either
                    GPALTabs.recordingTabId = excursion.previousTabId;
                    Persistence.savePersistence();
                    return;
                }

                // POST-V1: record time spent in the tab as a WaitFor, only behind a 'record WaitFor' setting
                // if (emptyExcursion)
                //     WorkflowStep.addWorkflowStep(new WorkflowStep(
                //         {},
                //         persistence.indices,
                //         workflowActions.WaitFor,
                //         String(Date.now() - excursion.openedAt)
                //     ));

                GPALTabs.newWorkflowStep = new WorkflowStep(
                    {}, // empty obj to pass validation, not used
                    persistence.indices,
                    'CloseTab',
                    GPALTabs.url === url ? '' : url // if closed the current tab, don't use an addres, just a close
                );

                // Save to workflow
                WorkflowStep.addWorkflowStep(GPALTabs.newWorkflowStep);
            } else if (true == Globals.ignoreNextGoto)
                Globals.ignoreNextGoto = false;
            // how to properly use promise
            //    GPALTabs.getTabDetails(tabId)
            //        .catch(error => { })
            //        .then((tab) => {
            //            if ('no such tab' === tab)
            //                return;
            //            let url = tab.url;
            //            GPALTabs.newWorkflowStep = new WorkflowStep(
            //                {}, // empty obj to pass validation, not used
            //                persistence.indices,
            //                'CloseTab',
            //                url
            //            );
            //            // Save to workflow
            //            WorkflowStep.addWorkflowStep(GPALTabs.newWorkflowStep);
            //            Persistence.savePersistence();
            //        });
        });

        // Listen for tab updates
        BROWSER.tabs.onUpdated.addListener(function (updatedTabId, changeInfo, updatedTab) {
            if (!GPALTabs.tabMap)
                GPALTabs.tabMap = new Map();
            if (changeInfo.url || updatedTab.active) {
                //Persistence.reloadPersistence().then(() => {
                    // TODO: how to deal with closing another tab out of sequence. suppose a new tab opens, then the user manually closes the other tab.
                    // is that tab part of the workflow?
                    let newURL = changeInfo.url || updatedTab.url;
                    // a background tab updating (e.g. the page that opened this one) is not a navigation
                    if (null !== GPALTabs.recordingTabId && updatedTabId !== GPALTabs.recordingTabId)
                        return;

                    // until something is recorded in a tab we arrived in, its redirects are the arrival's URL, not GoTos
                    const excursion = GPALTabs.excursions.get(updatedTabId);
                    const lastStep = persistence?.Workflow[persistence.Workflow.length - 1];
                    if (changeInfo.url && persistence?.isRecording && excursion
                        && persistence.Workflow.length === excursion.workflowLength
                        && workflowActions.GoToTab === lastStep?.action) {
                        debugLog(`[GPAL] tabs.onUpdated GoToTab url ${lastStep.data} -> ${newURL}`);
                        lastStep.data = newURL;
                        GPALTabs.url = newURL;
                        Globals.currentUrl = newURL;
                        Globals.ignoreNextGoto = false;     // the click's navigation has landed here
                        Persistence.savePersistence();
                        return;
                    }

                    if ('chrome://newtab/' !== newURL) {
                        debugLog(`[GPAL] tabs.onUpdated tab=${updatedTabId} newURL=${newURL} baseline=${GPALTabs.url} ignoreNextGoto=${Globals.ignoreNextGoto} same=${isSameUrl(GPALTabs.url, newURL)}`);
                        if (!Globals.ignoreNextGoto && !isSameUrl(GPALTabs.url, newURL)) {    // do we have a new url?
                            Globals.currentTabID = updatedTabId;
                            Globals.currentUrl = newURL;
                            // baseline moves on every navigation, recorded or not
                            GPALTabs.url = newURL;
                            // onUpdated also fires on a page refresh, so only record once the workflow has started
                            if (persistence && persistence.isRecording && 0 < persistence.Workflow.length && true == persistence.isRecording) {
                                debugLog(`[GPAL] tabs.onUpdated RECORDED GoTo ${newURL}`);
                                WorkflowStep.addGoto(newURL);
                                // Save to workflow
                                Messaging.messageATab(Globals.currentTabID, null, { message: REQUEST.SET_TOP_LEVEL_URL, url: changeInfo.url || updatedTab.url });
                            }
                        } else if (true == Globals.ignoreNextGoto)
                            Globals.ignoreNextGoto = false;
                    }
                //});
            }

            function isSameUrl(url, newUrl) {
                if (!url || !newUrl) return false;
                // ignore a trailing slash and the case of percent-escapes (%2c == %2C)
                const normalize = (u) => u.replace(/\/$/, "").replace(/%[0-9a-f]{2}/gi, (escape) => escape.toUpperCase());
                return normalize(url) === normalize(newUrl);
            }

        });

    }
    ///////////////////
    // Helpers
    ///////////////////
    static async getTabDetails(tabId, callback) {
        try {
            return await new Promise((resolve, reject) => {
                setTimeout(() => {
                    BROWSER.tabs.get(tabId, (tab) => {
                        if (BROWSER.runtime.lastError) {
                            // Handle any error that occurred during tab retrieval
                            reject('no such tab');
                        } else {
                            // Resolve the promise with the tab details
                            resolve(tab);
                        }
                    });
                }, 1000);
            });
        } catch (error) {
            debugLog('GetTabDetails Error', error);
            return 'no such tab';
        }
    }
    static getTabTitle(tabId) {
        return new Promise(function (resolve, reject) {
            BROWSER.tabs.get(tabId, function (tab) {
                if (BROWSER.runtime.lastError) {
                    // Error occurred, reject the promise
                    reject(BROWSER.runtime.lastError);
                } else {
                    // Tab information retrieved successfully, resolve the promise with the title
                    resolve(tab.title);
                }
            });
        });
    }
}