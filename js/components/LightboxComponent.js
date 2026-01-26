/**
 * Lightbox Component
 * Handles the image lightbox for zooming
 */

/**
 * Lightbox Component class
 */
class LightboxComponent {
    constructor(lightboxElement, imageElement, closeBtn) {
        this.lightbox = lightboxElement;
        this.image = imageElement;
        this.closeBtn = closeBtn;

        this._initialize();
    }

    /**
     * Initializes the component and sets up event listeners
     * @private
     */
    _initialize() {
        // Close button
        this.closeBtn.addEventListener('click', () => this.close());

        // Click outside image to close
        this.lightbox.addEventListener('click', (e) => {
            if (e.target !== this.image && !this.image.contains(e.target)) {
                this.close();
            }
        });

        // Escape key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen()) {
                this.close();
            }
        });
    }

    /**
     * Opens the lightbox with an image
     * @param {string} src - The image source URL
     */
    open(src) {
        this.image.src = src;
        this.lightbox.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevent scrolling

        // Set ARIA attributes
        this.lightbox.setAttribute('aria-hidden', 'false');
    }

    /**
     * Closes the lightbox
     */
    close() {
        this.lightbox.classList.remove('active');
        this.image.src = '';
        document.body.style.overflow = ''; // Restore scrolling

        // Set ARIA attributes
        this.lightbox.setAttribute('aria-hidden', 'true');
    }

    /**
     * Checks if the lightbox is open
     * @returns {boolean} - True if the lightbox is open
     */
    isOpen() {
        return this.lightbox.classList.contains('active');
    }
}

export default LightboxComponent;
