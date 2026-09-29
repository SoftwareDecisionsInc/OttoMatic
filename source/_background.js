const contentId = 'background'; //Math.random().toString(36).substring(2);

// Chrome service worker only; Firefox's event page loads these via manifest background.scripts
if (typeof importScripts === 'function') {
    try {
        importScripts('Globals.js', './Settings.js', './Constants.js', './Persistence.js', './GPALToast.js', './Logging.js', './EventHandlers.js', './Messaging.js', './SelectorSet.js', './WorkflowStep.js', './Tabs.js', './ContextMenu.js', './ImageHelper.js');
    } catch (error) {
        LogMessage(LOG_TYPE.CRITICAL, 'Background error', error);
    }
}

var port;
let tcpServer;
const clients = [];
// Set when we are deliberately taking the native app down ahead of an extension
// reload. The reload brings up a fresh one, so the disconnect that follows must
// not be treated as a failure to recover from.
var nativeAppShuttingDown = false;
/*  Adds a listener to handle incoming messages */
BROWSER.runtime.onMessage.addListener(Messaging.handleMessageForBackground);
BROWSER.contextMenus.onClicked.addListener(GPALContextMenu.handleContextMenuItemClick);

/*
1. It declares a constant variable BROWSER and assigns the value of the chrome global object if
it exists, otherwise it assigns the value of the browser global object. This is used to check if
the Browser is Chrome or Firefox.

2. It retrieves the value of the persistence key from the local storage using the
BROWSER.storage.local.get() method. The result of this operation is passed as an argument to a
callback function.

3. If the persistence object exists, the code checks if the isRecording property of the object is
true or false. If it's true, the badge text of the extension is set to "REC" and the badge background
color is set to red. If it's false, the badge text is set to an empty string and the badge background
color is set to transparent.

4. If the persistence object doesn't exist, the code doesn't do anything related to setting the badge
text or background color.

- flag is stored but badge is set as 'REC'
- isRecording from persistence.js

*/
//when shutdown, set flag to false, don't record
init();

//===============
// Handlers
//===============

async function init() {
    GPALTabs.init();

    var manifest = BROWSER.runtime.getManifest();
    var extensionVersion = manifest.version;

    // Our background page isn't persistent.
    BROWSER.runtime.onStartup.addListener(() => {
        try {
            GPALContextMenu.init();
            persistence = new Persistence();
            Persistence.savePersistence();
        } catch (error) {
            debugLog("Ottomatic started up, MessageAllTabs failed with", error);
            persistence = new Persistence();
            Persistence.savePersistence();
        }
        void BROWSER.runtime.lastError;
    });

    // onInstalled fires on first install, extension reload, and browser/extension updates.
    // On first install only: open gpal.sditx.com so the user knows where to get started.
    // All other cases (reload, update) are silent — we don't want to be a nuisance.
    BROWSER.runtime.onInstalled.addListener(async (details) => {
        if (details.reason === 'install') {
            GPALContextMenu.init();
            BROWSER.tabs.create({ url: 'https://gpal.sditx.com' });
        } else if (details.reason === 'update' || details.reason === 'chrome_update') {
            try {
                GPALContextMenu.init();
            } catch (error) { /* no content scripts present yet on a cold reload */ }

            // only a new build can change the schema (chrome_update is the browser, not us)
            if (details.reason === 'update') {
                await Persistence.migratePersistenceSchema();
            }
        }
        void BROWSER.runtime.lastError;
    });

    BROWSER.runtime.onSuspend.addListener(function () {
        Messaging.sendToNativeApp('die');
    });

    BROWSER.storage.onChanged.addListener(async (changes, area) => {
        if (area !== "local" || !changes.persistence)
            return;

        const writer = changes.persistence.newValue?.savedByID;

        // our own write: memory is already newer than storage
        if (writer === contentId) {
            debugLog(`[GPAL] bg ignoring its own persistence write / steps: ${persistence?.Workflow?.length}`);
            return;
        }

        debugLog(`[GPAL] bg reloading persistence, written by [${writer}]`);
        await Persistence.reloadPersistence(true);
    });

    const tabHistory = {};

    BROWSER.webNavigation.onCommitted.addListener((details) => {
        if (details.frameId !== 0) return;
        if (!persistence || !persistence.isRecording) return;

        const tabId = details.tabId;
        const url = details.url;
        const qualifiers = details.transitionQualifiers || [];
        const isHistoryNav = qualifiers.includes("forward_back");
        const lastStep = WorkflowStep.getLastWorkflowStep();

        if (!tabHistory[tabId]) {
            tabHistory[tabId] = { stack: [], index: -1 };
        }
        const state = tabHistory[tabId];

        const saveAction = (actionType, replacePrevious = false) => {
            if (replacePrevious) {
                lastStep.action = actionType;
                lastStep.data = {};
                Persistence.savePersistence();
            } else {
                const step = new WorkflowStep(
                    {},
                    {}, // not used
                    actionType,
                    {}
                );

                WorkflowStep.addWorkflowStep(step);
            }
        };

        // -----------------------------------------
        // BACK / FORWARD NAVIGATION
        // -----------------------------------------
        if (isHistoryNav) {
            const existingIndex = state.stack.indexOf(url);

            // Check if tabs.onUpdated logged an incorrect forward Goto step for this back/forward action
            const hasPendingGoto = lastStep && lastStep.action === workflowActions.GoTo && lastStep.data === url;

            if (existingIndex !== -1) {
                if (existingIndex < state.index) {
                    // Correct chronological navigation backward
                    saveAction(workflowActions.Back, hasPendingGoto);
                } else if (existingIndex > state.index) {
                    // Correct chronological navigation forward
                    saveAction(workflowActions.Forward, hasPendingGoto);
                }
                state.index = existingIndex;
            } else {
                // Baseline initialization fallback
                if (state.stack.length > 0) {
                    state.stack.unshift(url);
                    state.index = 0;
                    saveAction(workflowActions.Back, hasPendingGoto);
                } else {
                    state.stack.push(url);
                    state.index = state.stack.length - 1;
                }
            }
            return;
        }

        // -----------------------------------------
        // REFRESH / RELOAD
        // -----------------------------------------
        if (details.transitionType === "reload") {
            saveAction(workflowActions.Refresh, false);
            return;
        }

        // -----------------------------------------
        // NORMAL NAVIGATION
        // -----------------------------------------
        state.stack = state.stack.slice(0, state.index + 1);
        if (state.stack[state.index] !== url) {
            state.stack.push(url);
            state.index = state.stack.length - 1;
        }
    });


    // Cleanup when tab is closed
    BROWSER.tabs.onRemoved.addListener((tabId) => {
        delete tabHistory[tabId];
    });

    await reloadPersistence();
    if (true == persistence.settings.runApi)
        nativeInit();


    // this event fire when we move to another window, will be necessary to be able to move between windows
    // maybe too sensitive, like fires before a tab opens and we capture withnewtab?
    //BROWSER.windows.onFocusChanged.addListener(function (windowId) {
    //    // if (windowId === BROWSER.windows.WINDOW_ID_NONE)
    //    // Mouse has left the browser window
    //    Globals.ignoreNextGoto = false;   // between last click and now the user has moved out, so maybe it's them entering a url or clicking a bookmaark, clicking a link in a document...
    //    LogMessage(LOG_TYPE.DEBUG, 'BG reset Next Goto');
    //});
}

//===============
// Helpers
//===============
function nativeInit() {
    if (port == null) {
        port = BROWSER.runtime.connectNative('gpal.rest.api.nativeapp'); // launch server
        if (port !== null) {
            Messaging.port = port;
            port.onMessage.addListener(Messaging.readFromNativeApp);  // stdio reader of native messaging, 4 size bytes and then the payload
            port.onDisconnect.addListener(restartRestServer);
            void BROWSER.runtime.lastError;
        } else {
            offerRestApiDownload();
        }
    }
}

// once per browser session: every service-worker wake retries the connection
async function offerRestApiDownload() {
    const REST_API_SITE = "https://gpal.sditx.com/gpal-rest-api";

    try {
        const already = await BROWSER.storage.session.get("restApiOfferShown");

        if (already?.restApiOfferShown)
            return;

        await BROWSER.storage.session.set({ restApiOfferShown: true });
    } catch (error) {
        debugLog("Could not record the REST API offer, not opening a tab:", error);
        showNotification(LOG_TYPE.NOTICE, "GPAL REST API not installed");
        return;
    }

    showNotification(LOG_TYPE.NOTICE, "GPAL REST API not installed. Opening the download page...");

    BROWSER.tabs.create({ url: REST_API_SITE }).catch(err => {
        console.error("Failed to open tab:", err);
    });
}

function restartRestServer() {
    // we asked the native app to die for a reload; reload on disconnect so the old process is gone first
    if (nativeAppShuttingDown) {
        BROWSER.runtime.reload();
        return;
    }

    if (port !== null && true == persistence.settings.runApi) {
        const err = BROWSER.runtime.lastError;

        if (err?.message === 'Specified native messaging host not found.') {
            port.onMessage.removeListener(Messaging.readFromNativeApp);   // remove hooks in now defunct port
            port.onDisconnect.removeListener(restartRestServer);
            port = null;
            // connectNative returns a live port whether or not the host exists, so this is the only place
            // "not installed" is knowable.
            offerRestApiDownload();
            return;
        }
        showNotification(LOG_TYPE.NOTICE, "GPAL API Server Disconnected\nRestarting server");
        port.onMessage.removeListener(Messaging.readFromNativeApp);   // remove hooks in now defunct port
        port.onDisconnect.removeListener(restartRestServer);

        port = BROWSER.runtime.connectNative('gpal.rest.api.nativeapp');
        Messaging.port = port;
        port.onMessage.addListener(Messaging.readFromNativeApp);
        port.onDisconnect.addListener(restartRestServer);
        void BROWSER.runtime.lastError;
    }
}

//method to reload persistence object
// unable to use one in Persistence. it seems to hang
    async function reloadPersistence() {
        let objectResult = await BROWSER.storage.local.get("persistence");
        
        /* checks if 'persistence' object exists */
        if (objectResult.persistence) {
            persistence = objectResult.persistence;
            /* checks if 'isRecording' property is true or false */
            //to do: isrecording should not be persistant, by setting it to false, should be implemented in background js
            if (objectResult.persistence.isRecording) {
                /* sets the badge background color to red */
                BROWSER.action.setBadgeBackgroundColor({ color: [255, 0, 0, 255] });

                /* sets the badge text to 'REC' */
                BROWSER.action.setBadgeText({ text: "REC" });
            } else {
                /* sets the badge background color to transparent */
                BROWSER.action.setBadgeBackgroundColor({ color: [0, 0, 0, 0] });

                /* sets the badge text to an empty string */
                BROWSER.action.setBadgeText({ text: "" });
            }
        } else {
            persistence = new Persistence();
            persistence.savedByID = contentId;
            Persistence.savePersistence();
        }
    }


