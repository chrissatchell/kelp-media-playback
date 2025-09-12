import { debug } from '../utilities/debug.js';
import { emit } from '../utilities/emit.js';
import { ready } from '../utilities/ready.js';
import { reinit } from '../utilities/reinit.js';

customElements.define('kelp-media-playback', class extends HTMLElement {

    // Initialize on connect
    connectedCallback () {
        ready(this);
    }

    // Cleanup global events on disconnect
    disconnectedCallback () {

    }

    // Initialize the component
    // Used in ready() where this is the "instance" parameter of the ready() function
    // and the ready() function body contains the call to init() using instance.init();
    init () {
        console.log('Media Playback component initialized');
    }

    // Render the media playback component
    render () {
        return true;
    }

    /**
     * Handle events
     * @param  {Event} event The event object
     */
    handleEvent (event) {
        if (event.type === 'click') {
            return this.#onClick(event);
        }
        this.#onKeydown(event);
    }

    /**
     * Handle click events
     * @param  {Event} event The event object
     */
    #onClick (event) {

        // Only run on tab buttons
        const btn = event.target instanceof Element ? event.target.closest('[role="tab"]') : null;
        if (!btn) return;

        // Ignore the currently active tab
        if (btn.matches('[aria-selected="true"]')) return;

    }

    /**
     * Handle keydown events
     * @param  {Event} event The event object
     */
    #onKeydown (event) {

        // Only run on keyboard events
        if (!(event instanceof KeyboardEvent)) return;

    }

});