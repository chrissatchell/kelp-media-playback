import { debug } from '../utilities/debug.js';
import { emit } from '../utilities/emit.js';
import { ready } from '../utilities/ready.js';
import { reinit } from '../utilities/reinit.js';

customElements.define( 'kelp-media-playback', class extends HTMLElement {

    /**
     * Class Fields
     *
     * targetAttr      The target attribute value or false if not set.
     * playbackButton  The play/pause button element or false if not set.
     * targetMedia     The targeted HTMLMediaElement or false if not found.
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

    #hasUserProvidedButton = false;


    /**
     *  When connected to the DOM, run the init() method when ready.
     */

    connectedCallback () {
        if ( typeof ready === 'function' ) {
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

        // Check if Media is ready to play
        await this.mediaIsReady();

        // Media is ready to play
        this.mediaStatus.isReady = true;

        // Media state
        try {

            // Check if Media is playing
            await this.mediaIsPlaying();

            // Media is playing
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

        // Ready to go!
        if ( typeof emit === 'function' ) {
            emit( this, 'media-playback', 'ready' );
        }

        this.setAttribute('is-ready', '');

    }


    setup () {

        // @ts-ignore
        // Check for the target attribute on <media-playback>, '<media-playback target="<selector>">'.
        this.targetAttr = this.getAttribute( 'target' ) ?? false;

        let _selectorType = ( this.targetAttr && this.targetAttr.startsWith('#') ) ? 'id' : 'other';
        let _mediaSelector = ( _selectorType === 'id' ) ? this.targetAttr : `#${this.targetAttr}`;

        // @ts-ignore
        // Because this is a HTML Web Component the user is expected to provide a child <button> element
        // for the play/pause ("Playback") button. If no button is provided, we will create one later.
        this.playbackButton = this.querySelector('button') instanceof HTMLButtonElement ? this.querySelector('button') : false;

        // 3b. Check the target attribute exists and it can be used to select a HTMLMediaElement.
        if (
            this.targetAttr !== false
            && document.getElementById( this.targetAttr ) !== null
            && document.getElementById( this.targetAttr ) instanceof HTMLMediaElement
        ) {

            this.targetMedia = document.getElementById( this.targetAttr );

        } else if ( this.querySelector('video, audio')) {

            this.targetMedia = this.querySelector('video, audio');

        }

        console.log('controls: ', this.targetMedia.hasAttribute('controls'));

        if ( this.targetMedia.hasAttribute('controls') ) {
            this.setAttribute('media-has-controls','');
            console.error(`Please remove the 'controls' attribute from your media element id="${this.targetMedia.id}"`);
            //return false;
        }

        return true;
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

            let _targetMediaID = `media-${Math.floor(Math.random() * 1000)}`;

            this.targetMedia = this.querySelector('video, audio');

            // Ensure the video has an ID for aria-controls
            this.targetMedia.setAttribute('id', _targetMediaID);
        }

        /*
            2. Use the button element if a child button element is present
        */
        if ( this.targetMedia !== false && this.querySelector('button') ) {

            // console.log('Use the button element if a child button element is present');

            this.setPlayBackButton();

            this.#hasUserProvidedButton = true;

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
        if (
            this.targetMedia !== false
            && this.targetMedia instanceof HTMLMediaElement
        ) {

            if ( this.#hasUserProvidedButton === false ) {
                this.appendChild(this.playbackButton);
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
                if ( media.readyState > 2 ) resolve( media );
                else media.addEventListener("canplay", () => resolve(media), { once: true });
            } );
        }
    }

    mediaIsPlaying ( media = this.targetMedia, countdown = 50 ) {

        return new Promise( ( resolve, reject ) => {
            /*
            console.log(media);
            console.log(`media.paused: ${media.paused}`);
            console.log(`media.ended: ${media.ended}`);
            console.log(`media.readyState: ${media.readyState}`);
            */


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

            // Kick off play attempt (for autoplay cases)
            // media.play().catch(err => {
            //     cleanup();
            //     reject(err);
            // });
      });
    }

    setPlayBackButton () {

        console.log(`set button, this.mediaStatus.isPlaying ${this.mediaStatus.isPlaying}`);

        let setPressedState = this.mediaStatus.isPlaying ? 'false' : 'true';

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
        if ( hasReducedMotion ) this.playPauseHandler();
    }

} );