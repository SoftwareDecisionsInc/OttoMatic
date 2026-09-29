class GPALContextMenu {
    static rootMenu;
    static _initializing = false;  // prevents concurrent init() calls racing on removeAll()+create()

    static insertMenuId;

    static copySubmenuId;
    static copySelectorToClipBoardId;
    static copyCSSToClipBoardId;
    static copyXPathToClipBoardId;
    static copyFullXPathToClipBoardId;
    static copySimplifiedXPathToClipBoardId;
    static copyImageDataToClipBoardId;
    
    static copySelectorToClipBoardId2;
    static copyCSSToClipBoardId2;
    static copyXPathToClipBoardId2;
    static copyFullXPathToClipBoardId2;
    static copySimplifiedXPathToClipBoardId2;
    static copyImageDataToClipBoardId2;

    static hoverSubmenuId;
    static hoverMenuId;
    static altHoverMenuId;

    static waitForSubmenuId;
    static waitForMenuId;
    static altWaitForMenuId;

    static rightClickSubmenuId;
    static AndDownloadMenuId;
    static AndSaveAsMenuId;
    static AndSendToDevicesMenuId;
    static AndCastMenuId;
    static AndPrintMenuId;
    static AndTranslateToEnglishMenuId;
    static AndOpenInNewTabMenuId;
    static AndOpenInNewWindowMenuId;
    static AndOpenIncognitoWindowMenuId;
    static AndCopyLinkAddressMenuId;
    static altWaitForMenuId;

    static CastSubmenuId;
    static CastTabId;
    static CastDesktopId;

    static focusSubmenuId;
    static focusMenuId;
    static altFocusMenuId;

    static GetGridSubmenuId;
    static GetGridMenuId;
    static altGetGridMenuId;

    static updateImageMenuId;
    static updateImageMenuId2;
    static startWorkflowMenuId;
    static withInfiniteScrollMenuId;
    static withSelectorMenuId;

    static deviceId;
    static waitForInMs = '1_000';

    static ignoreOnce = false;

    // wrapper callback for system context menu
    // in order to retain context of 'this' so we can call handleMenuItemClick, we define the method like this
    static handleContextMenuItemClick = (info, tab) => {
        if (0 < tab.id) {
            Globals.currentTabID = tab.id;
            Globals.currentContentID = info.frameId;
            Messaging.messageATab(tab.id, 0, { message: REQUEST.CONTEXT_MENU_CLICK, data: info.menuItemId });
        }
    }

    // Function to handle the click event on the custom menu item
    // background handles these. background tries to stay insync with which tabId and frameId/contentId is currently in focus
    // messages from each frame are sent identifying themselves and each message contains info background attempts to track
    // here the SYSTEM contextmenu click handler delivers this info as well. but we changed to a button click event 
    static handleMenuItemClick(menuItemId) {
        this.MouseOut();

        Messaging.sendMessageToBackground({ message: REQUEST.SET_CURRENT_FRAME_ID, contentId: Globals.currentContentID });    // ensure background knows we are the focused content window
        let target = null;
        var event = Globals.currentEvent || Globals.currentContextMenuEvent;
        if ('undefined' !== typeof event) {
            try {
                // not sure how to check if type exists, typeof throws null ref
                if ('contextmenu' === event.type || 'click' === event.type) {   // click is from our 'add step' button in the popup
                    target = event.target;
                } else {
                    showUnableToGetMessage();
                    return;
                }
            } catch (error) {
                showUnableToGetMessage();
                return;
            }
        } else {
            showUnableToGetMessage();
            return;
        }
        // data for the step (prompted value or WaitFor ms); the background builds the step
        let promptedData;

        // here we are going to create a workflowstep only if the menu item clicked is an action, copy operations don't require it
        switch (menuItemId) {
            case workflowActions.UpdateImage:
            case workflowActions.UpdateImage2: {
                const el = Globals.currentRightClickTarget || event.target;
                if (!el) { showUnableToGetMessage(); return; }
                // Match by CSS selector — more reliable than areEquivalent (which fails on dimension changes)
                const persisted = persistence.selectorSets.find(s => {
                    try { return s && s.css && el.matches(s.css); }
                    catch { return false; }
                });
                if (!persisted) {
                    LogMessage(LOG_TYPE.NOTICE, 'No stored selector matches this element.\nRecord the element first, then use Update Image.');
                    return;
                }
                el.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' });
                Messaging.sendMessageToBackground({ message: REQUEST.CAPTURE_THEN_RESPOND }, (stringImageData) => {
                    if (!stringImageData) return;
                    let fresh = new SelectorSet(el, persistence.indices, false);
                    persisted.boundingRect = fresh.boundingRect;
                    persisted.absoluteLeft = fresh.absoluteLeft;
                    persisted.absoluteTop = fresh.absoluteTop;
                    ImageHelper.cropImageByBoundingRectangle(
                        stringImageData, persisted, persistence.settings.marginSize,
                        () => {
                            persistence.Workflow
                                .filter(s => s.selectorSet?.selectorName === persisted.selectorName)
                                .forEach(s => { s.selectorSet.imageData = persisted.imageData; });
                            Persistence.savePersistence();
                            LogMessage(LOG_TYPE.NOTICE, `Image Updated: ${toastStrong(persisted.selectorName)}`);
                        }
                    );
                });
                return;
            }

            case workflowActions.WithSelector:
            case workflowActions.CreateSelector:
                break;

            // alts take a selector
            case workflowActions.AltFocus:
            case workflowActions.AltHover:
            case workflowActions.AltMoveTo:
            case workflowActions.Focus:
            case workflowActions.Hover:
            case workflowActions.MoveTo:
            case workflowActions.WaitFor:
            case workflowActions.StartWorkflow:
            case workflowActions.AndDownload:
            case workflowActions.AndCast:
                break;

            case workflowActions.AndCopyLinkAddress:
                navigator.clipboard.writeText(window.location.href)
                    .then(() => {
                        debugLog(window.location.href);
                    })
                    .catch(error => {
                        LogMessage(LOG_TYPE.ERROR, 'Unable to copy URL to clipboard', error);
                    });
                return;
                break;

            //case workflowActions.AndOpenIncognitoWindow:
            //case workflowActions.AndOpenInNewTab:
            //case workflowActions.AndOpenInNewWindow:
            //case workflowActions.AndPrint:
            //case workflowActions.AndSendToDevices:
            //case workflowActions.AndTranslateToEnglish:
            //    Messaging.sendMessageToBackground(REQUEST.TRANSLATE_TEXT);  // background has access to tabs, content doesn't we might be in our custom menu...
            //    return;
            //    break;
            //// TODO: generate variable name using indices andor have a second menu items GetGrid(variable)?

            //case workflowActions.AndDownload:
            //    var variableName = tempWorkflowStep.selectorSet.selectorName + "File";
            //    var filename = tempWorkflowStep.selectorSet.selectorName + "Image" + '.' + persistence.settings.imageType.split('/')[1];
            //    Variable.AddVariable(new Variable(variableName, VariableType.GPALFile, filename));   // now a GPALFile variable name
            //    break;

            case workflowActions.GetGrid:
                // grid variable is created by the WorkflowStep constructor in the background
                break;

            case workflowActions.AltWaitFor:
                this.waitForInMs = prompt("Enter time to wait in MS", this.waitForInMs);
                if (null == this.waitForInMs?.trim())   // user clicked cancel
                    return;
                promptedData = this.waitForInMs.trim();
                break;

            case workflowActions.CastDesktop:
            case workflowActions.CastTab:
                if (!this.deviceId)
                    this.deviceId = 'chrome://media-router-internals/';

                this.deviceId = prompt("Enter Device Id\rFrom:", this.deviceId);
                if (null == this.deviceId?.trim())   // user clicked cancel
                    return;
                promptedData = this.deviceId.trim();
                break;

            case workflowActions.CopyCSSToClipboard:
            case workflowActions.CopyCSSToClipboard2:
                Globals.copySelectorOrPartToClipboard(event, "css");
                return;

            case workflowActions.CopyXPathToClipboard:
            case workflowActions.CopyXPathToClipboard2:
                Globals.copySelectorOrPartToClipboard(event, "xPaths");
                return;

            case workflowActions.CopyFullXPathToClipboard:
            case workflowActions.CopyFullXPathToClipboard2:
                Globals.copySelectorOrPartToClipboard(event, "fullXPath");
                return;

            case workflowActions.CopySimplifiedXPathToClipboard:
            case workflowActions.CopySimplifiedXPathToClipboard2:
                Globals.copySelectorOrPartToClipboard(event, "simplifiedXPath");
                return;

            case workflowActions.CopyImageDataToClipboard:
            case workflowActions.CopyImageDataToClipboard2:
                Globals.copySelectorOrPartToClipboard(event, "imageData");
                return;

            case workflowActions.CopySelectorToClipboard:
            case workflowActions.CopySelectorToClipboard2:
                Globals.copySelectorOrPartToClipboard(event);
                return;

            default:
                if (workflowActions.WaitFor == menuItemId)
                    promptedData = this.waitForInMs;
                break;
        }

        // the popup has no page element, so its actions are sent without one
        const onExtensionPage = (typeof location !== 'undefined')
            && location.href.startsWith(BROWSER.runtime.getURL(''));

        const handOff = () => {
            if (onExtensionPage) {
                Messaging.sendMessageToBackground({
                    message: REQUEST.RECORD_FULL_ACTION,
                    action: menuItemId,
                    mainElementData: null,
                    ancestorDataList: [],
                    data: promptedData ?? null,
                    keys: Globals.modifierKeys,
                    frameId: Globals.currentContentID
                });
            } else {
                Messaging.sendMessageToBackground({ message: REQUEST.SET_CURRENT_FRAME_ID, contentId: Globals.currentContentID });    // ensure background knows we are the focused content window
                recordEvent(Globals.currentEvent, menuItemId, null, Globals.currentRightClickTarget || target, promptedData);
            }
        };

        handOff();
        //} else {
        //    LogMessage(LOG_TYPE.NOTICE, REQUEST.CONTEXT_MENU_ITEM1_CLICKED);    // popup tab.id = -1, so send it a messsage, will do desktop toast
        //    void BROWSER.runtime.lastError;
        //}
        function showUnableToGetMessage() {
            debugLog('Unable to get context menu target element');
        }
    }

    static createRootGpalContextMenu() {
        // for some reason, when we unload and then reload, we get this error.
        // we only have one background, maybe rootmenu should be in persistence...
        try {
                this.rootMenu = BROWSER.contextMenus.create({
                    id: 'GPALContextMenu',
                    title: "Ottomatic",
                    contexts: ["all"]
                });
        } catch (error) {
        }
        void BROWSER.runtime.lastError;
    }

    static createRecordingContextMenu() {
        try {
            // NOTE: CAVEAT: BUG: cannot get update image to work reliable, it has to be refactored and I'm not up to it
            this.updateImageMenuId2 = BROWSER.contextMenus.create({ id: workflowActions.UpdateImage2, "title": "Update Selector & Image", "parentId": this.rootMenu, contexts: ["all"], });
            this.copySelectorToClipBoardId2 = BROWSER.contextMenus.create({ id: workflowActions.CopySelectorToClipboard2, "title": "Copy Selector", "parentId": this.rootMenu, contexts: ["all"], });
            this.copyCSSToClipBoardId2 = BROWSER.contextMenus.create({ id: workflowActions.CopyCSSToClipboard2, "title": "Copy CSS", "parentId": this.rootMenu, contexts: ["all"], });
            this.copyXPathToClipBoardId2 = BROWSER.contextMenus.create({ id: workflowActions.CopyXPathToClipboard2, "title": "Copy XPath", "parentId": this.rootMenu, contexts: ["all"], });
            this.copyFullXPathToClipBoardId2 = BROWSER.contextMenus.create({ id: workflowActions.CopyFullXPathToClipboard2, "title": "Copy Full XPath", "parentId": this.rootMenu, contexts: ["all"], });
            this.copySimplifiedXPathToClipBoardId2 = BROWSER.contextMenus.create({ id: workflowActions.CopySimplifiedXPathToClipboard2, "title": "Copy Simplified XPath", "parentId": this.rootMenu, contexts: ["all"], });
            this.copyImageDataToClipBoardId2 = BROWSER.contextMenus.create({ id: workflowActions.CopyImageDataToClipboard2, "title": "Copy Image Data", "parentId": this.rootMenu, contexts: ["all"], });
        } catch (error) {}
        void BROWSER.runtime.lastError;
    }

    static createContextMenu() {
        try {
            this.startWorkflowMenuId = BROWSER.contextMenus.create({ id: workflowActions.StartWorkflow, "title": "StartWorkflow", "parentId": this.rootMenu, contexts: ["all"], });
            this.withSelectorMenuId = BROWSER.contextMenus.create({ id: workflowActions.WithSelector, "title": "WithSelector(selector)", "parentId": this.rootMenu, contexts: ["all"], });
            this.GetGridSubmenuId = BROWSER.contextMenus.create({ id: 'getGridMenu', "title": "GetGrid", "parentId": this.rootMenu, contexts: ["all"], });
            this.GetGridMenuId = BROWSER.contextMenus.create({ id: workflowActions.GetGrid, "title": "GetGrid(gridVariable)", "parentId": this.GetGridSubmenuId, contexts: ["all"], });

            this.CastSubmenuId = BROWSER.contextMenus.create({ id: 'castMenu', "title": "Cast...", "parentId": this.rootMenu, contexts: ["all"], });;
            this.CastTabId = BROWSER.contextMenus.create({ id: 'castTabMenu', "title": "CastTab", "parentId": this.CastSubmenuId, contexts: ["all"], });;
            this.CastDesktopId = BROWSER.contextMenus.create({ id: 'castDesktopMenu', "title": "CastDesktop", "parentId": this.CastSubmenuId, contexts: ["all"], });;

            //this.rightClickSubmenuId = BROWSER.contextMenus.create({ id: 'rightClickMenu', "title": "RightClick...", "parentId": this.rootMenu, contexts: ["all"], });;
            //this.AndCastMenuId = BROWSER.contextMenus.create({ id: workflowActions.AndCast, "title": "And Cast", "parentId": this.rightClickSubmenuId, contexts: ["all"], });
            //this.AndDownloadMenuId = BROWSER.contextMenus.create({ id: workflowActions.AndDownload, "title": "And Download", "parentId": this.rightClickSubmenuId, contexts: ["all"], });
            //this.AndSendToDevicesMenuId = BROWSER.contextMenus.create({ id: workflowActions.AndSendToDevices, "title": "And Send To Device", "parentId": this.rightClickSubmenuId, contexts: ["all"], });
            //this.AndPrintMenuId = BROWSER.contextMenus.create({ id: workflowActions.AndPrint, "title": "And Print", "parentId": this.rightClickSubmenuId, contexts: ["all"], });
            //BROWSER.contextMenus.create({
            //    id: 'separator',
            //    type: 'separator',
            //    contexts: ['all'], // Specify the context in which the divider appears
            //    parentId: this.rightClickSubmenuId
            //});
            //this.AndCopyLinkAddressMenuId = BROWSER.contextMenus.create({ id: workflowActions.AndCopyLinkAddress, "title": "And Copy Link Address", "parentId": this.rightClickSubmenuId, contexts: ["all"], });
            //this.AndOpenIncognitoWindowMenuId = BROWSER.contextMenus.create({ id: workflowActions.AndOpenIncognitoWindow, "title": "And Open Incognito Window", "parentId": this.rightClickSubmenuId, contexts: ["all"], });
            //this.AndOpenInNewWindowMenuId = BROWSER.contextMenus.create({ id: workflowActions.AndOpenInNewTab, "title": "And Open In New Tab", "parentId": this.rightClickSubmenuId, contexts: ["all"], });
            //this.AndOpenInNewTabMenuId = BROWSER.contextMenus.create({ id: workflowActions.AndOpenInNewWindow, "title": "And Open In New Window", "parentId": this.rightClickSubmenuId, contexts: ["all"], });
            //this.AndTranslateToEnglishMenuId = BROWSER.contextMenus.create({ id: workflowActions.AndTranslateToEnglish, "title": "And Translate", "parentId": this.rightClickSubmenuId, contexts: ["all"], });

            this.waitForSubmenuId = BROWSER.contextMenus.create({ id: 'waitforMenu', "title": "WaitFor", "parentId": this.rootMenu, contexts: ["all"], });
            this.waitForMenuId = BROWSER.contextMenus.create({ id: workflowActions.WaitFor, "title": "WaitFor()", "parentId": this.waitForSubmenuId, contexts: ["all"], });
            this.altWaitForMenuId = BROWSER.contextMenus.create({ id: workflowActions.AltWaitFor, "title": "WaitFor(ms)", "parentId": this.waitForSubmenuId, contexts: ["all"], });

            // NOTE: CAVEAT: BUG: cannot get update image to work reliable, it has to be refactored and I'm not up to it
            this.updateImageMenuId = BROWSER.contextMenus.create({ id: workflowActions.UpdateImage, "title": "Update Selector & Image", "parentId": this.rootMenu, contexts: ["all"], });
            this.focusSubmenuId = BROWSER.contextMenus.create({ id: 'focusMenu', "title": "Focus", "parentId": this.rootMenu, contexts: ["all"], });
            this.focusMenuId = BROWSER.contextMenus.create({ id: workflowActions.Focus, "title": "Focus()", "parentId": this.focusSubmenuId, contexts: ["all"], }); // TODO: do we look at the workflow list to see if a WithSelector preceeds this?
            this.altFocusMenuId = BROWSER.contextMenus.create({ id: workflowActions.AltFocus, "title": "Focus(Selector)", "parentId": this.focusSubmenuId, contexts: ["all"], });

            this.hoverSubMenuId = BROWSER.contextMenus.create({ id: 'hoverMenu', "title": "Hover", "parentId": this.rootMenu, contexts: ["all"], });
            this.hoverMenuId = BROWSER.contextMenus.create({ id: workflowActions.Hover, "title": "Hover()", "parentId": this.hoverSubMenuId, contexts: ["all"], });
            this.althoverMenuId = BROWSER.contextMenus.create({ id: workflowActions.AltHover, "title": "Hover(selector)", "parentId": this.hoverSubMenuId, contexts: ["all"], });

            this.MoveToSubmenuId = BROWSER.contextMenus.create({ id: 'moveToMenu', "title": "MoveTo", "parentId": this.rootMenu, contexts: ["all"], });
            this.MoveToMenuId = BROWSER.contextMenus.create({ id: workflowActions.MoveTo, "title": "MoveTo()", "parentId": this.MoveToSubmenuId, contexts: ["all"], });
            this.altMoveToMenuId = BROWSER.contextMenus.create({ id: workflowActions.AltMoveTo, "title": "MoveTo(selector)", "parentId": this.MoveToSubmenuId, contexts: ["all"], });

            this.copySubmenuId = BROWSER.contextMenus.create({ id: 'CopyMenu', "title": "Copy...", "parentId": this.rootMenu, contexts: ["all"], });
            this.copySelectorToClipBoardId = BROWSER.contextMenus.create({ id: workflowActions.CopySelectorToClipboard, "title": "Copy Selector", "parentId": this.copySubmenuId, contexts: ["all"], });
            this.copyCSSToClipBoardId = BROWSER.contextMenus.create({ id: workflowActions.CopyCSSToClipboard, "title": "Copy CSS", "parentId": this.copySubmenuId, contexts: ["all"], });
            this.copyXPathToClipBoardId = BROWSER.contextMenus.create({ id: workflowActions.CopyXPathToClipboard, "title": "Copy XPath", "parentId": this.copySubmenuId, contexts: ["all"], });
            this.copyFullXPathToClipBoardId = BROWSER.contextMenus.create({ id: workflowActions.CopyFullXPathToClipboard, "title": "Copy Full XPath", "parentId": this.copySubmenuId, contexts: ["all"], });
            this.copySimplifiedXPathToClipBoardId = BROWSER.contextMenus.create({ id: workflowActions.CopySimplifiedXPathToClipboard, "title": "Copy Simplified XPath", "parentId": this.copySubmenuId, contexts: ["all"], });
            this.copyImageDataToClipBoardId = BROWSER.contextMenus.create({ id: workflowActions.CopyImageDataToClipboard, "title": "Copy Image Data", "parentId": this.copySubmenuId, contexts: ["all"], });
        } catch (error) { }

        void BROWSER.runtime.lastError;
    }

    static createPopupMenu(menuItems, parentElement) {
        const container = document.createElement('div'); // Use div as the container
        container.classList.add('gpal-popup-container');

        const menu = document.createElement('ul');
        menu.classList.add('gpal-popup-menu');
        container.appendChild(menu); // Append the menu to the container

        menuItems.forEach(item => {
            const menuItem = document.createElement('li');
            menuItem.id = item.id;
            menuItem.textContent = item.title;
            menuItem.dataset.id = item.id;
            menuItem.classList.add('gpal-menuContent');

            // Attach a click event listener to the menu item
            menuItem.addEventListener('click', event => {
                event.stopPropagation(); // Stop click from creating a workflow step
                // Call your click handler with the appropriate parameters
                GPALContextMenu.handleMenuItemClick(item.id);   //, frameId, tabId); // Replace with your actual frameId and tabId
            });

            if (item.children && item.children.length > 0) {
                const submenuContainer = GPALContextMenu.createPopupMenu(item.children, menuItem);

                // we are not the top level menu, which we just create but do not add to document
                // we are a submenu li item, so attach a listener to position the submenu so it appears on-screen
                menuItem.addEventListener('mouseenter', (event) => {
                    submenuContainer.style.left = '0px';    // reset menu x
                    submenuContainer.style.top = '';
                    // Calculate the position based on menuItem's position
                    const menuItemRect = event.target.getBoundingClientRect();
                    const submenu = event.target.querySelector('.gpal-popup-container');
                    let x = 0; // relative, places submenu on the menuitem by about 20px from right edge
                    let y = menuItemRect.bottom;  // Adjusted based on menu item's position


                    // Check if submenu extends beyond the viewport
                    // position is relative to the start point, which is 0px, which opens the submenu on and to the right of menuitem
                    //if (menuItemRect.right + submenu.scrollWidth > window.innerWidth) {
                    //    x -= submenu.scrollWidth;
                    //    submenuContainer.style.left = x + 'px';
                    //}

                    //if (y + submenu.scrollHeight > window.innerHeight) {
                    //    y = Globals.contextMenu.scrollHeight - (2 * submenu.scrollHeight);
                    //    submenuContainer.style.top = y + 'px';
                    //}
                });

            }

            menu.appendChild(menuItem);
        });

        if (parentElement) {
            parentElement.appendChild(container); // Append the container to the parent element
        }

        return container; // Return the container instead of the menu
    }

    static MouseOut() {
        Globals.contextMenuOpen = false;

        if ('undefined' !== typeof Globals.contextMenu.style)
            Globals.contextMenu.style.display = 'none';
    }

    static SendToBackgroundShowGPALContextMenu() {
        Messaging.sendMessageToBackground(REQUEST.SHOW_GPAL_ON_CONTEXT_MENU);
    }

    static SendToBackgroundShowCopyToClipContextMenu() {
        Messaging.sendMessageToBackground(REQUEST.SHOW_COPY_TO_CLIP_ON_CONTEXT);
    }

    static ShowGPALonSystemContext() {
        if (null === Globals.currentContextMenu || ContextMenuType.GPAL !== Globals.currentContextMenu) {
            this.showHideCopyContextMenuItems(false);
            this.showHideGPALContextMenuItems(true);
            Globals.currentContextMenu = ContextMenuType.GPAL;
        }
    }

    static ShowCopyToClipboardOnSystemContext() {
        if (null === Globals.currentContextMenu || ContextMenuType.Copy !== Globals.currentContextMenu) {
            this.showHideGPALContextMenuItems(false);
            this.showHideCopyContextMenuItems(true);
            Globals.currentContextMenu = ContextMenuType.Copy;
        }
    }
    // true = show, false = hide
    static showHideGPALContextMenuItems(showOrHide) {
        // Get all property names of the class
        const propertyNames = Object.getOwnPropertyNames(this);

        // Filter property names that end with "Id"
        var idProperties = propertyNames.filter(propertyName => propertyName.endsWith('Id'));

        // show context menu items for each "Id" property
        idProperties.forEach(idProperty => {
            // Remove the context menu item
            if (this[idProperty]) {
                try {
                    BROWSER.contextMenus.update(this[idProperty], {
                        visible: showOrHide
                    });
                } catch (error) {
                    void BROWSER.runtime.lastError;
                }
            }
        });
        void BROWSER.runtime.lastError;

    }
    // true = show, false = hide
    static showHideCopyContextMenuItems(showOrHide) {
        // Get all property names of the class
        const propertyNames = Object.getOwnPropertyNames(this);

        // Filter property names that end with "Id"
        var idProperties = propertyNames.filter(propertyName => propertyName.endsWith('Id2'));

        // Remove context menu items for each "Id2" property
        idProperties.forEach(idProperty => {
            // hide the context menu item
            if (this[idProperty]) {
                try {
                    BROWSER.contextMenus.update(this[idProperty], {
                        visible: showOrHide
                    });
                } catch (error) {
                    void BROWSER.runtime.lastError;
                }
            }
        });
    }
    // Function to toggle dark mode class on the menu and submenus
    static toggleDarkMode() {
        const menu = Globals.contextMenu;
        const submenus = Globals.contextMenu.querySelectorAll('ul');

        // Toggle the dark-mode class on the main menu
        menu.classList.toggle('dark-mode');

        // Toggle the dark-mode class on submenus
        submenus.forEach((submenu) => {
            submenu.classList.toggle('dark-mode');
        });
    }

    // Function to turn on dark mode
    static darkModeOn() {
        const menu = Globals.contextMenu;
        const submenus = Globals.contextMenu.querySelectorAll('ul');

        // Add the dark-mode class to the main menu
        menu.classList.add('dark-mode');

        // Add the dark-mode class to submenus
        submenus.forEach((submenu) => {
            submenu.classList.add('dark-mode');
        });
    }

    // Function to turn off dark mode
    static darkModeOff() {
        const menu = Globals.contextMenu;
        const submenus = Globals.contextMenu.querySelectorAll('ul');

        // Remove the dark-mode class from the main menu
        menu.classList.remove('dark-mode');

        // Remove the dark-mode class from submenus
        submenus.forEach((submenu) => {
            submenu.classList.remove('dark-mode');
        });
    }

    static showCustomContextMenu(event, addToElement) {
        // Create menu if it doesn't exist
        if (!document.getElementById('popupMenu')) {
            Globals.contextMenu = GPALContextMenu.createPopupMenu(menuStructure);
            Globals.contextMenu.id = 'popupMenu';
            Globals.contextMenu.classList.add('gpal-popup-span');

            Globals.contextMenu.style.position = 'fixed';
            Globals.contextMenu.style.display = 'none';
            Globals.contextMenu.style.zIndex = '10000';

            Globals.contextMenu.addEventListener('mouseover', () => {
                if (false == this.ignoreOnce)
                    Globals.contextMenu.style.display = 'block';
                else
                    this.ignoreOnce = false;
            });

            Globals.contextMenu.addEventListener('mouseout', () => {
                GPALContextMenu.MouseOut();
                Globals.ignoreClickEvent = false;
            });

            addToElement.appendChild(Globals.contextMenu);
        }

        // Dark mode
        if (persistence.settings.darkMode || window.matchMedia('(prefers-color-scheme: dark)').matches) {
            GPALContextMenu.darkModeOn();
        } else {
            GPALContextMenu.darkModeOff();
        }

        event.preventDefault();

        // Show temporarily to measure size
        Globals.contextMenu.style.display = 'block';
        this.ignoreOnce = false;
        const menuRect = Globals.contextMenu.getBoundingClientRect();

        let x = event.clientX;
        let y = event.clientY;

        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // === SUPER SAFE target rect ===
        let targetRect = null;
        if (event.currentTarget && typeof event.currentTarget.getBoundingClientRect === 'function') {
            targetRect = event.currentTarget.getBoundingClientRect();
        } else if (event.target && typeof event.target.getBoundingClientRect === 'function') {
            targetRect = event.target.getBoundingClientRect();
        }

        const padding = 12;

        if (targetRect) {
            const clickX = event.clientX;
            const clickY = event.clientY;

            // Calculate possible positions (only ones that fit on screen)
            const candidates = [];

            // 1. Right side
            if (targetRect.right + menuRect.width + padding < viewportWidth) {
                const posX = targetRect.right + padding;
                const posY = Math.max(8, Math.min(clickY, viewportHeight - menuRect.height - 8));
                candidates.push({ x: posX, y: posY, distance: Math.hypot(posX - clickX, posY + menuRect.height / 2 - clickY) });
            }

            // 2. Left side
            if (targetRect.left - menuRect.width - padding > 0) {
                const posX = targetRect.left - menuRect.width - padding;
                const posY = Math.max(8, Math.min(clickY, viewportHeight - menuRect.height - 8));
                candidates.push({ x: posX, y: posY, distance: Math.hypot(posX + menuRect.width - clickX, posY + menuRect.height / 2 - clickY) });
            }

            // 3. Bottom side
            if (targetRect.bottom + menuRect.height + padding < viewportHeight) {
                const posY = targetRect.bottom + padding;
                const posX = Math.max(8, Math.min(clickX, viewportWidth - menuRect.width - 8));
                candidates.push({ x: posX, y: posY, distance: Math.hypot(posX + menuRect.width / 2 - clickX, posY - clickY) });
            }

            // 4. Top side
            if (targetRect.top - menuRect.height - padding > 0) {
                const posY = targetRect.top - menuRect.height - padding;
                const posX = Math.max(8, Math.min(clickX, viewportWidth - menuRect.width - 8));
                candidates.push({ x: posX, y: posY, distance: Math.hypot(posX + menuRect.width / 2 - clickX, posY + menuRect.height - clickY) });
            }

            // Pick the closest one to the cursor
            if (candidates.length > 0) {
                candidates.sort((a, b) => a.distance - b.distance);
                x = candidates[0].x;
                y = candidates[0].y;
            }
        }

        // Final safety clamp (your original logic)
        if (x + menuRect.width > viewportWidth - 8) {
            x = Math.max(8, x - menuRect.width);
        }
        if (y + menuRect.height > viewportHeight - 8) {
            y = Math.max(8, y - menuRect.height);
        }
        if (x < 8) x = 8;
        if (y < 8) y = 8;


        Globals.contextMenu.style.left = `${x}px`;
        Globals.contextMenu.style.top = `${y}px`;

        Globals.contextMenuOpen = true;

        // === Move mouse inside the menu ===
        setTimeout(() => {
            const menuCenterX = x + (menuRect.width / 2);
            const menuCenterY = y + Math.min(40, menuRect.height / 3);

            const moveEvent = new MouseEvent('mousemove', {
                bubbles: true,
                cancelable: true,
                clientX: menuCenterX,
                clientY: menuCenterY,
                screenX: window.screenX + menuCenterX,
                screenY: window.screenY + menuCenterY,
                view: window
            });

            document.dispatchEvent(moveEvent);
            Globals.contextMenu.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        }, 15);
    }
    static async init() {
        // onStartup and onInstalled can both fire at the same time (browser opens after an
        // extension update).  Guard so only one removeAll()+create() sequence runs at a time;
        // the second caller is a no-op because the first is doing the same full reinit.
        if (this._initializing) return;
        this._initializing = true;

        try {
            await BROWSER.contextMenus.removeAll();
            this.createRootGpalContextMenu();
            this.createContextMenu();
            Globals.currentContextMenu = ContextMenuType.GPAL;
            this.createRecordingContextMenu();
        } catch (error) {
            void BROWSER.runtime.lastError;
        } finally {
            this._initializing = false;
        }

    }
}