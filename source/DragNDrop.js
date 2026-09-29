let isDragging = false;
let startPosition = { x: 0, y: 0 };
let currentPosition = { x: 0, y: 0 };

function handleDragStart(event) {
    isDragging = true;
    startPosition = {
        x: event.clientX,
        y: event.clientY
    };
}

function handleDragMove(event) {
    if (isDragging && 1 === event.buttons) {
        currentPosition = {
            x: event.clientX,
            y: event.clientY
        };

        // Record or process the drag movement here
        // Example: Calculate the distance moved in each direction
        const deltaX = currentPosition.x - startPosition.x;
        const deltaY = currentPosition.y - startPosition.y;
        debugLog('DragMove Delta X:', deltaX);
        debugLog('DragMove Delta Y:', deltaY);
    } else
        isDragging = false;
}

function handleDragEnd(event) {
    isDragging = false;
    // Perform any necessary cleanup or finalization
}

// TODO: continue developing drag-and-drop capture
// Add event listeners to the draggable element
// document.addEventListener('mousedown', handleDragStart);
// document.addEventListener('mousemove', handleDragMove);
// document.addEventListener('mouseup', handleDragEnd);
