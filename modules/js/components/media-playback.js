import { debug } from '../utilities/debug.js';
import { emit } from '../utilities/emit.js';
import { ready } from '../utilities/ready.js';
import { reinit } from '../utilities/reinit.js';

customElements.define( 'kelp-media-playback', class extends HTMLElement {

    /**
     * Class Fields
     *
     * @type { string | boolean | null }             targetAttr      The target attribute value or false if not set.
     * @type { HTMLButtonElement | boolean | null }  playbackButton  The play/pause button element or false if not set.
     * @type { HTMLMediaElement | boolean | null }   targetMedia     The targeted HTMLMediaElement or false if not found.
     */

    // The target attribute is a string used to select the target HTMLMediaElement by ID.
    targetAttr = false;

    // User provided or generated <button> element for the play/pause ("Playback") button.
    playbackButton = false;

    // The audio or video HTMLMediaElement that needs to be controlled.
    targetMedia = false;

    // Media status object to track if media is ready and if it is currently playing.
    mediaStatus = {
        isReady: false,
        isPlaying: false,
    };


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
     *  3. Calls render()
     *  4. On "Ready" updates
     */

    init () {

        /*
            Don't run if already initialized
        */

        if ( this.hasAttribute( 'is-ready' ) ) return;

        // Setup fields
        this.setup();

        /*
            Wait for the target media to be ready before continuing
            This is important because we need to know the media state (playing, paused, ended)
            before we can set up the play/pause button correctly.
            We use the waitForMediaReady() method which returns a promise that resolves when the media is ready.
        */

        this.waitForMediaReady().then( mediaStatus => {

            // Reader or fail
            if ( ! this.render() ) {
                if (typeof debug === "function") {
                    debug(this, 'Render failed: target media did not initialize properly.');
                }
                return;
            }

            // Ready to go!
            if ( typeof emit === "function" ) {
                emit( this, 'media-playback', 'ready' );
            }
            this.setAttribute('is-ready', '');

        } );

    }


    setup () {

        // Check for the target attribute on <media-playback>, '<media-playback target="<selector>">'.
        this.targetAttr = this.getAttribute( 'target' ) ?? false;

        let _selectorType = ( this.targetAttr && this.targetAttr.startsWith('#') ) ? 'id' : 'other';
        let _mediaSelector = ( _selectorType === 'id' ) ? this.targetAttr : `#${this.targetAttr}`;

        // Because this is a HTML Web Component the user is expected to provide a child <button> element
        // for the play/pause ("Playback") button. If no button is provided, we will create one later.
        this.playbackButton = this.querySelector('button') instanceof HTMLButtonElement ? this.querySelector('button') : false;

        // 3b. Check the target attribute exists and it can be used to select a HTMLMediaElement.
        this.targetMedia = ( this.targetAttr !== false && document.querySelector( _mediaSelector ) instanceof HTMLMediaElement) ? document.querySelector( _mediaSelector ) : false;
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



    setPlayBackButton () {

        let setPressedState = this.mediaStatus.isPlaying ? 'false' : 'true';

        console.log(`setPlayBackButton: ${setPressedState}`);

        this.playbackButton = this.querySelector('button');

        this.playbackButton.setAttribute('aria-label', 'Pause');
        this.playbackButton.setAttribute('aria-pressed', setPressedState);
        this.playbackButton.setAttribute('aria-controls', this.targetMedia.getAttribute('id'));

        this.playbackButton.classList.add('set-button');

        if ( this.playbackButton.innerHTML.trim() !== '' ) {
            this.playbackButton.innerHTML = '';
        }

    }

    createPlayBackButton () {
        let setPressedState = this.mediaStatus.isPlaying ? 'false' : 'true';

        console.log(this.mediaStatus.isPlaying);

        this.playbackButton = document.createElement('button');
        this.playbackButton.setAttribute('aria-label', 'Pause');
        this.playbackButton.setAttribute('aria-pressed', setPressedState );
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

     waitForMediaReady() {

        return new Promise( ( resolve ) => {

            const checkStatus = () => {

                console.log('paused', this.targetMedia.paused);
                console.log('ended', this.targetMedia.ended);
                console.log('currentTime', this.targetMedia.currentTime);

                let isPlaying = true; // this.targetMedia.currentTime > 0

                if (this.targetMedia.paused || this.targetMedia.ended) {
                    isPlaying = false;
                }

                this.mediaStatus.isReady = this.targetMedia.readyState >= 4 ? true : false;
                this.mediaStatus.isPlaying = isPlaying;

                console.log('readystate',this.targetMedia.readyState);

                resolve(this.mediaStatus);
            };

            if ( this.targetMedia.readyState >= 4 ) {

                console.log('mediaready');

                // HAVE_ENOUGH_DATA
                checkStatus();

            } else {

                const onCanPlayThrough = () => {
                    this.targetMedia.removeEventListener( "canplaythrough", onCanPlayThrough );
                    console.log('mediaplaythrough');
                    checkStatus();
                };

                this.targetMedia.addEventListener( "canplaythrough", onCanPlayThrough );

            }
        });
    }

} );