//Class used to set/update settings attributes
class Settings {

    withCSS = true;
    withXPath = true;
    withFullXPath = true;
    withSimplifiedXPath = true;
    withText = true;
    withValue = true;
    matchText = true;
    matchValue = true;
    matchHref = true;
    matchSrc = true;
    matchPlaceholder = true;

    withImage = true;
    marginSize = 0;
    previewImage = true;
    compressionPercent = 90;
    imageType = "image/jpeg";
    useIdForName = true;
    recordHoverFocus = false;
    recordDragNDrop = false;
    recordScrollWheel = false;
    recordFocus = false;
    runApi = false;
    clickThru = false;
    recordMousePosition = false;
    waitForHover = 1.2;
    contentDelay = 0;   // delay in each content script before we hook into events, for slow loading sites, like X.
    toastPosition = TOAST_POSITION.bottomRight;
    recordedSound = RECORDED_SOUND.xindi2.key;
    showGenericMatches = true;
    showHoverDetail = true;
    showHoverOutline = true;

    rectangles = true;
    infoMessages = true;
    warnMessages = true;
    errorMessages = true;
    debugMessages = false;
    truncateText = true;    // due to limited local storage, clicking on a lot of text can consume all storage, does not impact FillInFrom
    truncateTextTo = 100;    // due to limited local storage, clicking on a lot of text can consume all storage

    withPublishToConsole;
    withSimulateMouseMovement = true;
    withTypingDelay = true;
    withImageMatchingPercentage = true;
    withExceptionHandler = true;
    withInformationHandler = true;
    withStopOnNotFoundGPAL = true;

    withBrowserType = true;
    withLoadImages = true;
    withBlockPopUps = true;
    withOverwriteExistingFile = true;
    withPromptForDownload = true;
    withDriverLocation = true;
    withDebugPort = false;
    withExistingBrowser = false;
    withAutomationEngine = true;

    // outputs if defined, not controlled by GUI checkboxes
    withOffsetX = true;
    withOffsetY = true;
    withDeltaX = true;
    withDeltaY = true;
};
