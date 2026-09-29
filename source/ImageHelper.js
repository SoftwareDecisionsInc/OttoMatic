class ImageHelper {
    //Functions inside this function must remain inside
    static async takeScreenShot(
        stringImageData,
        workflowStep,
        callback,
        knownRect          // rect taken before the click, when one was grabbed at pointerdown
    ) {
        await new Promise(r => requestAnimationFrame(r));   // let scroll into view happen

        // a pre-click rect is the geometry the image was taken against; the element may be gone
        if (knownRect) {
            workflowStep.selectorSet.boundingRect = knownRect;
            workflowStep.selectorSet.absoluteLeft = knownRect.left;
            workflowStep.selectorSet.absoluteTop = knownRect.top;

            this.cropImageByBoundingRectangle(
                stringImageData,
                workflowStep.selectorSet,
                persistence.settings.marginSize,
                (croppedImageData) => this.finishScreenShot(croppedImageData, workflowStep, callback)
            );

            return;
        }

        // bounding rectangle can be stale, so we should find the element and get it's current bounding rect
        // why would it be stale? due to the order events occur, we will get a focusin before the element scrolls on the page, making the boundingrect wrong
        let candidates = document.querySelectorAll(workflowStep.selectorSet.css);
        let element = null;

        if (candidates.length === 1) {
            element = candidates[0];
        } else if (candidates.length > 1) {
            const expected = (workflowStep.selectorSet.text || workflowStep.selectorSet.value || "").trim();
            for (const el of candidates) {
                const elText = (el.textContent || el.value || "").trim();
                if (expected && elText === expected) {
                    element = el;
                    break;
                }
            }
            if (!element) {
                element = candidates[candidates.length - 1];
            }
        }

        // element gone (e.g. a close box removed by its own click): nothing to crop
        if (!element) {
            debugLog(`[GPAL] takeScreenShot: element gone, keeping the step without an image: ${workflowStep.selectorSet?.selectorName} / ${workflowStep.selectorSet?.css}`);
            showToastContainer();

            if (typeof callback === "function")
                callback();

            return;
        }

        // the element's own rect rather than a whole SelectorSet: all that is wanted here is where it is now
        const currentRect = JSON.parse(JSON.stringify(element.getBoundingClientRect()));

        workflowStep.selectorSet.boundingRect = currentRect;
        workflowStep.selectorSet.absoluteLeft = currentRect.left;
        workflowStep.selectorSet.absoluteTop = currentRect.top;

        // Crop the image by the bounding rectangle of the element action and margin size
        this.cropImageByBoundingRectangle(
            stringImageData,
            workflowStep.selectorSet,
            persistence.settings.marginSize,
            (croppedImageData) => this.finishScreenShot(croppedImageData, workflowStep, callback)
        );
    }

    // hand the cropped image to the background, which owns persistence
    static finishScreenShot(croppedImageData, workflowStep, callback) {
        workflowStep.selectorSet.imageData = croppedImageData ?? workflowStep.selectorSet.imageData;

        Messaging.sendMessageToBackground({
            message: REQUEST.ATTACH_IMAGE,
            selectorName: workflowStep.selectorSet.selectorName,
            imageData: workflowStep.selectorSet.imageData,
            boundingRect: workflowStep.selectorSet.boundingRect,
            absoluteLeft: workflowStep.selectorSet.absoluteLeft,
            absoluteTop: workflowStep.selectorSet.absoluteTop
        });

        showToastContainer();

        if (typeof callback === "function")
            callback();
    }

    // just get the imagedata into the selector
    static getElementImage(
        stringImageData,
        selectorSet,
        callback
    ) {
        this.cropImageByBoundingRectangle(
            stringImageData,
            selectorSet,
            persistence.settings.marginSize,
            callback
        );
    }
    /*

This function below takes photo of the element by cropping an image based on a specified bounding rectangle,
adding margin around it, and saving the resulting image data.

- stringImageData: a string representation of the image data to crop
- objectWorkflowStep: an object containing information about the bounding rectangle to crop the image to
- numberMarginSize: the size of the margin to add around the bounding rectangle
- functionAndThen: a function to execute after the image has been cropped and saved

*** to do: needs to add x-y cordinates, and iframe/shadowDOM

*/

    static cropImageByBoundingRectangle(
        stringImageData,
        selectorSet,
        numberMarginSize,
        functionAndThen
    ) {
        // Get the bounding rectangle from objectWorkflowStep and create a canvas with appropriate dimensions of the dest object

        let boundingRectangle = selectorSet.boundingRect;
        let canvas = Object.assign(document.createElement("canvas"), {
            width: boundingRectangle.width + 2 * numberMarginSize,
            height:boundingRectangle.height + 2 * numberMarginSize,
        });

        // Get the 2d context for the canvas and create an image from the provided image data
        let context = canvas.getContext("2d");
        let image = new Image();
        // When the image loads, draw the cropped image to the canvas, save the resulting image data to objectWorkflowStep, and execute functionAndThen if it exists
        image.onload = () => {

            context.drawImage(
                image,
                selectorSet.absoluteLeft,
                selectorSet.absoluteTop,
                canvas.width,
                canvas.height,
                0,
                0,
                canvas.width,
                canvas.height
            );
            context.save();
            let zh = new ZipHelper();
            selectorSet.imageData = zh.compress(canvas.toDataURL(persistence.settings.imageType, persistence.settings.compressionPercent * .01)); // "image/png"

            if (typeof functionAndThen === "function") {
                functionAndThen(selectorSet.imageData);
            }
        };
        // Set the image source to the provided image data string
        image.src = stringImageData;

    }
    static cropAnImage(event) {
        // Get references to the image, crop button, and crop handles
        const imagePreview = document.getElementById('imagePreview');
        const cropButton = document.getElementById('cropButton');
        const cropHandles = document.querySelectorAll('.cropHandle');
        let selector;

        for (const sel of persistence.selectorSets)
            if (sel.selectorName === event.target.id) {
                imagePreview.src = sel.imageData;
                selector = sel;
                break;
            }
        // Add a click event listener to the crop button
        cropButton.addEventListener('click', cropImage);

        // Add mousedown event listeners to the crop handles
        cropHandles.forEach((handle) => {
            handle.addEventListener('mousedown', startResize);
        });

        // Variables to track resize state
        let isResizing = false;
        let startWidth, startHeight, startX, startY;

        // Function to handle the mousedown event and start the resize
        function startResize(e) {
            e.preventDefault();
            isResizing = true;

            // Get the initial dimensions and position of the crop area
            startWidth = imagePreview.width;
            startHeight = imagePreview.height;
            startX = e.clientX;
            startY = e.clientY;

            // Add mousemove and mouseup event listeners to continue and end the resize
            document.addEventListener('mousemove', resizeImage);
            document.addEventListener('mouseup', stopResize);
        }

        // Function to handle the mousemove event and perform the resize
        function resizeImage(e) {
            if (!isResizing) return;

            // Calculate the new dimensions based on the mouse movement
            const newWidth = startWidth + (e.clientX - startX);
            const newHeight = startHeight + (e.clientY - startY);

            // Apply the new dimensions to the crop area
            imagePreview.style.width = newWidth + 'px';
            imagePreview.style.height = newHeight + 'px';
        }

        // Function to handle the mouseup event and stop the resize
        function stopResize() {
            isResizing = false;

            // Remove the mousemove and mouseup event listeners
            document.removeEventListener('mousemove', resizeImage);
            document.removeEventListener('mouseup', stopResize);
        }

        // Function to handle the click event and crop the image
        function cropImage() {
            // Get the crop dimensions and position
            const cropWidth = imagePreview.offsetWidth;
            const cropHeight = imagePreview.offsetHeight;
            const cropLeft = imagePreview.offsetLeft;
            const cropTop = imagePreview.offsetTop;
            imagePreview.classList.remove("hidden");

            // Create a canvas element
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');

            // Set the canvas dimensions to match the cropped area
            canvas.width = cropWidth;
            canvas.height = cropHeight;

            // Draw the cropped image onto the canvas
            context.drawImage(imagePreview, cropLeft, cropTop, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

            // Get the cropped image data as a base64 string
            const croppedImageData = canvas.toDataURL();

            // Do something with the cropped image data
            selector.imageData = croppedImageData;
            imagePreview.classList.add("hidden");

        }

    }
}