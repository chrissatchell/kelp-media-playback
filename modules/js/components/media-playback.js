import { debug } from '../utilities/debug.js';
import { emit } from '../utilities/emit.js';
import { ready } from '../utilities/ready.js';
import { reinit } from '../utilities/reinit.js';

customElements.define( 'kelp-media-playback', class extends HTMLElement {

    /**
     * Class Fields
     *
     * targetAttr      {String}             The target attribute is a string used to select the target HTMLMediaElement by ID.
     * playbackButton  {HTMLButtonElement}  User provided or generated <button> element for the play/pause ("Playback") button.
     * targetMedia     {HTMLMediaElement}   The audio or video HTMLMediaElement that needs to be controlled.
     * mediaStatus     {Object}             Object to track if media is ready and if it is currently playing.
     * hasUserProvidedButton {Boolean}      Flag to track if a user provided button element was used.
     */

    targetAttr = false;

    playbackButton = false;

    targetMedia = false;

    mediaStatus = {
        isReady: false,
        isPlaying: false,
    };

    #hasUserProvidedButton = false;


    /**
     *  1. When connected to the DOM, run the init() method when ready.
     */

    connectedCallback () {
        if ( typeof ready === 'function' ) {
            ready(this);
        } else {
            this.init();
        }
    }


    /**
     *  2. When initialized, do a great many things.
     *      i. Don't run if already initialized
     *      ii. Get settings
     *      iii. Calls render()
     *      iv. On "Ready" updates
     */

    async init () {

        // Don't run if already initialized
        if ( this.hasAttribute( 'is-ready' ) ) return;

        // Setup fields
        if ( ! this.setup() ) {
            if ( typeof debug === 'function' ) {
                debug( this, 'Setup failed' );
            }
            return;
        }

        /* TODO: Loading state:
            - no play or pause icon, instead a loading icon
        */
        // this.whileLoading()

        // Media Ready State: Check if Media is ready to play...
        await this.mediaIsReady();

        // ... then if the Media is ready then update the mediaStatus.isReady flag.
        this.mediaStatus.isReady = true;

        // Media Playing State:
        try {

            // Check if Media is playing ...
            await this.mediaIsPlaying();

            // ... then if the Media is playing then update the mediaStatus.isPlaying flag
            this.mediaStatus.isPlaying = true;

        } catch ( err ) {

            // Media is not playing
            this.mediaStatus.isPlaying = false;

        }

        // Render
        if ( ! this.render() ) {
            if ( typeof debug === 'function' ) {
                debug( this, 'Render failed' );
            }
            return;
        }

        // Ready to go! emit a custom event: "media-playback:ready"
        if ( typeof emit === 'function' ) {
            emit( this, 'media-playback', 'ready' );
        }

        // Set the "is-ready" attribute to indicate that the component is ready to use
        this.setAttribute('is-ready', '');

    }


    /**
     *  3. Setup the component's settings
     *      i. Check for the target attribute on <media-playback>, '<media-playback target="<selector>">'.
     *      ii. Check if the target attribute is a valid HTMLMediaElement.
     *      iii. Check if the user provided a button element.
     *      iv. Check if the media element has a "controls" attribute
     */

    setup () {

        /*
            i. Check for the target attribute on <media-playback>, '<media-playback target="<selector>">'.
        */
        this.targetAttr = this.getAttribute( 'target' ) ?? false;

        let selectorType = ( this.targetAttr && this.targetAttr.startsWith('#') ) ? 'id' : 'other';
        let mediaSelector = ( selectorType === 'id' ) ? this.targetAttr : `#${this.targetAttr}`;


        /*
            ii. Because this is a HTML Web Component the user is expected to provide a child <button> element
                for the play/pause ("Playback") button. If no button element is provided, we will need to create one later.
        */
        this.playbackButton = this.querySelector('button') instanceof HTMLButtonElement ? this.querySelector('button') : false;


        /*
            iii. Check the target attribute exists and it can be used to select a HTMLMediaElement.
        */

        if (
            this.targetAttr !== false
            && document.getElementById( this.targetAttr ) !== null
            && document.getElementById( this.targetAttr ) instanceof HTMLMediaElement
        ) {

            this.targetMedia = document.getElementById( this.targetAttr );

        } else if ( this.querySelector('video, audio')) {

            this.targetMedia = this.querySelector('video, audio');

        } else {

            if ( typeof debug === 'function' ) {
                debug( this, `
                    Target attribute is not a valid HTMLMediaElement.
                    Check the target attribute is set and ensure it can be used to target a HTMLMediaElement using its ID or a selector.
                `);
            }

            // Return false to indicate that the setup failed.
            // This method is called by the init() method and if the conditional
            // where setup() is called returns false:
            //   1. debug("Setup failed") is called
            //   2. init() returns false and finishes early
            return false;
        }


        /*
            iv. Check if the media element has a "controls" attribute
        */

        // NOTE: Is this an edge case? Will users need or want to show the native media controls
        //       along with the custom button media playback button?

        if ( this.targetMedia.hasAttribute('controls') ) {
            this.setAttribute('media-has-controls','');

            // TODO: Enforce the "controls" attribute to be removed from the media element, if needed.

            // console.error(`Please remove the 'controls' attribute from your media element id="${this.targetMedia.id}"`);
            //return false;
        }

        return true;
    }


    /**
     *  4. Render the component's HTML structure.
     *      i. Check for a nested video or audio element and set an ID attribute.
     *      ii. Use the button element if a child button element is present.
     *      iii. OR Create the button element if no child button element is present.
     *      iv. If we have a valid targetMedia, append the button and add event listeners.
     */

    render () {


        /*
            i. Check for a nested media element and set its ID.
        */
        if ( this.querySelector('video, audio') instanceof HTMLMediaElement) {

            this.targetMedia = this.querySelector('video, audio');

            let id = `${Math.floor(Math.random() * 1000)}`;

            // Borrow logic from setTextAsID.js
            let suffix = 0;
            let existing = document.querySelector(`#kelp_${id}`);
            while (existing) {
                suffix++;
                existing = document.querySelector(`#kelp_${id}_${suffix}`);
            }

            // Set the ID on the element
            // Ensure the video has an ID for aria-controls
            // When the playback buttom is set or created, the id of the media
            // element is used
            this.targetMedia.id = `kelp_${id}${suffix ? `_${suffix}` : ''}`;
        }

        /*
            ii. Use the provided child button element
        */
        if ( this.targetMedia !== false && this.querySelector('button') ) {

            this.setPlayBackButton();

            this.#hasUserProvidedButton = true;

        }

        /*
            iii. OR Create the button element if no child button element is provided
        */
        else if ( this.targetMedia !== false && ! this.querySelector('button') ) {

            this.createPlayBackButton();

        }

        /*
            iv. If we have a valid targetMedia, append the button and add event listeners
        */
        if (
            this.targetMedia !== false
            && this.targetMedia instanceof HTMLMediaElement
        ) {

            if ( this.#hasUserProvidedButton === false ) {

                this.appendChild( this.playbackButton );

            }

            this.hasReducedMotion();

            this.onPointerEvents();

            this.onMediaEvents();

        } else {
            return false;
        }

        return true;

    }


    /**
     * Helper and Event Methods.
     */

    mediaIsReady ( media = this.targetMedia ) {
        if ( media ) {
            return new Promise( resolve => {
                if ( media.readyState > 2 ) {
                    this.setAttribute('media-is-ready', '');
                    resolve(media);
                }

                else {
                    media.addEventListener('canplay', ev => {
                        this.setAttribute('media-is-ready', '');
                        resolve(media);
                    }, { once: true });
                }
            } );
        }
    }

    mediaIsPlaying ( media = this.targetMedia, countdown = 50 ) {

        return new Promise( ( resolve, reject ) => {

            /*
                If media is playing then resolve and exit.
            */

            if (
                ! media.paused
                && ! media.ended
                && media.readyState > 2
            ) {
                resolve(media);
                return;
            }


            /*
                If media is not already playing then setup listeners.
            */

            // Resolve
            media.addEventListener("playing", onPlaying, { once: true });

            // Reject
            media.addEventListener("error", onError, { once: true });

            // Reject
            media.addEventListener("abort", onAbort, { once: true });


            /*
                Handlers
            */

            function onPlaying () {
                cleanup();
                resolve(media);
            };

            function onError () {
                cleanup();
                reject(media.error || new Error("Playback error"));
            };

            function onAbort () {
                cleanup();
                reject(new Error("Playback aborted"));
            };

            function cleanup () {
                clearTimeout(timer);
                media.removeEventListener("playing", onPlaying);
                media.removeEventListener("error", onError);
                media.removeEventListener("abort", onAbort);
            };


            // Timeout - do not wait forever if playback never starts.
            const timer = setTimeout( () => {
                cleanup();
                reject( new Error(`Playback did not start within ${countdown}ms`) );
            }, countdown );

      });
    }

    setPlayBackButton () {

        // console.log(`set button, this.mediaStatus.isPlaying ${this.mediaStatus.isPlaying}`);

        if ( this.playbackButton.innerHTML.trim() !== '' ) {
            this.playbackButton.innerHTML = '';
        }

        let setPressedState = this.mediaStatus.isPlaying ? 'false' : 'true';

        this.playbackButton = this.querySelector('button');

        this.playbackButton.setAttribute('aria-label', 'Pause');
        this.playbackButton.setAttribute('aria-pressed', setPressedState);
        this.playbackButton.setAttribute('aria-controls', this.targetMedia.getAttribute('id'));

        this.playbackButton.classList.add('set-button');

    }

    createPlayBackButton () {

        console.log(`create button, this.mediaStatus.isPlaying ${this.mediaStatus.isPlaying}`);

        let setPressedState = this.mediaStatus.isPlaying ? 'false' : 'true';

        this.playbackButton = document.createElement('button');

        this.playbackButton.setAttribute('aria-label', 'Pause');
        this.playbackButton.setAttribute('aria-pressed', setPressedState );
        this.playbackButton.setAttribute('aria-controls', this.targetMedia.getAttribute('id'));

        this.playbackButton.classList.add('created-button');
    }

    onPointerEvents () {

        this.playbackButton.addEventListener('click', (ev) => {
            ev.preventDefault();

            if ( !this.targetMedia.paused ) {

                this.targetMedia.pause();

            } else if ( this.targetMedia.paused ) {

                this.targetMedia.play();

            }

            // NOTE: This is now handled by the play and pause event listeners.
            //this.playPauseHandler();
        });
    }

    onMediaEvents () {

        // Keep button state in sync with video events
        this.targetMedia.addEventListener("play", (ev) => {
            this.playPauseHandler();
        });

        this.targetMedia.addEventListener("pause", (ev) => {
            this.playPauseHandler();
        });

        this.targetMedia.addEventListener('ended', (ev) => {

            // NOTE: now this is handled by the "pause" event listener
            // this.playPauseHandler();

            this.playbackButton.classList.add('replay');

            console.log('ended');
        });

        this.targetMedia.addEventListener("seeking", () => {
            if (
                this.playbackButton.classList.contains('replay')
                && this.targetMedia.currentTime < this.targetMedia.duration
            ) {
                this.playbackButton.classList.remove('replay');
                console.log("Seeked to:", this.targetMedia.currentTime);
            }
        });

        this.targetMedia.addEventListener("seeked", () => {
            const duration = this.targetMedia.duration;
            const current = this.targetMedia.currentTime;

            console.log(duration, current);

            // Instead of Math.abs(), just check >=
            if (duration && current >= duration) {
                console.log("Seeked to end!");
                this.playbackButton.classList.add('replay');
                // this.targetMedia.currentTime = this.targetMedia.duration;
                // this.targetMedia.pause();
            }
        });
    }

    playPauseHandler ( btn = this.playbackButton, media = this.targetMedia ) {
        btn.classList.remove('replay');

        /*
            NOTE: The playing and pausing of media is now controlled by onPointerEvents.
                  This was needed to solve a bug where the click, play, pause events were
                  creating an infinite loop by triggering playPauseHandler.
                  For example, if the playback button was clicked then the playPauseHandler
                  would be triggered by the click event, then the play event ...
        */

        // Play
        if ( btn.getAttribute('aria-pressed') == 'true' ) {
            btn.classList.remove('is-paused');
            btn.setAttribute('aria-pressed', 'false');
            //media.play();
        }

        // Pause
        else {
            btn.classList.add('is-paused');
            btn.setAttribute('aria-pressed', 'true');
            //media.pause();
        }
    }

    hasReducedMotion () {
        const hasReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches === true;
        if ( hasReducedMotion ) {
            this.targetMedia?.pause();
            this.playPauseHandler();
        }
    }

} );