import { debug } from '../utilities/debug.js';
import { emit } from '../utilities/emit.js';
import { ready } from '../utilities/ready.js';
import { reinit } from '../utilities/reinit.js';

customElements.define( 'kelp-media-playback', class extends HTMLElement {

    /**
     * Class Fields
     *
     * @type { string | boolean }             targetAttr      The target attribute value or false if not set.
     * @type { HTMLButtonElement | boolean }  playbackButton  The play/pause button element or false if not set.
     * @type { HTMLMediaElement | boolean }   targetMedia     The targeted HTMLMediaElement or false if not found.
     */

    // The target attribute is a string used to select the target HTMLMediaElement by ID.
    targetAttr = false;

    // User provided or generated <button> element for the play/pause ("Playback") button.
    playbackButton = false;

    // The audio or video HTMLMediaElement that needs to be controlled.
    targetMedia = false;


    /**
     *  When connected to the DOM, run the init() method when ready.
     */

    connectedCallback () {
        if ( typeof ready === "function" ) {
            ready(this);
        } else {
            this.init();
        }
    }


    /**
     * When initialized, do a great many things.
     *  1. Don't run if already initialized
     *  2. Get settings
     *  3. Render
     *  4. On "Ready" updates
     */

    init () {

        /*
            1. Don't run if already initialized
        */
        if ( this.hasAttribute( 'is-ready' ) ) return;


        /*
            2. Get settings
        */

        // 2a. Check for the target attribute on <media-playback>, '<media-playback target="<selector>">'.
        this.targetAttr = this.getAttribute( 'target' ) ?? false;

        let _selectorType = ( this.targetAttr && this.targetAttr.startsWith('#') ) ? 'id' : 'other';
        let _mediaSelector = ( _selectorType === 'id' ) ? this.targetAttr : `#${this.targetAttr}`;

        // 2b. Because this is a HTML Web Component the user is expected to provide a child <button> element
        // for the play/pause ("Playback") button. If no button is provided, we will create one later.
        this.playbackButton = this.querySelector('button') instanceof HTMLButtonElement ? this.querySelector('button') : false;

        // 3b. Check the target attribute exists and it can be used to select a HTMLMediaElement.
        this.targetMedia = ( this.targetAttr !== false && document.querySelector( _mediaSelector ) instanceof HTMLMediaElement) ? document.querySelector( _mediaSelector ) : false;

        /*
            3. Render
        */

        // NOTE: If render() does not succeed, then run the code inside the block.
        if ( !this.render() ) {
            if ( typeof debug === "function" ) {
                debug(this, 'The target video element with an ID does not exist');
            }
            return;
        }

        /*
            4. Ready
        */
        if ( typeof emit === "function" ) {
            emit(this, 'media-playback', 'ready');
        }

        this.setAttribute('is-ready', '');
    }


    /**
     * Render the component's HTML structure.
     *  1. Check for a nested video or audio element and set an ID attribute.
     *  2. Use the button element if a child button element is present.
     *  2b. OR Create the button element if no child button element is present.
     *  3. If we have a valid targetMedia, append the button and add event listeners.
     */

    render () {

        /*
            TODO: Wrap contents in a promise that is resolved when the media is ready to play and/or loaded
            Then get the media state (getMediaState)
        */

        /*
            1. Check for a nested video or audio element and set an ID attribute.
        */
        if ( this.querySelector('video, audio') instanceof HTMLMediaElement) {

            let _targetMediaID = `video-${Math.floor(Math.random() * 1000)}`;

            this.targetMedia = this.querySelector('video, audio');

            // Ensure the video has an ID for aria-controls
            this.targetMedia.setAttribute('id', _targetMediaID);
        }

        /*
            2. Use the button element if a child button element is present
        */
        if ( ( this.targetAttr && this.targetMedia ) && this.querySelector('button') ) {
            this.setPlayBackButton();
        }

        /*
            2b. OR Create the button element if no child button element is present
        */
        else if ( this.targetMedia !== false && ! this.querySelector('button') ) {
            this.createPlayBackButton();
        }

        /*
            3. If we have a valid targetMedia, append the button and add event listeners
        */
        if ( this.targetMedia instanceof HTMLMediaElement ) {

            this.appendChild(this.playbackButton);

            this.hasReducedMotion();

            this.onPointerEvents();

            this.onMediaEnded();

        } else {
            return false;
        }

        return true;

    }



    /**
     * Helper and Event Methods.
     */

    getMediaState () {
        if (this.targetMedia.ended) return "ended";
        if (this.targetMedia.paused) return "paused";
        return "playing";
    }

    setPlayBackButton () {
        let mediaState = this.getMediaState();
        let setPressedState = ( mediaState === 'playing' ) ? 'false' : 'true';

        console.log(`setPlayBackButton: ${setPressedState}`);

        this.playbackButton = this.querySelector('button');
        this.playbackButton.classList.add('set-button');

        this.playbackButton.setAttribute('aria-pressed', setPressedState);
        this.playbackButton.setAttribute('aria-controls', this.targetMedia.getAttribute('id'));
        this.playbackButton.setAttribute('aria-label', 'Pause');

        if ( this.playbackButton.innerHTML.trim() !== '' ) {
            this.playbackButton.innerHTML = '';
        }

    }

    createPlayBackButton () {
        this.playbackButton = document.createElement('button');

        this.playbackButton.setAttribute('aria-label', 'Pause');
        this.playbackButton.setAttribute('aria-pressed', ( this.getMediaState() === 'playing' ) ? 'false' : 'true' );
        this.playbackButton.setAttribute('aria-controls', this.targetMedia.getAttribute('id'));

        this.playbackButton.classList.add('created-button');
    }

    onPointerEvents () {
        this.playbackButton.addEventListener('click', (ev) => {
            ev.preventDefault();
            this.playPauseHandler();
        });
    }

    onMediaEnded () {
        this.targetMedia.addEventListener('ended', (ev) => {
            this.playPauseHandler();
            this.playbackButton.classList.add('replay');
        });
    }

    hasReducedMotion () {
        const hasReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches === true;

        if ( hasReducedMotion ) this.playPauseHandler();
    }

    playPauseHandler ( btn = this.playbackButton, media = this.targetMedia ) {
        btn.classList.remove('replay');

        // Play
        if ( btn.getAttribute('aria-pressed') == 'true' ) {
            btn.classList.remove('is-paused');
            btn.setAttribute('aria-pressed', 'false');
            media.play();
        }

        // Pause
        else {
            btn.classList.add('is-paused');
            btn.setAttribute('aria-pressed', 'true');
            media.pause();
        }
    }

} );