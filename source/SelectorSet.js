/*
Code is used to create selctors, a pattern used to select elements in an HTML or XML document based
on their attributes, tag names, and relationships with other elements.
*/

class SelectorSet {
    absoluteLeft;
    absoluteTop;
    alt;    // for deag-n-drop items or items that reorder, the only diff MIGHT be ALT, possibly diff imagedata - so include this to identify uniqueness
    attributes; // Create an empty array to store the attributes of each element
    boundingRect; // Element coordinates
    clientRects; // Parent coordinates of element
    css;
    deltaX;    // this is the offset to move the mouse from picking up the element
    deltaY;    // this is the offset to move the mouse from picking up the element
    fullXPath;
    height;
    imageData; // Image string data of element
    left;
    matchhref;
    matchplaceholder;
    matchsrc;
    matchtext;
    matchvalue;
    offsetX;    // offset to click in anchor or other element, starting point in element for drag-and-drop
    offsetY;    // offset to click in anchor or other element, starting point in element for drag-and-drop
    pageURL; //keep track of what web page the element is 
    parentURL;
    scrollX;    // scroll bar X
    scrollY;    // scroll bar Y
    selectorName; // Name of the selector
    simplifiedXPath;
    tagName; // HTML tag name
    text;
    textTruncated;
    top;
    value;
    width;
    xPaths;


    constructor(objectSourceElement, modifiableObjectTagIndices, incrementIndexCount, action) {
        // Create an empty array to store the attributes of each element
        this.attributes = [];
        const attributesObject = {};

        // Get all attributes of the current element
        const attributes = objectSourceElement.attributes;

        // Handle both real elements and pseudo-elements from background
        if (attributes) {
            if (attributes.length !== undefined) {
                // Real DOM element
                for (let i = 0; i < attributes.length; i++) {
                    const attributeName = attributes[i].name;
                    const attributeValue = attributes[i].value;
                    if ('href' !== attributeName)
                        attributesObject[attributeName] = attributeValue.replaceAll('gpal-box-shadow-line-element', '');
                }
            } else {
                // Pseudo-element from background (plain object)
                for (const attributeName in attributes) {
                    if (Object.prototype.hasOwnProperty.call(attributes, attributeName)) {
                        const attributeValue = attributes[attributeName];
                        if ('href' !== attributeName)
                            attributesObject[attributeName] = attributeValue.replaceAll('gpal-box-shadow-line-element', '');
                    }
                }
            }
        }

        // Add the attributesObject to the elementAttributes array
        this.attributes.push(attributesObject);

        if (objectSourceElement.css)
            this.css = objectSourceElement.css;
        else
            try {
                this.css = this.createSelectorOrThrow(objectSourceElement, "css").replaceAll('.gpal-box-shadow-line-element', '');   // somehow, even tho it hasn't been added yet, it comes up...
            } catch (error) {
                console.error(error);
            }

        // now returned when we create 'xpath', but will retain it
        if (objectSourceElement.fullXPath)
            this.fullXPath = objectSourceElement.fullXPath;
        else
            try {
                this.fullXPath = this.createSelectorOrThrow(objectSourceElement, "full xpath");
            } catch (error) {
                console.error(error);
            }

        if (objectSourceElement.simplifiedXPath)
            this.simplifiedXPath = objectSourceElement.simplifiedXPath;
        else
            this.simplifiedXPath = Globals.simplifiedXPath;

        if (objectSourceElement.xPaths)
            this.xPaths = objectSourceElement.xPaths;
        else {
            try {
                this.xPaths = this.createSelectorOrThrow(objectSourceElement, "xpath");
            } catch (error) {
                console.error(error);
            }

            this.xPaths.push(this.findBestMatch(this.fullXPath, objectSourceElement));
            this.xPaths.push(this.findBestMatch(this.simplifiedXPath, objectSourceElement));
            this.xPaths = this.xPaths.filter(item => item && typeof item.xpath !== 'undefined' && item.xpath !== null);   // TODO: CAVEAT: why are we pushing nulls and uindefined? fix that
            // dedupe
            this.xPaths = [...new Map(this.xPaths.map(v => [v.xpath, v])).values()];
        }
        // Find the best XPath by prioritizing the sort for the element usage, interaction or data extraction

        // if element is clickable or editable, then we want the unique xpaths first
        let isClickable = false;
        let isEditable = false;

        if (typeof objectSourceElement.isClickable !== 'undefined') {
            // pseudo-element from background
            isClickable = !!objectSourceElement.isClickable;
            isEditable = !!objectSourceElement.isEditable;
        } else {
            // real DOM element
            isClickable = Globals.isElementClickable(objectSourceElement);
            isEditable = Globals.isElementEditable(objectSourceElement);
        }

        if (isClickable || isEditable) {
            this.xPaths.sort((a, b) => (b ? (a ? a.matchedElements - b.matchedElements : -1) : 1));
        } else {
            // if the element is not clickable or editable, then we want that as a data point and we want the generic paths first
            this.xPaths.sort((a, b) => (a ? (b ? b.matchedElements - a.matchedElements : -1) : 1));
        }

        // let us evaluate the selectors and return them in order, xpaths is already sorted, we need to add fuil and simplified

        this.value = objectSourceElement.value;
        // get our text, then decide if we have to truncate it
        let tempText = objectSourceElement.innerText || objectSourceElement.value || objectSourceElement.textContent || '';

        if (tempText && true == persistence.truncateText && persistence.settings.truncateTextTo < tempText.length && workflowActions.FillInFrom !== action)
            this.textTruncated = true;
        else
            this.textTruncated = false;
        // CAVEAT: do not truncate fillinfrom text, only other elements - why would someone click an element they don't want, except to grab text?
        this.text = true == this.textTruncated && workflowActions.FillInFrom !== action ? tempText.slice(0, persistence.settings.truncateTextTo + 1) : tempText;
        this.alt = objectSourceElement.alt;

        this.href = objectSourceElement.href;
        this.src = objectSourceElement.src;
        this.placeholder = objectSourceElement.placeholder;
        this.tagName = 'uknown';
        try {
            this.tagName = objectSourceElement.tagName.replaceAll("-", ""); // remove dashes from tag name
        } catch (error) { }

        if (incrementIndexCount) {
            let selectorPrefix;
            if (objectSourceElement.id && persistence.settings.useIDForName)
                selectorPrefix = objectSourceElement.id.replaceAll('-', '');
            else
                selectorPrefix = this.tagName.replaceAll('-', '').toLowerCase();

            let idx = persistence.indices[selectorPrefix] || 0;
            this.selectorName = selectorPrefix + "Selector" + idx++; // identifier for element
            persistence.indices[selectorPrefix] = idx;
        }
        this.imageData = ""; // empty image data

        try {
            var clientRects = objectSourceElement.getClientRects();
            var jsonArray = Array.from(clientRects).map(rect => ({
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height,
                top: rect.top,
                right: rect.right,
                bottom: rect.bottom,
                left: rect.left
            }));

            var jsonString = JSON.stringify(jsonArray);
            this.clientRects = JSON.parse(jsonString);
        } catch (error) { }

        try {
            this.boundingRect = JSON.parse(JSON.stringify(objectSourceElement.getBoundingClientRect()));
        } catch (error) { }

        jsonArray = Array.from(this.xPaths).map(xpath => ({
            xpath: xpath.xpath,
            matchedElements: xpath.matchedElements
        }));
        jsonString = JSON.stringify(jsonArray);
        this.xPaths = JSON.parse(jsonString);


        try {
            if ('frame' === this.tagName.toLowerCase() || 'iframe' === this.tagName.toLowerCase() || 0 === Globals.currentContentID) {   // top level document is frameid = 0, don't use the scroll, it's already accounted for
                this.absoluteLeft = this.left = this.boundingRect.left;// + objectSourceElement.offsetLeft - window.scrollX;
                this.absoluteTop = this.top = this.boundingRect.top;// + objectSourceElement.offsetTop - window.scrollY;
            } else
                if (objectSourceElement.shadowRoot) {
                    this.absoluteLeft = this.left = objectSourceElement.offsetLeft;
                    this.absoluteTop = this.top = objectSourceElement.offsetTop;
                } else {
                    this.absoluteLeft = objectSourceElement.absoluteLeft;
                    this.absoluteTop = objectSourceElement.absoluteTop;
                //    this.absoluteLeft = this.left = this.boundingRect.left - window.scrollX;
                //    this.absoluteTop = this.top = this.boundingRect.top - window.scrollY;
                }
        } catch (error) { }

        this.width = objectSourceElement.offsetWidth;
        this.height = objectSourceElement.offsetHeight;

        // Use pre-computed values from serializeElement (works for both real + pseudo)
        this.scrollX = (typeof window !== 'undefined') ? window.scrollX : objectSourceElement.scrollX;
        this.scrollY = (typeof window !== 'undefined') ? window.scrollY : objectSourceElement.scrollY;

        //LogMessage(LOG_TYPE.DEBUG, 'boundingRect:', this.boundingRect);
        //LogMessage(LOG_TYPE.DEBUG, 'clientRects:', this.clientRects);

        try {
            if (true == incrementIndexCount) {  // for real, we are remebering this one, not just comparison
                // flash a dashed outline around the object just saved for user feedback
                objectSourceElement.classList.add(HIGHLIGHTED_BOX_SHADOW_ELEMENT_CLASS);

                setTimeout(() => {
                    objectSourceElement.classList.remove(HIGHLIGHTED_BOX_SHADOW_ELEMENT_CLASS);
                }, 500);
            }
        } catch (error) { }

        this.pageURL = objectSourceElement.pageURL || (typeof window !== 'undefined' ? window.location.href : '');

        if (Globals.currentUrl)
            this.parentURL = Globals.currentUrl;    // we should've gotten a broadcast with this, or we are frameid 0 and set it ourselves.
        else {
            Messaging.sendMessageToBackground(REQUEST.GET_TOP_LEVEL_URL, (url) => {
                this.parentURL = Globals.currentUrl = url;
            });
        }
        this.deltaX = this.deltaY = this.offsetX = this.offsetY = 0;
    }

    findBestMatch(xpath, element) {
        var bestXPath;
        var matchedElements = 999;
        var matchingElements;
        try {
            matchingElements = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        } catch (error) {
            return null;
        }
        for (let i = 0; i < matchingElements.snapshotLength; i++) {
            if (matchingElements.snapshotItem(i) === element) {
                if (matchingElements.snapshotLength < matchedElements) {
                    bestXPath = xpath;
                    matchedElements = matchingElements.snapshotLength;
                }
            }
        }
        return { xpath: bestXPath, matchedElements: matchedElements };
    }

    generateXPath(element) {
        let matchedElements = 999;
        let bestXPath = null;

        // Pseudo-element from background - use pre-computed data
        if (typeof Element === 'undefined' || !(element instanceof Element)) {
            const xpaths = [];
            if (element.fullXPath) xpaths.push({ xpath: element.fullXPath, matchedElements: 1 });
            if (element.simplifiedXPath) xpaths.push({ xpath: element.simplifiedXPath, matchedElements: 1 });
            if (element.xPaths && element.xPaths.length) xpaths.push(...element.xPaths);
            return xpaths;
        }

        // for some reason unable to access this using 'this', i think i have to assign this to another variable so it works nested, otherwise, it is declared twice
        function findBestMatch(xpath, element) {
            var matchingElements;
            try {
                matchingElements = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
            } catch (error) {
                return null;
            }
            for (let i = 0; i < matchingElements.snapshotLength; i++) {
                if (matchingElements.snapshotItem(i) === element) {
                    if (matchingElements.snapshotLength < matchedElements) {
                        matchedElements = matchingElements.snapshotLength;
                    }
                }
            }
            if (999 !== matchedElements)
                return { xpath: xpath, matchedElements: matchedElements };
            else
                return null;
        }

        function getElementWithId(el) {
            try {
                const id = el.getAttribute('id');
                bestXPath = null;
                matchedElements = 999;

                if (id) {
                    const xpath = `//*[@id='${id}']`;
                    return findBestMatch(xpath, el);
                }
            } catch (error) {}
            return null;
        }

        function getElementWithAttributes(el) {
            try {
                const tag = el.tagName.toLowerCase();
                const attributes = ['class', 'name', 'data-*', 'aria-*', 'title', 'alt', 'value', 'placeholder'];    // 'class',     // TODO: make this order configurable, dynamic classes are not useful
                bestXPath = null;
                matchedElements = 999;

                for (const attr of attributes) {
                    const value = el.getAttribute(attr);
                    if (value && -1 === value.indexOf('gpal')) {
                        const xpath = `//${tag}[contains(@${attr}, '${value}')]`;
                        var retval = findBestMatch(xpath, el);
                        if (null !== retval) {
                            bestXPath = retval.xpath;
                            matchedElements = retval.matchedElements;
                        }
                    }
                }

                if (999 !== matchedElements)
                    return { xpath: bestXPath, matchedElements: matchedElements };

            } catch (error) {}
            return null;
        }

        function getElementByText(el) {
            try {
                const text = el.textContent.trim();
                const tag = el.tagName.toLowerCase();
                bestXPath = null;
                matchedElements = 999;

                if (text) {
                    const xpath = `//${tag}[normalize-space()='${text}']`;
                    return findBestMatch(xpath, el);
                }
            } catch (error) {}

            return null;
        }

        function getElementByPosition(el) {
            if (!el) {
                return null;
            }

            try {
                const tag = el.tagName.toLowerCase();
                const siblings = Array.from(el.parentElement ? el.parentElement.children : document.body.children);
                const index = siblings.indexOf(el) + 1;
                bestXPath = null;
                matchedElements = 999;

                if (index > 0 && index <= siblings.length) {
                    const xpath = `//${el.tagName}[${index}]/${tag}`;
                    return findBestMatch(xpath, el);
                }
            } catch (error) { }

            return null;
        }

        function findAnchorAndCreateRelativeXPath(targetElement) {
            if (!targetElement) {
                return null;
            }

            let anchorElement = null;
            let currentNode = targetElement.parentElement;
            //            let currentNode = targetElement.previousElementSibling;
            matchedElements = 999;

            while (currentNode) {
                if (currentNode.id || currentNode.name) {
                    anchorElement = currentNode;
                    break;
                }

                currentNode = currentNode.parentElement;
                //                currentNode = currentNode.previousElementSibling;
            }

            let relativeXPath = '';

            if (anchorElement) {
                const pathSegments = [];
                let tempNode = targetElement;

                while (tempNode !== anchorElement && tempNode !== document.documentElement) {
                    if (tempNode.tagName) {
                        const tagName = tempNode.tagName.toLowerCase();
                        const index = Array.from(tempNode.parentNode.children).indexOf(tempNode) + 1;
                        pathSegments.unshift(`${tagName}[${index}]`);
                    }

                    tempNode = tempNode.parentNode;
                }

                // CAVEAT: fidelity plan mamanger radio button errors getting xpath, not sure why
                // trap for now as it prevents the click from firing
                try {
                    relativeXPath = `${getElementWithId(anchorElement).xpath}/${pathSegments.join('/')}`;
                } catch (error) {
                    void BROWSER.runtime.lastError;
                    return null;
                }
                return findBestMatch(relativeXPath, targetElement);
            }

            return null;
        }

        const xpaths = [
            getElementWithId(element),
            findAnchorAndCreateRelativeXPath(element),
            getElementByPosition(element),
            getElementByText(element),
            getElementWithAttributes(element),
        ];

        return xpaths;
    }

      //generates a selector string for a given HTML element in a specified format (either CSS or XPath)
    createSelectorOrThrow(objectElement, stringSelectorType) {
        if (typeof objectElement !== "object") {
            debugger;
            throw "Parameter 'objectElement' must be of type object.";
        }

        if (
            typeof stringSelectorType !== "string" ||
            stringSelectorType.trim().length === 0
        ) {
            throw "Parameter 'stringSelectorType' must be of type string, must not be empty, and must not consist entirely of white space.";
        }

        let pairedIdentifierExpressions = [];
        let pairedIndexingExpressions = [];
        let separatorExpression = "";

        switch (stringSelectorType) {
            case "css":
                pairedIdentifierExpressions = ["#", ""];
                pairedIndexingExpressions = [":nth-of-type(", ")"];
                separatorExpression = " > ";
                break;

            case "xpath":
                return this.generateXPath(objectElement);

            case "full xpath":
                pairedIdentifierExpressions = ['//*[@id="', '"]'];
                pairedIndexingExpressions = ["[", "]"];
                separatorExpression = "/";
                break;


            default:
                throw "Parameter 'stringSelectorType' must be among {css, xpath, full xpath}.";
        }

        let me = objectElement;
        let myLowerCaseTagName = me && me.tagName ? me.tagName.toLowerCase() : 'unknown';

        let myId = me.id;
        if (myId && stringSelectorType !== "full xpath") {
            return pairedIdentifierExpressions[0] + myId + pairedIdentifierExpressions[1];
        }

        let myParent = me.parentElement;

        // Root element
        if (!myParent) {
            const attrPart = this.getBestAttributeSelector(me, myLowerCaseTagName);
            if (attrPart) {
                return myLowerCaseTagName + attrPart;
            }
            return myLowerCaseTagName;
        }

        // === Build local selector first ===
        let myTagIndex = this.tagIndexAmongSiblings(me);

        let mySelector = myLowerCaseTagName;

        if (stringSelectorType === "css" && this.isClassListUniqueAmongSiblings(me)) {
            for (const CLASS_NAME of me.classList) {
                mySelector += "." + CSS.escape(CLASS_NAME);
            }
        } else if (stringSelectorType === "css") {
            const attrPart = this.getBestAttributeSelector(me, myLowerCaseTagName);
            if (attrPart) {
                mySelector += attrPart;
            } else if (myTagIndex !== null) {
                mySelector += pairedIndexingExpressions[0] + myTagIndex + pairedIndexingExpressions[1];
            }
        } else if (myTagIndex !== null) {
            mySelector += pairedIndexingExpressions[0] + myTagIndex + pairedIndexingExpressions[1];
        }

        // === NEW: Uniqueness check for short selector (CSS only) ===
        if (stringSelectorType === "css") {
            try {
                const matches = document.querySelectorAll(mySelector);
                if (matches.length === 1 && matches[0] === me) {
                    return mySelector;
                }
            } catch (e) {
                // ignore query errors, fall through to full path
            }
        }

        // === Full path (not unique or not CSS) ===
        let myParentSelector = this.createSelectorOrThrow(myParent, stringSelectorType);

        return myParentSelector + separatorExpression + mySelector;
    }

    getBestAttributeSelector(me, tag) {
        if (!me || !me.getAttribute) return null;

        const priority = [
            "name",
            "type",
            "role",
            "aria-label",
            "placeholder",
            "value",
            "src",
            "action",
            "data-testid",
            "data-test-id",
            "data-cy",
            "for",
            "title",
            "href"          // last resort
        ];

        let attributes = [];

        for (const attr of priority) {
            const val = me.getAttribute(attr);
            if (val == null) continue;

            if (this._isAttributeUniqueAmongSiblings(me, attr, val, tag)) {
                attributes.push({ name: attr, value: val });
                if (attributes.length >= 3) break;   // max 3
            }
        }

        if (attributes.length === 0) return null;

        // Build combined attribute selector
        let attrPart = "";
        for (const a of attributes) {
            const escaped = a.value.replace(/'/g, "\\'");
            attrPart += `[${a.name}='${escaped}']`;
        }

        return attrPart;
    }

    // Small helper method
    _isAttributeUniqueAmongSiblings(me, attrName, attrValue, tag) {
        if (!me.parentElement) return true;

        const siblings = me.parentElement.children;
        for (let i = 0; i < siblings.length; i++) {
            const sib = siblings[i];
            if (sib === me) continue;

            if (sib.tagName.toLowerCase() === tag &&
                sib.getAttribute(attrName) === attrValue) {
                return false;
            }
        }
        return true;
    }

    // This function below checks whether an element's class list is unique among its siblings.
    isClassListUniqueAmongSiblings(objectElement) {
        // Throw an error if the input parameter is not an object.
        if (typeof objectElement !== "object") {
            throw "Parameter 'objectElement' must be of type object.";
        }

        let me = objectElement;
        let myParent = me.parentElement;
        if (!myParent) {
            throw "isClassListUniqueAmongSiblings(): Element has unexpectedly been detached from its parent.";
        }

        let mySiblings = myParent.children;
        if (!mySiblings) {
            throw "isClassListUniqueAmongSiblings(): Element has unexpectedly been detached from its siblings.";
        }

        let myClassList = me.classList;
        if (!myClassList) {
            return false;
        }

        // Loop through the siblings and compare their class lists to the element's class list.
        let isMyClassListUniqueAmongSiblings = true;
        for (const MY_SIBLING of mySiblings) {
            if (MY_SIBLING === me) {
                continue;
            }

            let mySiblingClassList = MY_SIBLING.classList;
            if (!mySiblingClassList) {
                continue;
            }
            // Check if the element's class list contains all the classes of the sibling's class list.
            let iHaveAtLeastAllTheClassesMySiblingDoes = true;
            for (const SIBLING_CLASS of mySiblingClassList) {
                if (HIGHLIGHTED_BOX_SHADOW_ELEMENT_CLASS === SIBLING_CLASS)  // ignore our dashed outline
                    continue;
                if (!myClassList.contains(SIBLING_CLASS)) {
                    iHaveAtLeastAllTheClassesMySiblingDoes = false;
                    break;
                }
            }
            // Check if the sibling's class list contains all the classes of the element's class list.
            let mySiblingHasAtLeastAllTheClassesIDo = true;
            for (const MY_CLASS of myClassList) {
                if (HIGHLIGHTED_BOX_SHADOW_ELEMENT_CLASS === MY_CLASS)  // ignore our dashed outline
                    continue;
                if (!mySiblingClassList.contains(MY_CLASS)) {
                    mySiblingHasAtLeastAllTheClassesIDo = false;
                    break;
                }
            }
            // Check if at least one of the siblings has the same class list as the element.
            let atLeastOneOfMySiblingsHasExactlyTheSameClassListIDo =
                true &&
                iHaveAtLeastAllTheClassesMySiblingDoes &&
                mySiblingHasAtLeastAllTheClassesIDo;
            if (atLeastOneOfMySiblingsHasExactlyTheSameClassListIDo) {
                isMyClassListUniqueAmongSiblings = false;
                break;
            }
        }

        return isMyClassListUniqueAmongSiblings;
    }

    //The function determines the position of the element among its siblings with the same tag name.
    tagIndexAmongSiblings(objectElement) {
        // Make sure the parameter is an object
        if (typeof objectElement !== "object") {
            throw "Parameter 'objectElement' must be of type object.";
        }

        // Get the object element and its parent element
        let me = objectElement;
        let myParent = me.parentElement;

        // If the object element doesn't have a parent, throw an error
        if (!myParent) {
            throw "tagIndexAmongSiblings(): Element has unexpectedly been detached from its parent.";
        }

        // If there are no siblings, throw an error
        let mySiblings = myParent.children;
        if (!mySiblings) {
            throw "tagIndexAmongSiblings(): Element has unexpectedly been detached from its siblings.";
        }

        // Initialize variables to track the index of the object element among its siblings
        let myIndex = null;
        let numberOfSiblingsWhoHaveTheSameTagNameAsMe = 0;

        // Loop through each sibling of the parent element
        for (const MY_SIBLING of mySiblings) {
            let mySiblingTagName = MY_SIBLING.tagName;
            if (mySiblingTagName === me.tagName) {
                numberOfSiblingsWhoHaveTheSameTagNameAsMe++;
            }

            if (MY_SIBLING === me) {
                myIndex = numberOfSiblingsWhoHaveTheSameTagNameAsMe;
            }
        }

        // If there are multiple siblings with the same tag name, return the index of the object element
        if (numberOfSiblingsWhoHaveTheSameTagNameAsMe > 1) {
            return myIndex;
        } else {
            return null;
        }
    }

    elementsLikeMe(xpath) {
        const result = document.evaluate(this.simplifiedXPath, document, null, XPathResult.ANY_TYPE, null);

        // Count the number of matching elements
        let count = 0;
        let node = result.iterateNext();
        while (node) {
            count++;
            node = result.iterateNext();
        }
    }

   
    getSimplifiedCSS(simplifiedXPath) {
        // Split the simplified XPath by '/' to get individual node names
        const nodeNames = simplifiedXPath.split('/').filter(Boolean);

        // Generate the simplified CSS selector
        const simplifiedCSS = nodeNames.map((nodeName) => nodeName.split('[')[0]).join(' > ');

        return simplifiedCSS;
    }

    // find elements that match this generic xpath
    static findMatchingXPaths(originalXPath) {
        const matchingData = {
            matches: [],
            simplifiedXPath: null,
            count: 0,
        };

        // first take off every index
        Globals.simplifiedXPath = getSimplifiedXPath(originalXPath);

        // potential matches
        const potentialMatchingNodes = document.evaluate(Globals.simplifiedXPath, document, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);

        let element;
        let count = 0;

        const potentialMatchingElements = [];

        while (element = potentialMatchingNodes.iterateNext()) {
            potentialMatchingElements.push(element);
            count++;
        }

        let OriginalElement = findNodeByXpath(originalXPath);

        // this step eliminates any elements that don't have the same classes as our original element
        // if there are no classes, then they are all the same?
        let filteredMatches = filterElementsByClasses(potentialMatchingElements, OriginalElement.node);

        // if we have 1, that is te OGelement, so no matches
        if (1 < filteredMatches.length) {
            // we do have at least one match, so take the first one and last one and try to come up with the most precise generic xpath we can
            let lvalue = filteredMatches[filteredMatches.length - 1]; // last match
            let rvalue = filteredMatches[0]; // first match
            let xpath1 = new SelectorSet(lvalue, persistence.indices, false).fullXPath;
            let xpath2 = new SelectorSet(rvalue, persistence.indices, false).fullXPath;
            Globals.simplifiedXPath = simplifyXPath(xpath1, xpath2);    // just simplifies one parent node, typically a list item <li>
        }   // else, we use the totally stripped down generic xpath

        matchingData.matches = filteredMatches;
        matchingData.count = filteredMatches.length;
        matchingData.simplifiedXPath = Globals.simplifiedXPath;

        return matchingData;

        function getSimplifiedXPath(xpath) {
            return xpath.replace(/\[\d+\]/g, '');
        }

        function simplifyXPath(xpath1, xpath2) {
            // Split the XPaths by '/' to get individual node names
            const nodes1 = xpath1.split('/').filter(Boolean);
            const nodes2 = xpath2.split('/').filter(Boolean);

            // Find the first differing node index
            let diffIndex = -1;
            for (let i = 0; i < nodes1.length && i < nodes2.length; i++) {
                if (nodes1[i] !== nodes2[i]) {
                    diffIndex = i;
                    break;
                }
            }

            // If a differing node index is found, remove index from that node only
            if (diffIndex >= 0) {
                const simplifiedNodes = [...nodes1];
                simplifiedNodes[diffIndex] = simplifiedNodes[diffIndex].split('[')[0];
                return simplifiedNodes.join('/');
            }

            // If no differing node index is found, return the original XPath
            return xpath1;
        }

        // given an array of elements, remove anything not like the originalElement
        // this is used for highlighting similar elements
        // CAVEAT: but hides a not so great generic xpath generator :(
        // our xpath should only get us these elements
        function filterElementsByClasses(elements, originalElement) {
            let filteredElements;
            // how would we ever get a null original element? yet still we get this error: Cannot read properties of null (reading 'classList')
            if (originalElement && typeof originalElement.classList !== 'undefined' && originalElement.classList) {
                // Get the class list of the original element
                const originalClasses = Array.from(originalElement.classList);

                // Filter the elements array based on matching classes
                filteredElements = elements.filter(element => {
                    // Get the class list of the current element
                    if (element && element.classList) {
                        const currentClasses = Array.from(element.classList);

                        // Check if the current element has the same classes as the original element,
                        // ignoring classes starting with 'gpal'
                        return originalClasses.every(className => {
                            if (className.startsWith('gpal')) {
                                return true; // Ignore the 'gpal' class and move on to the next class
                            } else {
                                return currentClasses.includes(className);
                            }
                        });
                    } else
                        return false;
                });
            } else {
                filteredElements = elements.filter(element => {
                    // Get the class list of the current element
                    if (element.classList)
                        return false;
                    else
                        return true;
                });
            }
            return filteredElements;
        }
    }

    static findSelector(selectorName, returnIndex = false) {
        let retval = null;
        let retCount = null;
        let count = 0;

        persistence.selectorSets.forEach((selectorSet) => {
            if (selectorName === selectorSet.selectorName) {
                retval = selectorSet;
                retCount = count;
            }
            count++;
        });

        if (true == returnIndex)
            return retCount;
        else
            return retval;
    }

    static deleteSelector(selectorName) {
        persistence.selectorSets = persistence.selectorSets.filter((selectorSet) => {
            return selectorName !== selectorSet.selectorName;
        });
    }

    static areEquivalent(set1, set2, action) {
        if (!set1 || !set2) return set1 === set2;

        let areEqual = 
            set1.css === set2.css &&
            set1.xPath === set2.xPath &&
            set1.fullXPath === set2.fullXPath &&
            //set1.selectorName === set2.selectorName &&
            set1.alt === (set2.alt || '') &&
            set1.tagName === set2.tagName &&
            (
                (
                    workflowActions.FillInFrom !== action &&
                    set1.text === (set2.text || '') &&    // could be a text or input where this changes
                    set1.value === (set2.value || '')
                ) ||
                (
                    workflowActions.FillInFrom === action &&
                    set1.text !== (set2.text || '') &&    // could be a text or input where this changes
                    set1.value !== (set2.value || '')
                )
            ) &&
            set1.height === set2.height &&
            set1.width === set2.width &&
            set1.pageURL === set2.pageURL &&
            set1.parentURL == set2.parentURL
            ;
        return areEqual;
    }

    static boundingRectangleAreEquivalent(rect1, rect2) {
        if (!rect1 || !rect2) return rect1 === rect2;

        return (
            rect1.left === rect2.left &&
            rect1.top === rect2.top &&
            rect1.right === rect2.right &&
            rect1.bottom === rect2.bottom &&
            rect1.width === rect2.width &&
            rect1.height === rect2.height &&
            rect1.x === rect2.x &&
            rect1.y === rect2.y
        );
    }

    static findMatchingSelector(selectorToFind) {
        return persistence.selectorSets.filter(selectorSet => selectorSet && true == this.areEquivalent(selectorSet, selectorToFind));   
    }

    /**
     * Serializes the SelectorSet instance into a plain JSON-serializable object.
     * Preserves all important properties while handling complex nested objects/arrays.
     * @returns {Object} Plain object ready for JSON.stringify()
     */
    static  serialize(selector) {
        const serialized = {
            absoluteLeft: selector.absoluteLeft,
            absoluteTop: selector.absoluteTop,
            alt: selector.alt,
            attributes: selector.attributes,           // array of objects
            boundingRect: selector.boundingRect,
            clientRects: selector.clientRects,
            css: selector.css,
            deltaX: selector.deltaX,
            deltaY: selector.deltaY,
            fullXPath: selector.fullXPath,
            height: selector.height,
            imageData: selector.imageData,
            left: selector.left,
            matchhref: selector.matchhref,
            matchplaceholder: selector.matchplaceholder,
            matchsrc: selector.matchsrc,
            matchtext: selector.matchtext,
            matchvalue: selector.matchvalue,
            offsetX: selector.offsetX,
            offsetY: selector.offsetY,
            pageURL: selector.pageURL,
            parentURL: selector.parentURL,
            scrollX: selector.scrollX,
            scrollY: selector.scrollY,
            selectorName: selector.selectorName,
            simplifiedXPath: selector.simplifiedXPath,
            tagName: selector.tagName,
            text: selector.text,
            textTruncated: selector.textTruncated,
            top: selector.top,
            value: selector.value,
            width: selector.width,
            xPaths: selector.xPaths,                   // already cleaned in constructor
            href: selector.href,
            src: selector.src,
            placeholder: selector.placeholder,
            imageData: selector.imageData
        };

        // Remove any undefined values to keep the payload clean
        Object.keys(serialized).forEach(key => {
            if (serialized[key] === undefined) {
                delete serialized[key];
            }
        });

        return serialized;
    }

    /**
     * Static factory method to create a SelectorSet from serialized data.
     * Reconstructs the object without needing a real DOM element.
     * @param {Object} data - The serialized data from .serialize()
     * @returns {SelectorSet} A new SelectorSet instance populated with the data
     */
    static fromSerialized(data) {
        if (!data || typeof data !== 'object') {
            throw new Error("Invalid serialized data for SelectorSet.fromSerialized");
        }

        // Create a pseudo-element that mimics the structure expected by the constructor
        const pseudoElement = {
            // Basic properties
            tagName: data.tagName || 'unknown',
            id: '', // not needed for deserialization
            classList: [], // not needed
            attributes: data.attributes ? data.attributes[0] || {} : {},
            value: data.value,
            innerText: data.text,
            textContent: data.text,
            alt: data.alt,
            href: data.href,
            src: data.src,
            placeholder: data.placeholder,
            offsetWidth: data.width || 0,
            offsetHeight: data.height || 0,
            offsetLeft: data.left || 0,
            offsetTop: data.top || 0,
            absoluteLeft: data.absoluteLeft,
            absoluteTop: data.absoluteTop,
            scrollX: data.scrollX,
            scrollY: data.scrollY,
            pageURL: data.pageURL,

            // Geometry
            getBoundingClientRect: () => data.boundingRect || { left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0, x: 0, y: 0 },
            getClientRects: () => (data.clientRects ? data.clientRects.map(r => ({ ...r })) : []),

            // For XPath generation (already pre-computed)
            fullXPath: data.fullXPath,
            simplifiedXPath: data.simplifiedXPath,
            xPaths: data.xPaths || [],

            // Clickable/editable flags (not critical for most uses)
            isClickable: false,
            isEditable: false
        };

        // Create the instance using the normal constructor but with incrementIndexCount = false
        // so we don't increment counters or add highlight classes
        const selectorSet = new SelectorSet(pseudoElement, {}, false, null);

        // Override with the original serialized values (constructor may have recomputed some)
        Object.keys(data).forEach(key => {
            if (key in selectorSet) {
                selectorSet[key] = data[key];
            }
        });

        // Ensure xPaths is in the cleaned format
        if (data.xPaths) {
            selectorSet.xPaths = Array.isArray(data.xPaths)
                ? data.xPaths
                : [];
        }

        return selectorSet;
    }
}
