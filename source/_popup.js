/*
In summary, this code below retrieves a value from local storage, creates a new object and stores it in
local storage if the retrieved value is null or undefined, and updates various parts of the UI based
on the value of the persistence object.
*/
Globals.currentContentID = 'popup';	// Math.random().toString(36).substring(2);
const body = document.querySelector('#body');

function init() {
	BROWSER.storage.onChanged.addListener(async (changes, area) => {
		if (area === "local" && changes.persistence && false == Globals.weAreSaving) {
			Persistence.reloadPersistence(true).then(() => {
				updateViewState();
				updateSettings();
				updateOutput();
			});
		}
	});

	// cannot use Persistence.reloadPersistence, it doesn't seem to work here
	Persistence.reloadPersistence(true).then(() => {
		if (true == persistence.settings.darkMode)
			darkModeOn();
		else
			darkModeOff();
		body.classList.remove("hidden");
		//Messaging.sendMessageToBackground(REQUEST.GET_MY_FRAME_ID, (response) => {
		//	Globals.currentContentID = response;

		//	BROWSER.tabs.query({ active: true }, function (tabs) {
		//		try {
		//			if (0 < tabs.length && tabs[0].url) {
		//				var startupURL = tabs[0].url;
		//			}
		//		} catch (error) {
		//			LogMessage(LOG_TYPE.DEBUG, "error in getting url in popup.js:", error);
		//		}
		//		LogMessage(LOG_TYPE.DEBUG, "popup.js starting up", startupURL, Globals.currentContentID);
		//	});
		//});

		Globals.nonce = Globals.generateNonce();
		toastPositionDropdown.value = persistence.settings.toastPosition;
		imageTypeDropdown.value = persistence.settings.imageType;
		recordedSoundDropdown.value = persistence.settings.recordedSound;
		compressionPercent.value = persistence.settings.compressionPercent;
		waitForHover.value = persistence.settings.waitForHover
		contentDelay.value = persistence.settings.contentDelay
		marginSize.text = persistence.settings.marginSize;

		updateViewState();
		updateSettings();
		updateOutput();
	});

	// add click event listener
	buttonRecord.addEventListener("click", checkRecordingState, false);
	// add click event listener
	buttonSettings.addEventListener("click", toggleSettingsOrOutput, false);
	// click handler to copy output to clipboard
	buttonCopyAll.addEventListener("click", copyAllOutput, false);
	//new
	buttonEraseAll.addEventListener("click", eraseAllOutput, false);
	//add event listener for download button to call ZIP download function
	buttonDownload.addEventListener("click", zipUpAllTheThings, false);
	//allow logo icon to send user to company website
	buttonSDI.addEventListener("click", goToCompanySite, false);
	//Add reload function to reload button
	buttonReload.addEventListener("click", reloadExtension, false);
	hideDevelopmentOnlyControls();
	//add closeExtension function to 'X' button
	buttonClose.addEventListener("click", closeExtension, false);
	//update-settings function runs on change
	sectionSettings.addEventListener("change", updateSettingsInterface, true);
	toastPositionDropdown.addEventListener('change', updateToastPosition);
	imageTypeDropdown.addEventListener('change', (event) => {
		persistence.settings.imageType = imageTypeDropdown.value;
		Persistence.savePersistence();
	});
	recordedSoundDropdown.addEventListener('change', (event) => {
		persistence.settings.recordedSound = recordedSoundDropdown.value;
		Persistence.savePersistence();
		Globals.beep();
	});
};

// to do: You do have to use getelementbyid() to get a reference to that element
// the reload button is for development only: installType 'development' is an unpacked (Chrome) or temporary (Firefox) load
async function hideDevelopmentOnlyControls() {
	let isDevelopment = false;

	try {
		const me = await BROWSER.management.getSelf();
		isDevelopment = 'development' === me?.installType;
	} catch (error) {
		// fallback: Chrome store installs have update_url (Firefox never does, so this errs toward showing the button)
		isDevelopment = !BROWSER.runtime.getManifest().update_url;
	}

	if (false === isDevelopment)
		buttonReload.classList.add("hidden");
}

// this gets fired first in updateSettingsInterface as type=select-one
// TODO: dynamically move the toast away from the current element so it will not get in a screenshot.
function updateToastPosition(event) {
	const selectedOption = toastPositionDropdown.options[toastPositionDropdown.selectedIndex].value;
	// Handle the selected option
	persistence.settings.toastPosition = selectedOption;
	Persistence.savePersistence();
	Messaging.messageAllTabs({ message: REQUEST.TOAST_POSITION, data: selectedOption });
	Messaging.messageAllTabs({ message: REQUEST.SHOW_TOAST, title: LOG_TYPE.CRITICAL, contents: "Test Toast 1" });
	Messaging.messageAllTabs({ message: REQUEST.SHOW_TOAST, title: LOG_TYPE.CRITICAL, contents: "Test Toast 2" });
	Messaging.messageAllTabs({ message: REQUEST.SHOW_TOAST, title: LOG_TYPE.CRITICAL, contents: "Test Toast 3" });
}
//Function below check's if recording is on/off
function checkRecordingState(objectEvent) {
	if (persistence && persistence.isRecording) {
		stopRecording();
	} else {
		canWeStartRecording();
	}
}

//Function below toggles chrome extension between settings and output
function toggleSettingsOrOutput(objectEvent) {
	switch (persistence.viewMode) {
		default:
		case "output":
			persistence.viewMode = "settings";
			break;
		case "settings":
			persistence.viewMode = "output";
			break;
	}
	Persistence.savePersistence();
	updateViewState();
}

/* This function copies all elements (nodes) in output by using range() */
function copyAllOutput(objectEvent) {
	let range = document.createRange();
	range.selectNode(divOutput);
	window.getSelection().removeAllRanges();
	window.getSelection().addRange(range);
	let lines = window.getSelection().toString().split('\n');

	// Function to remove extra blank lines
	function removeExtraBlankLines(lines) {
		let filteredLines = [];
		let isPreviousLineBlank = false;

		lines.forEach(line => {
			if (line.trim() !== '') {
				filteredLines.push(line);
				isPreviousLineBlank = false;
			} else {
				if (!isPreviousLineBlank) {
					filteredLines.push(line);
					isPreviousLineBlank = true;
				}
			}
		});

		return filteredLines;
	}

	// Array of texts to remove
	const textsToRemove = ['EDIT', 'COPY', 'VIEW', 'IMAGE', 'UPDATE', 'Update', 'IMG', 'TEST', 'DELETE', 'CODE', 'INFO', 'Add Step', ' ⬅ click to highlight on page'];

	// Function to remove specified texts
	function removeSpecifiedTexts(lines, textsToRemove) {
		return lines.filter(line => {
			let shouldRemove = false;
			textsToRemove.forEach(text => {
				if (line.includes(text)) {
					shouldRemove = true;
				}
			});
			return !shouldRemove;
		});
	}

	// Remove specified texts
	lines = removeSpecifiedTexts(lines, textsToRemove);
	// Remove extra blank lines
	lines = removeExtraBlankLines(lines);

	// Comment out non-code lines
	lines = lines.map(line => {
		if (line.trim() !== '' && /\S/.test(line) && !line.includes('static') && !line.includes('.') && !line.includes('=') && !line.includes(';') && !line.includes('(') && !line.includes('{') && !line.includes('}') && !line.includes('GPAL') || line.includes('GPAL event handlers') || line.includes('GPAL Variables')) {
			return `// ${line}`;
		} else {
			return line;
		}
	});

	// Join the lines back together
	const modifiedCode = lines.join('\n');

	window.getSelection().removeAllRanges();

	// only on a real click: the zip export calls this just for the returned string
	if (objectEvent) {
		navigator.clipboard.writeText(modifiedCode).then(() => {
			LogMessage(LOG_TYPE.NOTICE, 'Workflow code copied to clipboard');
		}).catch((err) => {
			debugLog('copyAllOutput clipboard write failed', err);
		});
	}

	return modifiedCode;
}

//effect should be called onCLick
// This function erases all output data after asking for confirmation from the user

function eraseAllOutput(objectEvent) {

	// Call presentDialog() to display a dialog box with the prompt message and two options - confirm and cancel
	presentDialog({
		prompt: "Are you sure you want to erase all?",
		confirm: {
			// If the user confirms the action, call an anonymous function that does the following:
			effect: eraseAllConfirmed,
			// Display a warning message on the confirm button
			warning: "ERASE ALL",
		},
		// If the user cancels the action, set the effect property to null and display "NEVER MIND" on the cancel button
		cancel: {
			effect: null,
			text: "NEVER MIND",
		},
	});
}

//the prompt didn't want to call the erase function in the effect attribute so this was created to delete all ouput after confitming erase all
function eraseAllConfirmed() {
	let isRecording = persistence.isRecording;
	let settings = { ...persistence.settings };
	persistence = new Persistence();
	persistence.isRecording = isRecording;
	persistence.settings = settings;

	// Call updateViewState() to update the state of the view
	updateViewState();
	// Call updateOutput() to update the output displayed on the page
	updateOutput();
	// update persistence which will tell everyone to update their persistence
	Persistence.savePersistence();
	Persistence.getStorageUsed().then(message => {
		easteregg.innerHTML = message;
	});}

function goToCompanySite(objectEvent) {
	const companyBox = document.getElementById("companyBox");

	const isHidden = getComputedStyle(companyBox).display === "none";

	companyBox.style.display = isHidden ? "block" : "none";
}

/*

The method below reloads the background scripts of the extension, but it does not affect any content scripts
that may be running on web pages.

*/
function reloadExtension(objectEvent) {
	presentDialog({
		prompt: "<h2>Are you sure you want to reload?<br><br>Be sure to refresh the page afterwards.</h2>",
		confirm: {
			effect: () => {
				// Kill the native app; the background reloads the extension once the
				// app is actually gone (its disconnect is the signal).
				Messaging.sendMessageToBackground('die');
			},
			warning: "RELOAD",
		},
		cancel: {
			effect: null,
			text: "NEVER MIND",
		},
	});
}


//function to close browser extension
function closeExtension(objectEvent) {
	window.close();
}

// This function updates the settings based on user input
function updateSettingsInterface(objectEvent) {
	// Switch statement checks the type of input element and updates the persistence object accordingly
	switch (objectEvent.target.type) {
		case "checkbox":
			persistence.settings[objectEvent.target.id] = objectEvent.target.checked;
			if ('darkMode' === objectEvent.target.id)
				toggleDarkMode();
			else {
				if ('runApi' === objectEvent.target.id)
					LogMessage(LOG_TYPE.NOTICE, "Reload OttoMatic to affect change.");
				//updateViewState();
				updateSettings();
				//updateOutput();
			}
			break;
		case "number":
			switch (objectEvent.target.id) {
				case "truncateTextTo":	// TODO: refetch text if this changes
					persistence.settings.truncateTextTo = objectEvent.target.value;
					break;
				case "marginSize":
					persistence.settings.marginSize = objectEvent.target.value;
					break;
				case "compressionPercent":
					persistence.settings.compressionPercent = objectEvent.target.value;
					break;
				case "waitForHover":
					persistence.settings.waitForHover = objectEvent.target.value ?? 0;
					break;
				case "contentDelay":
					persistence.settings.contentDelay = objectEvent.target.value ?? 0;
					break;
            }
			break;
	}
	Persistence.savePersistence();
}

/*
The purpose of this code below is to check if the user has given permission to record their activity on
open tabs, and if any tabs have declined to be recorded. If all tabs have given permission to be recorded,
or if there are no tabs open, the function calls actuallyStartDoingTheThings() to begin recording user
activity.

*/

// This function checks if tabs allow recording
function canWeStartRecording() {
	// Get all the tabs in the current window

	BROWSER.tabs.query({ lastFocusedWindow: true }, (tabs) => {
		// Get the total number of tabs in the window
		let numberOfOpenTabs = tabs.length;

		// Keep track of the number of tabs that are cooperative
		let numberOfCooperativeTabs = 0;

		// Send a message to all tabs to check if they can communicate
		messageAllTabs(REQUEST.CAN_WE_COMMUNICATE, (tabId, response) => {
			// If a tab responds positively, increment the cooperative counter
			// this is any content script responding from a tab, this could increment to more
			// TODO: map to tabid instead of simple count
			if (response === RESPONSE.YES_IT_SEEMS_WE_CAN) {
				if (false == Globals.responseTracker[tabId].responded) {
					Globals.responseTracker[tabId].responded = true;
					numberOfCooperativeTabs++;
				}
			}
		});

		// Set a timeout for waiting for tabs to respond
		const DURATION_TO_WAIT_FOR_TABS_TO_RESPOND = 200;
		setTimeout(() => {
			// Calculate the number of non-responsive tabs
			let numberOfNonResponses =
				numberOfOpenTabs - numberOfCooperativeTabs;
			if (numberOfNonResponses > 0) {
				// Create a warning message for tabs that declined to be recorded
				let declinedToBeRecorded =
					" <span class='warning'>declined</span> to be recorded.<br /><br />";

				// Create a summary message of how many tabs were cooperative or not
				let summary =
					numberOfOpenTabs === 1
						? "The only open tab" + declinedToBeRecorded
						: numberOfNonResponses === numberOfOpenTabs
						? numberOfOpenTabs === 2
							? "Both open tabs" + declinedToBeRecorded
							: "All " +
							  numberOfOpenTabs +
							  " open tabs" +
							  declinedToBeRecorded
						: numberOfNonResponses +
						  " of the " +
						  numberOfOpenTabs +
						  " open tabs" +
						  declinedToBeRecorded;

				// Create a commentary message if a lot of tabs are non-responsive
				let commentary =
					numberOfNonResponses > 2 &&
					numberOfNonResponses > numberOfOpenTabs / 2
						? "That's a lot.<br /><br />"
						: "";

				// todo: check if the visible tab is one of the not responding tabs - so we have to respond with our content ids and use the map to map them out

				// Create a prompt message that will be displayed to the user
				let prompt =
					summary +
					commentary +
					"Note that privileged tabs can't be recorded. " +
					"Otherwise if Ottomatic has recently been reloaded, please refresh the necessary tabs.";

				// Display a dialog box with options for the user
				presentDialog({
					prompt: prompt,
					confirm: {
						effect: startRecording,
						text: "START ANYWAY",
					},
					cancel: {
						effect: null,
						text: "NEVER MIND",
					},
				});
			} else {
				// If all tabs responded positively, start recording
				startRecording();
			}
		}, DURATION_TO_WAIT_FOR_TABS_TO_RESPOND);
	});
}

//doing things should be 'recording'
//to do, disable all buttons when recording
//function begins recording

function startRecording() {
	persistence.isRecording = true; //set the isRecording flag to true
	Persistence.savePersistence();
	updateViewState(); //update the view state to reflect the new isRecording value
	window.close(); //close the current window
	Messaging.messageAllTabs(REQUEST.START_RECORDING); //send a message to all tabs to start recording
	Messaging.sendMessageToBackground(REQUEST.START_RECORDING);	// enable context menu
	Messaging.sendMessageToBackground(REQUEST.SHOW_GPAL_ON_CONTEXT_MENU); // for right-click in Tiny MCE editor
}

//to do, enable all buttons after recording stops
// This function stops the recording process by setting the "isRecording" property to false and ZIP's data
function stopRecording() {
	// Update the persistence object with the new "isRecording" value
	persistence.isRecording = false;
	Persistence.savePersistence();
	// After the persistence object has been updated, update the view state
	updateViewState();

	// Send a message to all tabs to stop recording
	Messaging.messageAllTabs(REQUEST.STOP_RECORDING, null);
	Messaging.sendMessageToBackground(REQUEST.STOP_RECORDING);	// disable context menu
	Messaging.sendMessageToBackground(REQUEST.SHOW_COPY_TO_CLIP_ON_CONTEXT);	// now just show the copy options
	// Compress the recorded data into a zip file and download it
	//zipUpAllTheThings();

}

/*
The overall goal of the Messaging.messageAllTabs function is to send a message to all tabs in the current window,
and optionally execute a function after each tab has responded to the message.
*/
function messageAllTabs(message, callback) {
	// Query all tabs in the current window
	BROWSER.tabs.query({ lastFocusedWindow: true }, (tabs) => {
		// For each tab
		for (const tab of tabs) {
			try {
				if (REQUEST.CAN_WE_COMMUNICATE === message)	// prepare to track the replies
					Globals.responseTracker[tab.id] = {
						responded: false
					};
				// Send the message to the tab
				BROWSER.tabs.sendMessage(
					tab.id,
					message,
					{},
					(response) => {
						// If a callback function is provided, execute it with the response as the argument
						if (typeof callback === "function") {
							callback(tab.id, response);
						}

						// Ignore any runtime errors
						void BROWSER.runtime.lastError;
					}
				);
			} catch (error) {
				// Handle different types of errors that can occur when sending messages to tabs
				switch (error.message) {
					// If the message context or extension context is invalidated, log a warning message
					case "Message context invalidated.":
					case "Extension context invalidated.":
						debugLog(
							"Ottomatic has been reloaded since the recording began, and tab ID " +
								tab.id +
								" is now stale."
						);
						break;

					// If the receiving end of the message does not exist (i.e., the tab has closed), log a warning message
					case "Could not establish connection. Receiving end does not exist.":
						debugLog(
							"Tab ID " +
								tab.id +
								" has closed since recording began."
						);
						break;

					// Otherwise, re-throw the error
					default:
					case "The message port was closed before a response was received.":
						debugLog(error);
				}
			}
		}
	});
}

/**
 *
 This function creates a ZIP archive of image files if there is at least one image in the persistence
 Workflow array.
 -  to do: needs to be more sophisticated and return better data
 */
function zipUpAllTheThings() {
	if (persistence.Workflow.length > 0) {
		// Define a helper function that removes the metadata from the beginning of the image data string.
		let removeEverythingUpToAndIncludingTheCommaFrom = (locator) =>
			locator.substring(locator.indexOf(",") + 1);

		// Create a new JSZip object to create the ZIP archive.
		let zip = new ZipHelper();

		// Iterate over each element in the persistence Workflow array that contains image data.
		for (const workflowStep of persistence.Workflow) {
			if (workflowStep.selectorSet && workflowStep.selectorSet.imageData) {
				// Define the filename of the image file.
				let fileName =
					workflowStep.selectorSet.selectorName +
					"." +
					persistence.settings.imageType.split('/')[1];

				// Remove the metadata from the beginning of the image data string.
				let fileContent = removeEverythingUpToAndIncludingTheCommaFrom(
					workflowStep.selectorSet.imageData
				);

				// Add the image file to the ZIP archive.
				zip.addToZip(fileName, fileContent, { base64: true });
			}
		}
		// add code
		zip.addToZip("WorkFlow.cs", copyAllOutput());

		zip.saveToDisk(OUTPUT_ZIP_FILE_NAME);
	}
}

/*

Function below:

_ Toggles the appearance of certain buttons and sections based on whether
the application is in recording mode or not, and whether there are any recorded actions or not.
- Sets the badge text and color for the browser extension depending on whether the application is in
recording mode or not.

* Workflow should be renamed to workflow

*/

// updates the view based on the current state of the application
function updateViewState() {
	// if currently recording, update the button and badge color/text accordingly
	if (persistence && persistence.isRecording) {
		buttonRecord.classList.add("recording"); // add CSS class to indicate recording state
		captionRecord.innerText = "STOP"; // update button caption to indicate that clicking it will stop the recording
		BROWSER.action.setBadgeBackgroundColor({ color: [255, 0, 0, 255] }); // set badge color to red
		BROWSER.action.setBadgeText({ text: "REC" }); // set badge text to "REC"

		buttonCopyAll.disabled = true; // disable "copy all" button
		buttonEraseAll.disabled = true; // disable "erase all" button
		buttonDownload.disabled = true; // disable "download" button
	} else {
		// if not recording, update the button and badge color/text accordingly
		buttonRecord.classList.remove("recording"); // remove CSS class indicating recording state
		captionRecord.innerText = "START"; // update button caption to indicate that clicking it will start the recording
		BROWSER.action.setBadgeBackgroundColor({ color: [0, 0, 0, 0] }); // set badge color to transparent
		BROWSER.action.setBadgeText({ text: "" }); // set badge text to empty string

		buttonCopyAll.disabled = false; // disable "copy all" button
		buttonEraseAll.disabled = false; // disable "erase all" button
		buttonDownload.disabled = false; // disable "download" button
	}

	// check if there are any recorded element actions in the persistence object
	let isRecordingEmpty = persistence.Workflow.length === 0 && !persistence.selectorSet?.length;

	// update the view based on the current view mode (output or settings)
	switch (persistence.viewMode) {
		default:
		case "output": // if in output view mode
			captionSettings.innerText = "SETTINGS"; // update caption of settings button
			buttonSettings.classList.remove("rotating"); // remove CSS class indicating rotation of settings button
			// disable "toggle all" button
			buttonCopyAll.disabled = isRecordingEmpty; // disable "copy all" button if there are no recorded actions
			buttonEraseAll.disabled = isRecordingEmpty; // disable "erase all" button if there are no recorded actions
			buttonDownload.disabled = isRecordingEmpty; // disable "download" button if there are no recorded actions
			buttonReload.disabled = false; // enable "reload" button
			sectionSettings.classList.add("hidden"); // hide settings section
			sectionOutput.classList.remove("hidden"); // show output section
			break;
		case "settings": // if in settings view mode
			captionSettings.innerText = "OUTPUT"; // update caption of settings button
			buttonSettings.classList.add("rotating"); // add CSS class indicating rotation of settings button
			// enable "toggle all" button
			buttonCopyAll.disabled = true; // disable "copy all" button
			buttonEraseAll.disabled = true; // disable "erase all" button
			buttonDownload.disabled = true; // disable "download" button
			buttonReload.disabled = false; // enable "reload" button
			sectionSettings.classList.remove("hidden"); // show settings section
			sectionOutput.classList.add("hidden"); // hide output section
			break;
	}
}

//The overall goal of this code is to update the settings UI with the values from the persistence.settings object
function updateSettings() {
	// Loop through all input checkboxes
	document.querySelectorAll("input[type='checkbox']").forEach((checkBox) => {
		// Set the checked state of each checkbox based on its ID in the persistence settings
		checkBox.checked = persistence.settings[checkBox.id];
	});

	// Set the value of the marginSize input based on the marginSize property in the persistence settings
	marginSize.value = persistence.settings.marginSize || 0;
	truncateTextTo.value = persistence.settings.truncateTextTo;
}

// Clears any active text selection and marks up all element actions based on the current settings.
function updateOutput() {
	window.getSelection().removeAllRanges();
	//pass into markup.js
	outputAllMarkup(persistence.settings, persistence.Workflow);

	// ADD button to add steps to the workflow
	var addButton = document.createElement('button');

	// Small plus icon only
	addButton.textContent = '+';
	addButton.classList.add('addWorkflowStep');

	// Optional: add inline styles for a compact circular + button
	// (you can move these to CSS if you prefer)
	addButton.style.cssText = `
			width: 32px;
			height: 32px;
			padding: 0;
			border: none;
			border-radius: 50%;
			background-color: #4CAF50;   /* green */
			color: white;
			font-size: 20px;
			font-weight: bold;
			line-height: 1;
			display: flex;
			align-items: center;
			justify-content: center;
			cursor: pointer;
		    margin: 20px;
			box-shadow: 0 2px 4px rgba(0,0,0,0.2);
		`;

	// Append the button
	if ('undefined' !== typeof fieldsetWorkflow) {
		fieldsetWorkflow.appendChild(addButton);
	}

	// Click handler stays the same
	addButton.addEventListener('click', (event) => {
		openContextMenu(event);
	});

	// storage readout under the workflow pane
	Persistence.getStorageUsed().then(message => {
		easteregg.innerHTML = message;
	});
};

// Displays a dialog box based on the provided objectDialog
function presentDialog(objectDialog) {
	if (objectDialog) {
		turnTheLightsDown(objectDialog);
	}
	// Turns the lights down, sets the dialog box content and event listeners
	// "turn the lights down" is also used as a metaphorical phrase to refer to the action of displaying the dialog box and dimming the rest of the UI.
	function turnTheLightsDown() {
		divPrompt.innerHTML = toastStrong(objectDialog.prompt);
		if (objectDialog.confirm) {
			if (objectDialog.confirm.text) {
				buttonConfirm.innerText = objectDialog.confirm.text;
				buttonConfirm.classList.remove("warning");
			}
			if (objectDialog.confirm.warning) {
				buttonConfirm.innerText = objectDialog.confirm.warning;
				buttonConfirm.classList.add("warning");
			}
			buttonConfirm.classList.remove("hidden");
			buttonConfirm.addEventListener("click", handleClickConfirm);
		} else {
			buttonConfirm.classList.add("hidden");
		}
		if (objectDialog.cancel) {
			buttonCancel.innerText = objectDialog.cancel.text;
			buttonCancel.classList.remove("hidden");
			buttonCancel.addEventListener("click", handleClickCancel);
		} else {
			buttonCancel.classList.add("hidden");
		}
		sectionDialog.classList.remove("hidden");
		divOverlay.classList.remove("hidden");
		divOverlay.addEventListener("click", handleClickCancel);
	}

	// Turns the lights up, clears the dialog box content and event listeners
	// "turn the lights up" is used as a metaphorical phrase to refer to the action of closing the dialog box and returning the UI to its original state.
	function turnTheLightsUp() {
		divOverlay.removeEventListener("click", handleClickCancel);
		divOverlay.classList.add("hidden");
		sectionDialog.classList.add("hidden");
		if (objectDialog.confirm) {
			buttonConfirm.innerText = "";
			buttonConfirm.removeEventListener("click", handleClickConfirm);
		}
		if (objectDialog.cancel) {
			buttonCancel.innerText = "";
			buttonCancel.removeEventListener("click", handleClickCancel);
		}
		divPrompt.innerHTML = "";
	}

	// Handles the click event on the confirm button and calls the corresponding function if provided
	function handleClickConfirm() {
		turnTheLightsUp(objectDialog);
		if (
			objectDialog.confirm &&
			typeof objectDialog.confirm.effect === "function"
		) {
			objectDialog.confirm.effect();
		}
	}

	// Handles the click event on the cancel button and calls the corresponding function if provided
	function handleClickCancel() {
		turnTheLightsUp(objectDialog);
		if (
			objectDialog.cancel &&
			typeof objectDialog.cancel.effect === "function"
		) {
			objectDialog.cancel.effect();
		}
	}
}
function darkModeOn() {
	body.classList.add('dark-mode');
	renderingOutput.classList.add('dark-mode');
}

function darkModeOff() {
	body.classList.remove('dark-mode');
	renderingOutput.classList.remove('dark-mode');
}

function toggleDarkMode() {
	body.classList.toggle('dark-mode');
	renderingOutput.classList.toggle('dark-mode');
}

function openContextMenu(event) {
	Globals.currentContextMenuEvent = event;
	Globals.currentEvent = event;
	GPALContextMenu.showCustomContextMenu(event, fieldsetWorkflow);
}


/***************************
 * Iniitalize persistence, and handlers
 ***************************/
init();