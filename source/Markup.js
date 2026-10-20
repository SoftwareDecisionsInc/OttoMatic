//handles all mark up output structure by calling individuals funtions in sequence
async function outputAllMarkup(settings, Workflow) {
    //reset the output
    divSelectors.innerHTML = "";
    divActions.innerHTML = "";
    //output all selectors on the left
    let nonDuplicateSelectors = persistence.selectorSets;
    allSelectorsOutput(settings, nonDuplicateSelectors);
    //only output the div-actions if div-selectors is not empty
    if (0 < Workflow.length) {
        variablesOutput(settings, Workflow);
        gpalOutput(settings, gpalSettings);
        browserOutput(settings, browserSettings);
        workflowOutput(Workflow);
        exceptionInfoHandlersOutput(settings);
    }
}

function isNumeric(value) {
    return typeof value === 'number' && isFinite(value);
}

//this function is used to prevent the browser from confusing selector action data as html tags by changing text
function escapeDoubleQuotes(maybeString) {
    var retval;
    if (false == isNumeric(maybeString))
        return '@"' + (maybeString || "").toString().replaceAll('"', '""') + '"';
    else
        return maybeString;
}

// used to make the rectangle data more legible
function formatRectangleInfo(objectString) {
  return JSON.stringify(objectString || "")
    .replaceAll('"', "")
    .replaceAll(":", ": ")
    .replaceAll("}", "} ")
    .replaceAll(",", ", ");
}

//apply the same css styling to all selectors
function getSelectorOutput(selectorType, settings, imageData) {
    let result = "";
    let text = '';
    if (settings[selectorType.name] && undefined != selectorType.value) {
        switch (selectorType.name) {
            case 'withXPath':
                for (const xpath of selectorType.value) {
                    text = escapeDoubleQuotes(xpath.xpath);
                    let comment = `// ${xpath.matchedElements} matched element${xpath.matchedElements > 1 ? 's => use with .WithAllThatMatch(numToReturn), else first match' : ''}`;
                    result += `<p1>.<span class='dotnet-method'>${selectorType.func}(</span><span class='dotnet-literal'>${text}</span><span class='dotnet-method'>)</span></p1><span class='dotnet-comment'>   ${comment}</span><br/>`;   // in case we grab something with a lot of text, will mess up display

                }
                break;

            default:
                if ("withImage" === selectorType.name && !imageData)
                    break;  // do not emit .withimage, we don't have a screenshot for some reason, frame, option, etc...

                if ((true == isNumeric(selectorType.value) && 0 != selectorType.value) || "withImage" === selectorType.name)
                    text = selectorType.value;
                else if (0 < selectorType.value.length)
                    text = escapeDoubleQuotes(selectorType.value);
                else
                    return '';  // emptry string, do not emit
                let comment = '';
                if (selectorType.comment)
                    comment = `// ${selectorType.comment}`;
                result += `<p1>.<span class='dotnet-method'>${selectorType.func}(</span><span class='dotnet-literal'>${text}</span><span class='dotnet-method'>)</span></p1><span class='dotnet-comment'>   ${comment}</span><br/>`;   // in case we grab something with a lot of text, will mess up display
                break;
    }
    }
    //cut off
    return result;
}

//check if selector needs to be displayed, if so add css styling and display it
function allSelectorsOutput(settings, selectorSets) {
    let tempInnerHTML;
    let count = 0;
  //loop thorugh element actions to check each selector for true/false
    for (const selectorSet of selectorSets) {
        //displayy selector values based on settings
        //keep these inside because they require WorkflowStep
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
        let tagName = selectorSet.tagName;
        let selectorName = selectorSet.selectorName;
        let imageData = new ZipHelper().decompress(selectorSet.imageData);
        let clientRects = selectorSet.clientRects;
        let boundingRect = selectorSet.boundingRect;
        //append first line
        tempInnerHTML =
            `<span class='dotnet-keyword'>public static</span> <span class='dotnet-class'>Selector</span> <span class='dotnet-identifier'>${selectorName}</span><span class='dotnet-method'> = (</span><span class='dotnet-class'>Selector</span><span class='dotnet-method'>)</span><span class='dotnet-class'>GPAL.</span><span class='dotnet-method'>Selector</span>` +
            "<br>";
        //loop through selctors append their results to result string
        let resultStrings = selectorTypes.map((selectorType) =>
            getSelectorOutput(selectorType, settings, imageData)
        );

        let allSelectorOutput = resultStrings.join("");

        // Brute force: find the last </p1> and insert ; before it
        const lastP1Index = allSelectorOutput.lastIndexOf("</p1>");

        if (lastP1Index !== -1) {
            const before = allSelectorOutput.substring(0, lastP1Index);
            const after = allSelectorOutput.substring(lastP1Index);

            // Only add ; if not already there
            if (!before.trim().endsWith(";")) {
                allSelectorOutput = before + ";" + after;
            }
        }

        allSelectorOutput += "</p1>";

        tempInnerHTML += allSelectorOutput;

        //show screenshot
        if (imageData && settings["previewImage"]) {
            tempInnerHTML +=
                //`<p1><img src='${imageData}'</img></p1>` + "<br>";
                `<p1><img id='${selectorSet.selectorName}' src='${imageData}' title='Click to view'></img></p1><br>`;
        }

        //show x,y element position
        if (settings["rectangles"] && clientRects) {
            try {
                for (let i = 0; 1 == 1; i++) {
                    let rect;
                    // interesting, json.parse object won't iterate, has no length, so brute force try to iterate via index, which does work
                    try {
                        rect = clientRects[i];
                        let regularElementCoordinates = {
                            height: rect.height,
                            width: rect.width,
                            x: rect.x,
                            y: rect.y,
                        };
                        tempInnerHTML +=
                            `<p1><span class='dotnet-comment'>// Client Rect: ${formatRectangleInfo(
                                regularElementCoordinates
                            )}</span></p1>` + "<br>";
                    } catch (error) {
                        // nothing more to iterate
                        break;
                    }
                }
            } catch (error) {
                debugLog("No Client Rects");
            }
        }
        // bounding rect
        let regularElementCoordinates = {
            height: boundingRect?.height ?? 0,
            width: boundingRect?.width ?? 0,
            x: boundingRect?.x ?? 0,
            y: boundingRect?.y ?? 0,
        };
        tempInnerHTML +=
            `<p1><span class='dotnet-comment'>// Bounding Rect: ${formatRectangleInfo(
                regularElementCoordinates
            )}</span></p1>` + "<br>";
        //just add a \n
        divSelectors.innerHTML += wrapInSelectorContainer(tempInnerHTML, selectorSet) + "<br><br>";
    }

    // Find the anchors and extract the data elements to compose the event handler
    let tag = divSelectors.querySelectorAll(`a`);
    // Attach a click event listener to the anchor tag
    if (0 < tag.length)
        tag.forEach((anchor) => {
            anchor.addEventListener('click', function (event) {
                let css = anchor.getAttribute('data-css');
                let parentURL = anchor.getAttribute('data-parenturl');
                let pageURL = anchor.getAttribute('data-pageurl');
                storeCssAndNavigate(event, css, parentURL, pageURL);
            });
        });

    // Find the img tags and attach the preview/download window markup
    tag = divSelectors.querySelectorAll(`img`);

    // Attach a click event listener to the anchor tag
    if (0 < tag.length)
        tag.forEach((img) => {
            img.addEventListener('click', openOriginalImage);
        });

    let overlayButtons = divSelectors.querySelectorAll(`.overlay-buttons`);
    if (overlayButtons)
        overlayButtons.forEach((overlay) => {
            // Find the img tags and attach the preview/download window markup
            tag = overlay.querySelectorAll(`.viewImage`);

            // Attach a click event listener to the anchor tag
            if (0 < tag.length)
                tag[0].addEventListener('click', (event) => {
                    let button = event.target;
                    while (button && 'BUTTON' !== button.tagName) // could be svg or g element clicked
                        button = button.parentElement;

                    let selectorName = button.getAttribute('data-selectorname');
                    if ('' === selectorName)
                        selectorName = button.parentNode.getAttribute('data-selectorname');
                    if ('' === selectorName)
                        selectorName = button.parentNode.parentNode.getAttribute('data-selectorname');                    let selector = SelectorSet.findSelector(selectorName);
                    // Find the img element within the fieldset using a single querySelector

                    // Access the img element or perform any desired operations
                    if (selector.imageData) {
                        openImage(selector.imageData, selectorName);
                    } else {
                        debugLog('No img element found within the fieldset.');
                    }

                });

            tag = overlay.querySelectorAll(`.updateImage`);

            // Attach a click event listener to the update image button — shows mini-menu
            if (0 < tag.length)
                tag[0].addEventListener('click', (event) => {
                    let button = event.target;
                    while (button && 'BUTTON' !== button.tagName)
                        button = button.parentElement;

                    let selectorName = button.getAttribute('data-selectorname');
                    if ('' === selectorName)
                        selectorName = button.parentNode.getAttribute('data-selectorname');
                    if ('' === selectorName)
                        selectorName = button.parentNode.parentNode.getAttribute('data-selectorname');

                    const selectorSet = SelectorSet.findSelector(selectorName);
                    if (!selectorSet) {
                        LogMessage(LOG_TYPE.CRITICAL, `Unable to find Selector ${toastStrong(selectorName)}`);
                        return;
                    }

                    // Remove any existing mini-menu
                    const existing = document.getElementById('gpal-update-menu');
                    if (existing) { existing.remove(); return; }

                    const menu = document.createElement('div');
                    menu.id = 'gpal-update-menu';
                    menu.style.cssText = 'position:fixed;background:#1e1e2e;border:1px solid #585b70;border-radius:6px;padding:4px;z-index:99999;box-shadow:0 4px 16px rgba(0,0,0,.6);min-width:160px';
                    const btnRect = button.getBoundingClientRect();
                    menu.style.left = btnRect.left + 'px';
                    menu.style.top = (btnRect.bottom + 6) + 'px';

                    const mkOpt = (label) => {
                        const opt = document.createElement('div');
                        opt.textContent = label;
                        opt.style.cssText = 'padding:8px 14px;cursor:pointer;color:#cdd6f4;border-radius:4px;white-space:nowrap;font-size:13px';
                        opt.onmouseenter = () => opt.style.background = '#313244';
                        opt.onmouseleave = () => opt.style.background = '';
                        return opt;
                    };

                    const dismiss = () => menu.remove();

                    const openForUpdate = (name, url) => {
                        Messaging.sendMessageToBackground(REQUEST.IGNORE_NEXT_GOTO);
                        Persistence.savePersistence().then(() => window.open(url, '_blank'));
                    };

                    const optOne = mkOpt('Update Image');
                    optOne.addEventListener('click', () => {
                        dismiss();
                        persistence.elementToUpdateSelectorName = selectorName;
                        persistence.selectorNamesToUpdate = [];
                        openForUpdate(selectorName, selectorSet.parentURL);
                    });

                    const optAll = mkOpt('Update All Missing');
                    optAll.addEventListener('click', () => {
                        dismiss();
                        const missing = persistence.selectorSets.filter(s => s && !s.imageData);
                        if (missing.length === 0) {
                            LogMessage(LOG_TYPE.NOTICE, 'All selectors already have images.');
                            return;
                        }
                        const names = missing.map(s => s.selectorName);
                        const firstSel = SelectorSet.findSelector(names[0]);
                        persistence.elementToUpdateSelectorName = names[0];
                        persistence.selectorNamesToUpdate = names.slice(1);
                        if (firstSel) openForUpdate(names[0], firstSel.parentURL);
                    });

                    menu.appendChild(optOne);
                    menu.appendChild(optAll);
                    document.body.appendChild(menu);

                    const closeOnOutside = (e) => {
                        if (!menu.contains(e.target)) { dismiss(); document.removeEventListener('click', closeOnOutside); }
                    };
                    setTimeout(() => document.addEventListener('click', closeOnOutside), 0);
                });

        });

    // all copy to clipboard
    // Find the img tags and attach the preview/download window markup
    tag = divSelectors.querySelectorAll(`.copySelectorToClipboard`);

    // Attach a click event listener to the anchor tag
    if (0 < tag.length)
        tag.forEach((button) => {
            button.addEventListener('click', (event) => {
                // currentTarget is the <button>; event.target may be a child without data-selectorname
                let button = event.currentTarget;
                let selectorName = button.getAttribute('data-selectorname');
                let selector = SelectorSet.findSelector(selectorName);
                Globals.copyObjectClassToClipboard(selector, selectorName);
             });
        });

    // all copy to clipboard
    // Find the img tags and attach the preview/download window markup
    tag = divSelectors.querySelectorAll(`.copyGPALSelectorToClipboard`);

    // Attach a click event listener to the anchor tag
    if (0 < tag.length)
        tag.forEach((button) => {
            button.addEventListener('click', (event) => {
                // currentTarget is the <button>, not the clicked child
                let button = event.currentTarget;
                let selectorName = button.getAttribute('data-selectorname');
                let selector = SelectorSet.findSelector(selectorName);
                Globals.copyGPALSelectorToClipboard(selector, selectorName);
            });
        });

    let containers = divSelectors.querySelectorAll('.selector-container');

    // Attach event listeners to each container
    //containers.forEach((container) => {
        // handled in css using hover
        // const overlayPanel = container.querySelector('.overlay-panel');
        
        //container.addEventListener('mouseenter', () => {
        //    overlayPanel.classList.add('show-overlay');
        //});

        //container.addEventListener('mouseleave', () => {
        //    overlayPanel.classList.remove('show-overlay');
        //});
        /* crop an image handler - on-hold for now
        const img = container.querySelector('img');
        img.addEventListener('click', ImageHelper.cropAnImage);
        */
    //});

    function storeCssAndNavigate(event, css, parentUrl, pageUrl) {
        event.preventDefault();
        event.stopPropagation();

        // Store the XPath or perform any other necessary actions
        persistence.elementToHighlightURL = pageUrl;
        persistence.elementToHighlightCss = css;
        Persistence.savePersistence().then(() => {
        // Open a new tab with the specified URL
            BROWSER.tabs.create({ url: pageUrl });
        });
    }
}

function openImage(dataURL, selectorName) {
    // Create a temporary image element
    var img = new Image();

    // Set the source to the data URL
    img.src = dataURL;

    // When the image is loaded, open the window with the image dimensions
    img.onload = function () {
        // Open a new window and store the reference

        var win = window.open('', 'targetWindow',
            `toolbar=no,
                                    location=no,
                                    status=no,
                                    menubar=no,
                                    scrollbars=no,
                                    resizable=yes,
                                    width=${img.width * 1.2},
                                    height=${img.height * 1.2}`)

        // Set the title of the new window

        // Write the HTML content to the new window
        win.document.write(`<html><title>GPAL Image Preview</title><body><a href="${dataURL}" download="${selectorName}.${persistence.settings.imageType.split('/')[1]}"><img title="Click to download" src="${dataURL}"></a></body></html>`);

        // Close the document write stream
        win.document.close();
    };
}

function openOriginalImage(clickEvent) {
    // Create a temporary image element
    var img = new Image();

    // Set the source to the data URL
    img.src = clickEvent.target.src;

    // When the image is loaded, open the window with the image dimensions
    img.onload = function () {
        // Open a new window and store the reference

        var win = window.open('', 'targetWindow',
                                    `toolbar=no,
                                    location=no,
                                    status=no,
                                    menubar=no,
                                    scrollbars=no,
                                    resizable=yes,
                                    width=${img.width * 1.2},
                                    height=${img.height * 1.2}`)

        // Set the title of the new window

        // Write the HTML content to the new window
        win.document.write(`<html><title>GPAL Image Preview</title><body><a href="${clickEvent.target.src}" download="${clickEvent.target.id}.${persistence.settings.imageType.split('/')[1]}"><img title="Click to download" src="${clickEvent.target.src}"></a></body></html>`);

        // Close the document write stream
        win.document.close();
    };
}

function getModKeys(WorkflowStep) {
  //place modifier key info inside leftclick (alt, shift, control, etc)
  let modifierKeys = "";
  //check for all modifier keys pressed
    for (const modKey in WorkflowStep.keys) {
        //only show if a obj key is true
        if (WorkflowStep.keys[modKey] === true) {
            modifierKeys += "ModifierKeys." + modKey.charAt(0).toUpperCase() + modKey.slice(1) + " | ";
        }
    }
  //replace last space and line with closing paranthesis
  if (modifierKeys[modifierKeys.length - 2] === " | ") {
    modifierKeys = modifierKeys.slice(0, -3);
  }
  return modifierKeys;
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
    return 0 < result.length ? "<span class='dotnet-literal'>" + result + "</span>" : result;
}

function wrapInSelectorContainer(markup, selectorSet) {
    let host = getHost(selectorSet.parentURL);
    let x =
        `
    <fieldset id="${selectorSet.selectorName}" class="fieldsetSelector">\
    <legend><span class="yellow-black-text">${selectorSet.selectorName}</span> @ <a target="_blank" id="${selectorSet.selectorName}" data-css="${selectorSet.css}" data-parenturl="${selectorSet.parentURL}" data-pageurl="${selectorSet.pageURL}">[${host}]</a><span class="orange-black-text"> ⬅ click to highlight on page</span></legend>\
    <div class="selector-container" id="${selectorSet.selectorName}">\
      <div class="overlay-panel" style="height: 0;">\
        <div class="overlay-buttons">\
                <button class="copyGPALSelectorToClipboard" data-selectorname='${selectorSet.selectorName}'>\
                    <svg viewBox="0 0 24 24" width=24 height=24 data-selectorname='${selectorSet.selectorName}'>\
                        <g>\
                            <path fill="currentColor" d="M5 18h4.24a1 1 0 0 0 .71-.29l6.92-6.93L19.71 8a1 1 0 0 0 0-1.42l-4.24-4.29a1 1 0 0 0-1.42 0l-2.82 2.83l-6.94 6.93a1 1 0 0 0-.29.71V17a1 1 0 0 0 1 1Zm9.76-13.59l2.83 2.83l-1.42 1.42l-2.83-2.83ZM6 13.17l5.93-5.93l2.83 2.83L8.83 16H6ZM21 20H3a1 1 0 0 0 0 2h18a1 1 0 0 0 0-2Z"/>\
                        </g>\
                    </svg>\
                    <div id="" class="caption">COPY<br>CODE</div>\
                </button>\

                <button class="copySelectorToClipboard" data-selectorname='${selectorSet.selectorName}'>\
                    <svg viewBox="0 0 36 36" width=24 height=24 data-selectorname='${selectorSet.selectorName}'>\
                        <g>\
                            <path d="M22.6 4h-1.05a3.89 3.89 0 0 0-7.31 0h-.84A2.41 2.41 0 0 0 11 6.4V10h14V6.4A2.41 2.41 0 0 0 22.6 4zm.4 4H13V6.25a.25.25 0 0 1 .25-.25h2.69l.12-1.11a1.24 1.24 0 0 1 .55-.89a2 2 0 0 1 3.15 1.18l.09.84h2.9a.25.25 0 0 1 .25.25z" />
                            <path d="M33.25 18.06H21.33l2.84-2.83a1 1 0 1 0-1.42-1.42l-5.25 5.25l5.25 5.25a1 1 0 0 0 .71.29a1 1 0 0 0 .71-1.7l-2.84-2.84h11.92a1 1 0 0 0 0-2z" />
                            <path d="M29 16h2V6.68A1.66 1.66 0 0 0 29.35 5h-2.27v2H29z" />
                            <path d="M29 31H7V7h2V5H6.64A1.66 1.66 0 0 0 5 6.67v24.65A1.66 1.66 0 0 0 6.65 33h22.71A1.66 1.66 0 0 0 31 31.33v-9.27h-2z" />\
                        </g>\
                    </svg>\
                    <div id="" class="caption">COPY<br>INFO</div>\
                </button>\

                <button class="viewImage" data-selectorname='${selectorSet.selectorName}'>\
                    <svg viewBox="0 0 16 16" width=24 height=24>\
                        <g>\
                            <path fill="currentColor" fill-rule="evenodd" d="M0 8s3-6 8-6s8 6 8 6s-3 6-8 6s-8-6-8-6Zm1.81.13A13.593 13.593 0 0 1 1.73 8l.082-.13c.326-.51.806-1.187 1.42-1.856C4.494 4.635 6.12 3.5 8 3.5c1.878 0 3.506 1.135 4.77 2.514A13.705 13.705 0 0 1 14.27 8a14.021 14.021 0 0 1-1.502 1.986C11.506 11.365 9.88 12.5 8 12.5c-1.878 0-3.506-1.135-4.77-2.514A13.703 13.703 0 0 1 1.81 8.13ZM11 8a3 3 0 1 1-2.117-2.868a1.5 1.5 0 1 0 1.985 1.985A3 3 0 0 1 11 8Z" clip-rule="evenodd"/>
                        </g>\
                    </svg>\
                    <div id="" class="caption">VIEW<br>IMAGE</div>\
                </button>\

                <button class="updateImage" data-selectorname='${selectorSet.selectorName}'>\
                    <svg viewBox="0 0 24 24" width=24 height=24>\
                        <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">\
                            <path d="M11 20H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1a2 2 0 0 0 2-2a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1a2 2 0 0 0 2 2h1a2 2 0 0 1 2 2v4"/><path d="M14.948 13.559a3 3 0 1 0-2.58 2.419M20 21l2-2l-2-2m-3 0l-2 2l2 2"/>\
                        </g>\
                    </svg>\
                    <div id="" class="caption">UPDATE<br>IMAGE</div>\
                </button>\
        </div>\
      </div>\
      ${markup}\
    </div>\
    </fieldset>\
    `;
    return x;

    function getHost(href) {
        return Object.assign(document.createElement('a'), { href }).host;
    }
}

function wrapInWorkflowStepContainer(markup, selectorName) {
    return `
    <div class="workflowstep-container" id="wfs_${selectorName}">`+
// TODO: workflow overlay panel
      //<div class="overlay-panel" style="height: 0;">
      //   <div class="overlay-buttons">
      //    <button class="overlay-button">Copy</button>
      //    <button class="overlay-button">Test</button>
      //    <button class="overlay-image-button">Update</button>
      //  </div>
      //</div>
      `${markup}
    </div>`
}

//Ouput's the workflow for each element
function workflowOutput(Workflow) {
    let result = "";
    // Iterate over the Workflow array
    for (let i = 0; i < Workflow.length; i++) {
        //each cell in array is either object (iframe, selector, etc)
        let workflowStep = Workflow[i];
        // to extract selectors and their sources
        let selectorName = (workflowStep.selectorSet ? workflowStep.selectorSet.selectorName : "") || "";
        // popup steps have no selector: use the last recorded one (only ##selector## templates read this)
        if ('' === selectorName)
            selectorName = persistence.selectorSets?.length
                ? persistence.selectorSets[persistence.selectorSets.length - 1].selectorName
                : PLACEHOLDER_SELECTOR_NAME;
        //click event
        let action = workflowStep.action;
        //value typeds inside input
        let valueInput = (workflowStep.selectorSet && workflowActions.Hover !== action ? workflowStep.selectorSet.value || workflowStep.selectorSet.text : workflowStep.data);
        // no data renders as .Hover(): recordEvent substitutes modifierKeys (an object) and the popup sends null
        if (null == valueInput || 'object' === typeof valueInput)
            valueInput = '';
        // data structure: action and output string
        let modifierKeys = workflowStep.keys;
        // if no keycode exists then assign null
        let keyCode = workflowStep.keys ? workflowStep.keys.keyCode : null;
        //special case only for GoTo URL workstep
        let modKeys = getModKeys2(workflowStep.keys);

        try {   // ignore actions we don't recognize

            switch (action) {
                case workflowActions.LeftClick:
                case workflowActions.LeftClick:
                case workflowActions.RightClick:
                    if (0 == modKeys.length || workflowStep.data) // selectorName present
                        result = workflowMarkup[`Alt${action}`]
                            .replaceAll('##selector##', selectorName);
                    else
                        result = workflowMarkup[action]
                            .replaceAll('##selector##', selectorName)
                            .replaceAll('##modifierkeys##', modKeys);
                    break;

                case workflowActions.SetRange:
                    //if (workflowStep.data) // selectorName present
                    //    result = workflowMarkup[`Alt${action}`]
                    //        .replaceAll('##selector##', selectorName);
                    //else
                        result = workflowMarkup[action]
                            .replaceAll('##selector##', selectorName)
                            .replaceAll('##valueinput##', valueInput);
                    break;

                case workflowActions.GetGrid:
                    result = workflowMarkup[`${action}`]
                        .replaceAll('##variable##', workflowStep.variableName);
                    break;

                case workflowActions.AltDragAndDrop:
                case workflowActions.AltFocus:
                case workflowActions.AltHover:
                case workflowActions.AltMoveTo:
                    result = workflowMarkup[`${action}`]
                        .replaceAll('##selector##', selectorName);
                    break;
                case workflowActions.PressModifierKey:
                case workflowActions.ReleaseModifierKey:
                    result = workflowMarkup[action]
                        .replaceAll('##modifierkeys##', modKeys);
                    break;

                case workflowActions.SendKey:
                    result = workflowMarkup[action]
                        .replace('##vkcode##', isPrintable(keyCode) + keyCode + isPrintable(keyCode));
                    break;

                case workflowActions.GoTo:
                case workflowActions.GoToTab:
                case workflowActions.CloseTab:
                case workflowActions.WithNewTab:
                    result = workflowMarkup[action]
                        .replace('##URL##', (workflowStep.data ? '"' : "") + workflowStep.data + (workflowStep.data ? '"' : ""));
                    break;

                case workflowActions.Focus:
                case workflowActions.GetGrid:
                case workflowActions.InMainDom:
                case workflowActions.MoveTo:
                case workflowActions.StartWorkflow:
                case workflowActions.WithInfiniteScroll:
                    result = workflowMarkup[action];
                    break;

                case workflowActions.InShadowDom:
                case workflowActions.InIframe:
                    result = workflowMarkup[action]
                        .replaceAll('##selector##', selectorName);
                    break;

                case workflowActions.FillInFrom:
                // rightclick
                case workflowActions.AndCast:
                case workflowActions.AndCopyLinkAddress:
                case workflowActions.AndDownload:
                case workflowActions.AndOpenIncognitoWindow:
                case workflowActions.AndOpenInNewTab:
                case workflowActions.AndOpenInNewWindow:
                case workflowActions.AndPrint:
                case workflowActions.AndSendToDevices:
                case workflowActions.AndTranslateToEnglish:
                case workflowActions.ScrollElementVertical:
                case workflowActions.ScrollElementHorizontal:
                case workflowActions.ScrollWindowVertical:
                case workflowActions.ScrollWindowHorizontal:
                    result = workflowMarkup[action]
                        .replaceAll('##valueinput##', valueInput);
                    break;

                case workflowActions.CastDesktop:
                case workflowActions.CastTab:
                    result = workflowMarkup[action]
                        .replaceAll('##valueinput##', workflowStep.data ? `"${workflowStep.data}"` : '');
                    break;

                default:
                    if ('undefined' !== typeof workflowMarkup[action])
                        result = workflowMarkup[action]
                            .replaceAll('##selector##', selectorName)
                            .replaceAll('##valueinput##', valueInput)
                            .replaceAll('##modifierkeys##', modKeys)
                            .replace('##vkcode##', isPrintable(keyCode) + keyCode + isPrintable(keyCode))
                            .replace('##URL##', (workflowStep.data ? '"' : "") + workflowStep.data + (workflowStep.data ? '"' : ""));
                    break;
            }
        } catch (error) {
            LogMessage(LOG_TYPE.ERROR, `No Markup for action [${toastStrong(action)}][${error}]`);
        }
        // last workflow step? add a semicolon
        if (i === Workflow.length - 1)
            result += "<p1><span class='dotnet-method'>.ToGPALObject()</span><span class='dotnet-literal'>;</span></p1>";
            // we cannot close, then it is not assignable to browser
            //result += wrapInWorkflowStepContainer(workflowMarkup[workflowActions.Close], 'close');

        grandResult += wrapInWorkflowStepContainer(result, selectorName);
    }
  //add semicolon at the end
    grandResult += wrapInWorkflowStepContainer('}', 'RunWorkflowEnd');
    divActions.innerHTML += '<fieldset id="fieldsetWorkflow" class="fieldsetWorkflow"><legend><span class="lightgreen-black-text">Workflow</span></legend>' + grandResult + '</fieldset>';

    /* not yet used, for hover over wfs actions, whatever they might be **
    // Select all the container elements
    const containers = divActions.querySelectorAll('.workflowstep-container');

    // Attach event listeners to each container
    containers.forEach((container) => {
        const overlayPanel = container.querySelector('.overlay-panel');

        container.addEventListener('mouseenter', () => {
            overlayPanel.classList.add('show-overlay');
         });

        container.addEventListener('mouseleave', () => {
            overlayPanel.classList.remove('show-overlay');
        });
    });
    /* not yet used, for hover over wfs actions, whatever they might be */
};

let grandResult = '';

//display what gpal settings are on
function gpalOutput(settings, gpalSettings) {
    grandResult = '';
    //will be added under GPAL
    let gpalMarkupHTML = "";
    //if setting is on then append result to make it visible
    for (const setting in settings) {
        //check if true
        if (gpalSettings[setting] && settings[setting]) {
            let settingValue = gpalSettings[setting];
            gpalMarkupHTML +=
                `<p1>.${setting.charAt(0).toUpperCase() + setting.slice(1)
                }(<span class='dotnet-literal'>${("withPublishToConsole" != setting ? settingValue : "")}</span>)</p1>` + "<br>";
        }
    }

    if (gpalMarkupHTML !== "") {
        //remove last break and add semi-colon
        gpalMarkupHTML =
            gpalMarkupHTML.substring(0, gpalMarkupHTML.length - 9) + `;</p1>`;
        //add new line
        gpalMarkupHTML += "<br>";

        //only output 'GPAL' when atleast one setting is on
        grandResult += wrapInWorkflowStepContainer("public static void RunWorkflow() {", 'RunWorkflowStart') +
            `<span class='dotnet-class'>&nbsp;&nbsp;GPAL</span><br>` + gpalMarkupHTML + "<br>";
    } else {
        grandResult += wrapInWorkflowStepContainer("public static RunWorkflow() {", 'RunWorkflowStart') + gpalMarkupHTML + "<br>";
    }
}

//display what browser settings are on
function browserOutput(settings, browserSettings) {
    //will be added under GPAL
    let browserMarkupHTML = ``;

    if (settings["withLoadImages"] === true) {
        browserMarkupHTML += `<span class='dotnet-class'>&nbsp;&nbsp;IBrowser</span> <span class='dotnet-identifier'>browser = </span><span class='dotnet-identifier'></span><span class='dotnet-class'>GPAL</span><span class='dotnet-method'>.Browser</span><br>`;
    }

    //if setting is on then append result to make it visible
    for (const setting in browserSettings) {
        //check if true
        if (browserSettings[setting] && settings[setting]) {
            //Get the parameter (text inside paranthesis)
            let settingValue = browserSettings[setting];
            //special case for enum parameter
            if (settingValue == "BrowserType.Chrome") {
                browserMarkupHTML +=
                    `<p1>.${setting.charAt(0).toUpperCase() + setting.slice(1)
                    }(<span class='dotnet-literal'>BrowserType</span><span class='dotnet-method'>.Chrome</span>)</p1>` +
                    `<br>`;
            } else {
                browserMarkupHTML +=
                    `<p1><span class='dotnet-method'>.${setting.charAt(0).toUpperCase() + setting.slice(1)
                    }(</span><span class='dotnet-literal'>${settingValue}</span><span class='dotnet-method'>)</span></p1>` + `<br>`;
            }
        }
    }
    //add all code under divActions
    grandResult += browserMarkupHTML;
}

//code on bottom left, checks for two settings GPAL settings and hard codes output just like markup class
function exceptionInfoHandlersOutput(settings) {
    let tempHTML = '';
    if (true == settings.withExceptionHandler || true === settings.withInformationHandler)
        tempHTML = '<fieldset class="fieldsetHandlers"><legend><span class="lightgreen-black-text">GPAL event handlers</span></legend>';

    if (settings.withExceptionHandler === true) {
        tempHTML += `
            <span class='dotnet-keyword'>public static void</span> ExceptionHandler(<span class='dotnet-literal'>object</span> sender, <span class='dotnet-class'>EventArgs</span> e) {
                <br>
            <span>
            <p1><span class='dotnet-class'>Debug</span>.WriteLine(((<span class='dotnet-literal'>GPAL.GPALEventArgs</span>)e).Message);</p1>
            <br>
            </span>
            <span>
            <p1><span class='dotnet-class'>Debug</span>.WriteLine(((<span class='dotnet-literal'>GPAL.GPALEventArgs</span>)e).ExceptionRaised?.Message);</p1>
                <br>
            }
            </span>
            <br>
            <br>`;
    }
    if (settings.withInformationHandler === true) {
        tempHTML +=
            `
            <span class='dotnet-keyword'>public static void</span> InformationHandler(<span class='dotnet-literal'>object sender, EventArgs e</span>) {</p1>
            <br>
            <p1><span class='dotnet-class'>Debug</span>.WriteLine(((<span class='dotnet-literal'>GPAL.GPALEventArgs</span>)e).Message);</p1>
            <br>
                }
            </span>
            <br>
            <br>`;
    }
    if (true == settings.withExceptionHandler || true === settings.withInformationHandler)
        tempHTML += "</fieldset>";
    divActions.innerHTML += tempHTML;
}
function variablesOutput(settings, Workflow) {
    const variables = Variable.forOutput(Workflow, settings.withImage);

    if (0 < variables.length) {
        let gpalClass = '';
        let instantiate = '';
        let tempHTML = '<fieldset class="fieldsetHandlers"><legend><span class="lightgreen-black-text">GPAL Variables</span></legend>';
        let resultStrings = variables.map((variable) => {
            switch (variable.type) {
                case VariableType.GPALFile:
                    gpalClass = "public static GPALFile";
                    instantiate = `<span class='dotnet-class'>GPAL.</span><span class='dotnet-method'>File.WithFileName</span>(<span class='dotnet-literal'>` + escapeDoubleQuotes(variable.value) + `</span>).ToGPALObject();`;
                    break;
                case VariableType.Grid:
                    gpalClass = "public static GPALGrid"
                    instantiate = "null";   // `<span class='dotnet-class'>GPAL.</span><span class='dotnet-method'>Grid.ToGPALObject</span>>();`;   // out vars are assigned to
                    break;
                case VariableType.String:
                    gpalClass = "public static string"
                    instantiate = `<span class='dotnet-literal'>` + escapeDoubleQuotes(variable.value) + `</span>;`;
                    break;
            }
            tempHTML += `
            <span class='dotnet-class'>`+ gpalClass + `</span> <span class='dotnet-identifier'>` + variable.name + `</span> = ` + instantiate +
                `<br>`
        });
        tempHTML += "</fieldset>";
        divActions.innerHTML += tempHTML;
    }
}

// right now the only variable we have is for .WithImage which will always be a GPALFile with the name of the file that will download from the extension.
function gpalFileOutput() {

}
function gpalGridOutput() {

}
function isPrintable(whichOrKey) {
    let keyLength = 0;
    try {   // all printable keys have a length of one char
        keyLength = whichOrKey.length;
    } catch (error) {

    }
    return (0x20 == whichOrKey) // space
        || (0x30 <= whichOrKey && whichOrKey <= 0x5A) // ascii
        || (0x60 <= whichOrKey && whichOrKey <= 0x6f) // numpad
        || (0xBA <= whichOrKey && whichOrKey <= 0xC0) // punctuation
        || (0xDB <= whichOrKey && whichOrKey <= 0xDF) // punctuation
        || 1 == keyLength
        ? "'"
        : ""
        ;
}

