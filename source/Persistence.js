let persistence;
// NOTE: _background.js has its own reloadPersistence (this one hangs in the background); keep the two in sync.
class Persistence {
    constructor() {
        this.settings = new Settings();
        this.Workflow = [];
        this.indices = {};

        this.viewMode = "";

        this.isRecording = false;
        //local storage object to see if previous element is in same dom as past
        this.prevDOM = {
            InIframe: null,
            InShadow: null
        };

        //stores unique selectorSets, used to reuse selectors
        this.selectorSets = [];
        this.variables = [];

        try {
            this.pageURL = "_content.js: " + window.location.href;
        } catch (error) {
            try {
                this.pageURL = "_content.js: " + document.URL;
            } catch (error) {
                this.pageURL = 'Persistence constructor: unable to get';
            }
        }
        this.elementToHighlightCss = '';   // when we click on an image 'host' link, we want to highlight the element on the page using it's full xpath
        this.elementToHighlightURL = '';   // when we click on an image 'host' link, we want to highlight the element on the page using it's frame url, too
        this.elementToUpdateSelectorName = '';   // when we click on updating image 'host' link, we want to get info on startup and request a snapshot and then close
        this.selectorNamesToUpdate = [];         // queue of selectorNames for "Update All Missing" — processed one per page navigation

        this.savedByID = null;
        this.timestamp = Date().toLocaleString();
        this.getOneSelector = false;
    }

    //method to reload persistence object
    static reloadPersistence(forceReload = false) {
        return new Promise((resolve, reject) => {
            BROWSER.storage.local.get("persistence", (data) => {
                if (BROWSER.runtime.lastError) {
                    const err = BROWSER.runtime.lastError;
                    LogMessage(LOG_TYPE.WARN, `Ottomatic reloaded?\n${toastStrong('PLEASE REFRESH PAGE.')}`);
                    debugLog("UNABLE to get data", err);
                    Messaging.messageAllTabs(REQUEST.STOP_RECORDING); //send a message to all tabs to stop recording, this tab got the ONE selector
                    persistence.isRecording = false;
                    reject(err);
                    return;
                }

                try {
                    const stored = data?.persistence;

                    if (true == Globals.debug)
                        console.log(`${Globals.nowAsShortDate()} - ${typeof contentId !== 'undefined' ? contentId : Globals.currentContentID} reloading persistence / steps: ${stored?.Workflow?.length} / selectors: ${stored?.selectorSets?.length}`);

                    if (!stored) {
                        persistence = new Persistence();
                        Persistence.savePersistence();   // assuming this is static or you fix the `this`
                        resolve(persistence);
                        return;
                    }

                    const shouldReload = forceReload ||
                        !persistence ||
                        persistence.Workflow?.length < stored.Workflow?.length ||
                        persistence.selectorSets?.length < stored.selectorSets?.length;

                    if (shouldReload) {
                        persistence = stored;
                        resolve(persistence);
                    }
                    else if (persistence.Workflow?.length > stored.Workflow?.length ||
                        persistence.selectorSets?.length > stored.selectorSets?.length) {

                        LogMessage(LOG_TYPE.CRITICAL,
                            `Content: ${typeof contentId !== 'undefined' ? contentId : Globals.currentContentID}\nData out of sync.\n` +
                            `We have more ${persistence.Workflow.length > stored.Workflow.length ? `[${persistence.Workflow.length}] workflow steps` : ''}` +
                            `${persistence.Workflow.length > stored.Workflow.length && persistence.selectorSets.length > stored.selectorSets.length ? ' and more ' : ''}` +
                            `${persistence.selectorSets.length > stored.selectorSets.length ? `[${persistence.selectorSets.length}] selectors` : ''}!\n` +
                            `${toastStrong('PLEASE REFRESH PAGE')}`
                        );

                        if (Globals.debug) debugger;

                        // Decide what to do - for now we trust storage (most common case)
                        persistence = stored;
                        resolve(persistence);
                    }
                    else {
                        debugLog("did not load same/stale persistence");
                        resolve(persistence);
                    }
                } catch (error) {
                    LogMessage(LOG_TYPE.WARN, `Ottomatic reloaded?\n${toastStrong('PLEASE REFRESH PAGE.')}`, error);
                    Messaging.messageAllTabs(REQUEST.STOP_RECORDING); //send a message to all tabs to stop recording, this tab got the ONE selector
                    persistence.isRecording = false;
                    reject(error);
                }
            });
        });
    }
    // A cold service worker can receive a message before init() has loaded persistence; handlers await this first.
    static readyPromise = null;

    static ready() {
        if (!Persistence.readyPromise)
            Persistence.readyPromise = (persistence
                ? Promise.resolve(persistence)
                : Persistence.reloadPersistence(true))
                .catch(error => {
                    // the background has no page to toast onto
                    console.error('[GPAL] persistence failed to load, recording cannot work', error);
                    // showToast throws without a document; don't let it skip the retry reset
                    try {
                        LogMessage(LOG_TYPE.ERROR, `Unable to load saved data.<br>Recording will not work.`, error);
                    } catch (toastError) { /* background: nothing to draw on, console.error above carried it */ }
                    Persistence.readyPromise = null;   // let the next message try again
                });

        return Persistence.readyPromise;
    }

    static inSave = false;
    // saves are serialised: each writes the whole object, so overlapping writes would lose data
    static pendingSaves = 0;
    static saveChain = Promise.resolve();

    //method to save persistence object
    static savePersistence(functionaAndThen) {
        const err = new Error();
        const callerLine = err.stack.split("\n")[2];
        const callerName = callerLine.trim().split(" ")[1];

        const callback = functionaAndThen;
        // queued, not refused: callers await the callback
        Persistence.pendingSaves++;
        this.inSave = true;
        Globals.weAreSaving = true;
        if (true == Globals.debug)
            console.log(`${Globals.nowAsShortDate()} - caller: ${callerName} / ${typeof contentId !== 'undefined' ? contentId : Globals.currentContentID} saving persistence / steps: ${persistence.Workflow.length} / selectors: ${persistence.selectorSets.length}`);
        
        async function save() {
            try {
                return new Promise(function (resolve, reject) {
                    persistence.savedByID = typeof contentId !== 'undefined' ? contentId : Globals.currentContentID;
                    persistence.timestamp = Date().toLocaleString();
                    BROWSER.storage.local.set({ "persistence": persistence }, function () {
                        if (BROWSER.runtime.lastError) {
                            if (true == BROWSER.runtime.lastError.toString().includes('Extension context invalidated'))
                                LogMessage(LOG_TYPE.WARN, `Ottomatic reloaded?<br>${toastStrong('PLEASE REFRESH PAGE')}`);
                            else if (BROWSER.runtime.lastError.message.includes('QUOTA')) {
                                LogMessage(LOG_TYPE.CRITICAL, `${toastStrong('WORKFLOW TOO BIG')}<br>Try turning off images<br>or break up the workflow.`);
                                reject(BROWSER.runtime.lastError);
                            } else {
                                LogMessage(LOG_TYPE.ERROR, "An error occurred while saving persistence:", BROWSER.runtime.lastError.message);
                                reject(BROWSER.runtime.lastError);
                            }
                        } else {
                            // counts only; logging the object makes Chrome retain it on every save
                            debugLog(`[GPAL] saved persistence / steps: ${persistence.Workflow.length} / selectors: ${persistence.selectorSets.length}`);
                            resolve();
                        }
                    });
                }).catch(error => {
                    // lastError is only valid inside the storage callback, so use the rejection's reason
                    const reason = String(error?.message ?? error ?? 'unknown');

                    debugLog(`[GPAL] savePersistence failed: ${reason}`, error);

                    if (true == reason.includes('Extension context invalidated'))
                        LogMessage(LOG_TYPE.WARN, `Ottomatic reloaded?<br>${toastStrong('PLEASE REFRESH PAGE')}`);
                    else if (true == reason.includes('QUOTA'))
                        LogMessage(LOG_TYPE.CRITICAL, `${toastStrong('WORKFLOW TOO BIG')}<br>Try turning off images<br>or break up the workflow.`);
                    else
                        LogMessage(LOG_TYPE.CRITICAL, `Error while saving step.<br>${toastStrong('PLEASE REFRESH PAGE')}`, reason);
                    Messaging.messageAllTabs(REQUEST.STOP_RECORDING); //send a message to all tabs to stop recording, this tab got the ONE selector
                    persistence.isRecording = false;
                });
            } catch (error) {
                debugLog('[GPAL] savePersistence threw', error);
                LogMessage(LOG_TYPE.CRITICAL, `Error while saving step.<br>${toastStrong('PLEASE REFRESH PAGE')}`, String(error?.message ?? error));
                Messaging.messageAllTabs(REQUEST.STOP_RECORDING); //send a message to all tabs to stop recording, this tab got the ONE selector
                persistence.isRecording = false;
            }
        }


        // queued behind any running save; flags clear only when every queued write has landed
        Persistence.saveChain = Persistence.saveChain.then(() => save()).catch(() => { });

        // callback runs off the chain, not in it, so a callback that saves again can't deadlock
        let x = Persistence.saveChain
            .then(() => {
                if (typeof callback === "function")
                    return callback();
            })
            .catch(error => {
                debugLog("persistence save callback failed", error);
            })
            .then(() => {
                if (0 === --Persistence.pendingSaves) {
                    Persistence.inSave = false;
                    Globals.weAreSaving = false;
                }
            });

        return x;
    }

    // Layers stored values over a fresh Persistence/Settings so properties added since the last build get defaults;
    // writes back only if the key sets differ. Run on extension update.
    // NOTE: MUST KEEP IN SYNC WITH MAGIC.
    static async migratePersistenceSchema() {
        try {
            const objectResult = await new Promise((resolve, reject) => {
                BROWSER.storage.local.get("persistence", function (data) {
                    if (BROWSER.runtime.lastError) {
                        reject(BROWSER.runtime.lastError);
                    } else {
                        resolve(data);
                    }
                });
            });

            // Nothing exists yet.
            if (!objectResult || !objectResult.persistence) {
                persistence = new Persistence();
                await Persistence.savePersistence();
                return;
            }

            const storedPersistence = objectResult.persistence;

            // Current schema.
            const currentPersistence = new Persistence();

            mergeIntoCurrentSchema(
                currentPersistence,
                storedPersistence
            );

            const currentSettings = new Settings();

            mergeIntoCurrentSchema(
                currentSettings,
                storedPersistence.settings
            );

            currentPersistence.settings = currentSettings;

            persistence = currentPersistence;

            // Determine whether Persistence changed.
            const persistenceKeys = Object.keys(currentPersistence);
            const storedPersistenceKeys = Object.keys(storedPersistence);

            const persistenceAdded = persistenceKeys.some(
                key => !storedPersistenceKeys.includes(key)
            );

            const persistenceRemoved = storedPersistenceKeys.some(
                key => !persistenceKeys.includes(key)
            );

            const persistenceChanged =
                persistenceAdded || persistenceRemoved;

            // Determine whether Settings changed.
            const settingsKeys = Object.keys(currentSettings);

            const storedSettingsKeys = storedPersistence.settings
                ? Object.keys(storedPersistence.settings)
                : [];

            const settingsAdded = settingsKeys.some(
                key => !storedSettingsKeys.includes(key)
            );

            const settingsRemoved = storedSettingsKeys.some(
                key => !settingsKeys.includes(key)
            );

            const settingsChanged =
                settingsAdded || settingsRemoved;

            if (persistenceChanged || settingsChanged) {
                await Persistence.savePersistence();
            }

        } catch (error) {
            LogMessage(
                LOG_TYPE.ERROR,
                "Unable to migrate Persistence schema.",
                error
            );
        }
        function mergeIntoCurrentSchema(current, stored) {
            if (!stored) {
                return current;
            }

            for (const key of Object.keys(current)) {
                if (Object.prototype.hasOwnProperty.call(stored, key)) {
                    current[key] = stored[key];
                }
            }

            return current;
        }
    }

    static async getStorageUsed(showToast) {
        return new Promise((resolve, reject) => {
            // Get the storage bytes in use
            BROWSER.storage.local.getBytesInUse(null, function (bytesInUse) {
                // QUOTA_BYTES is Chrome-only
                const quota = BROWSER.storage.local.QUOTA_BYTES;
                const used = quota ? `${bytesInUse}/${quota}` : `${bytesInUse}`;
                const message = `  Storage used: ${used} ⬘ ${persistence.selectorSets.length} Selectors/${persistence.Workflow.length} Workflow steps.`;
                if (showToast === true) {
                    LogMessage(LOG_TYPE.NOTICE, message);
                }
                resolve(message);
            });
        });
    }

}

class Variable {
    name;
    type;
    value;

    constructor(name, type, value) {
        this.name = name;
        this.type = type;
        this.value = value;
    }

    static AddVariable(variable) {
        if (false == Variable.FindVariable(variable.name))
            persistence.variables.push(variable);
    }

    static FindVariable(variableName) {
        var variableFound = false;
        persistence.variables.forEach((variable) => {
            if (variableName === variable.name)
                variableFound = true;
        });
        return variableFound;
    }

    static DeleteVariable(variableName) {
        persistence.variables = persistence.variables.filter((variable) => {
            return variableName !== variable.name;
        });
    }
}