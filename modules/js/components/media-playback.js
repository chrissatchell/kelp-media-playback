import { debug } from "../utilities/debug.js";
import { emit } from "../utilities/emit.js";
import { ready } from "../utilities/ready.js";
import { reinit } from "../utilities/reinit.js";

customElements.define( "kelp-media-playback", class extends HTMLElement {

        /**
         * 0. Class Fields
         */

        /* targetAttr {String} The target attribute is a string used to select the target HTMLMediaElement by ID. */
        targetAttr = false;

        /* playbackButton {HTMLButtonElement} User provided or generated <button> element for the play/pause ("Playback") button. */
        playbackButton = false;

        /* targetMedia {HTMLMediaElement} The audio or video HTMLMediaElement that needs to be controlled.*/
        // NOTE: Update to an empty value instead of false?
        targetMedia = false;

        /* mediaStatus {Object} Object to track if media is ready and if it is currently playing. */
        mediaStatus = {
            isReady: false,
            isPlaying: false,
        };

        /* hasUserProvidedButton {Boolean}      Flag to track if a user provided button element was used. */
        #hasUserProvidedButton = false;

        /* loadingDelayDefaultTime {Number} The default time (in milliseconds) to delay the addition of the "media-is-ready" attribute. */
        #loadingDelayDefaultTime = 750;

        /* hasChildMedia {Boolean} Flag to track if a child media element was used. */
        #hasChildMedia = false;


        /**
         *  1. When connected to the DOM, run the init() method when ready.
         */

        connectedCallback() {
            if (typeof ready === "function") {
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

        async init() {
            // Don't run if already initialized
            if (this.hasAttribute("is-ready")) return;

            // Setup fields
            if (!this.setup()) {
                if (typeof debug === "function") {
                    debug(this, "Setup failed");
                }
                return;
            }

            /*
                NOTE:
                IF a button is created (bc user did not provide) then reveal()
                is called before the created button is attached to the DOM
            */
            //this.reveal();

            // Delays the addition of the "media-is-ready" attribute.
            // Moving this down the line will have no effect
            // bc mediaIsReady() has already been called.
            if ( this.querySelector( 'button' ) ) {
                await this.loadingDelay();
            } else {
                console.log("No loadingDelay applied because no button is present");
            }

            // Check if Media is ready to play...
            await this.mediaIsReady();

            // ...then if ready then update the mediaStatus.isReady flag and attr.
            this.mediaStatus.isReady = true;
            this.setAttribute("media-is-ready", "");

            // Media Playing State:
            try {
                // Check if Media is playing ...
                await this.mediaIsPlaying();

                // ... then if the Media is playing then update the mediaStatus.isPlaying flag
                this.mediaStatus.isPlaying = true;
            } catch (err) {
                // Media is not playing
                this.mediaStatus.isPlaying = false;
            }

            // Render
            if (!this.render()) {
                if (typeof debug === "function") {
                    debug(this, "Render failed");
                }
                return;
            }

            // Ready to go! emit a custom event: "media-playback:ready"
            if (typeof emit === "function") {
                emit(this, "media-playback", "ready");
            }

            // Set the "is-ready" attribute to indicate that the component is ready to use
            this.setAttribute("is-ready", "");
        }


        /**
         *  3. Setup the component's settings
         *      i. Check if the user provided a button element.
         *      ii. Check for the target attribute on <media-playback>, '<media-playback target="<selector>">'.
         *      iii. Check if the target attribute is a valid HTMLMediaElement.
         *      iv. Check if the media element has a "controls" attribute
         */

        setup() {
            /*
                i. BUTTON ELEMENT PROVIDED CHECK

                   Because this is a HTML Web Component the user is expected to provide a child <button> element
                   for the play/pause ("Playback") button. If no button element is provided, we will need to create one later.
            */
            if (this.querySelector("button") !== null) {
                this.#hasUserProvidedButton = true;

                // Use the provided button element; This will be used later by setPlayBackButton()
                this.playbackButton = this.querySelector("button");

                // If the reveal attribute is set, call reveal() to apply the CSS custom properties
                this.reveal();
            } else {
                // Will later use createPlayBackButton()
                this.playbackButton = false;
            }

            /*
                ii. Check for the target attribute on <media-playback>, '<media-playback target="<selector>">'.
            */
            this.targetAttr = this.getAttribute("target") ?? false;

            // let selectorType = ( this.targetAttr && this.targetAttr.startsWith('#') ) ? 'id' : 'other';
            // let mediaSelector = ( selectorType === 'id' ) ? this.targetAttr : `#${this.targetAttr}`;

            /*
            ii. Check the target attribute exists and it can be used to select a HTMLMediaElement.
        */

            // Media is supplied as a child of the component, so we do not need the target attr
            // to get the targeted media
            if (this.querySelector("video, audio")) {
                this.targetMedia = this.querySelector("video, audio");

                this.#hasChildMedia = this.targetMedia !== null ? true : false;

                if (
                    this.targetMedia !== null &&
                    !this.targetMedia.id
                ) {
                    let id = Math.floor(Math.random() * 100000);

                    // Make sure it's not already in use
                    let suffix = 0;
                    let existing = document.querySelector(`#kelp_${id}`);
                    while (existing) {
                        suffix++;
                        existing = document.querySelector(
                            `#kelp_${id}_${suffix}`,
                        );
                    }

                    // Set the ID on the element
                    this.targetMedia.setAttribute(
                        "id",
                        `kelp_${id}${suffix ? `_${suffix}` : ""}`,
                    );
                }
            }

            // Use the target attr to get the targeted media element
            else if (
                this.targetAttr !== false &&
                document.getElementById(this.targetAttr) !== null &&
                document.getElementById(this.targetAttr) instanceof
                    HTMLMediaElement
            ) {
                this.targetMedia = document.getElementById(this.targetAttr);
            } else {
                console.warn(
                    this,
                    "No target media found. Add a 'target' attribute with a string value to the kelp-media-playback element; Use the same value from the target attribute as the value of the id attribute for the video or audio element.",
                );

                if (typeof debug === "function") {
                    debug(
                        this,
                        `
                    Target attribute is not a valid HTMLMediaElement.
                    Check the target attribute is set and ensure it can be used to target a HTMLMediaElement using its ID or a selector.
                    Alternatively, add the media element - video or audio - as a child of the web componet.
                `,
                    );
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

            if (this.targetMedia.hasAttribute("controls")) {
                this.setAttribute("media-has-controls", "");

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

        render() {
            /*
                ii. Use the provided child button element
            */
            if (this.#hasUserProvidedButton) {
                // playbackButton exits so add the reveal styles if needed
                // this.reveal();

                this.setPlayBackButton();
            } else {
                /*
            iii. OR Create the button element if no child button element is provided
        */
                this.createPlayBackButton();

                this.appendChild(this.playbackButton);

                // wait until the button is in the DOM then apply reveal styles if needed
                this.reveal();
            }

            /*
            iv. Double check we have what we need,
                then add listeners and media queries.
        */
            if (this.playbackButton !== false && this.targetMedia !== false) {
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

        mediaIsReady(media = this.targetMedia) {
            if (media) {
                return new Promise((resolve) => {
                    if (media.readyState > 2) {
                        resolve(media);
                    } else {
                        media.addEventListener(
                            "canplay",
                            (ev) => {
                                resolve(media);
                            },
                            { once: true },
                        );
                    }
                });
            }
        }

        mediaIsPlaying(media = this.targetMedia, countdown = 50) {
            return new Promise((resolve, reject) => {
                /*
                    If media is playing then resolve and exit.
                */

                if (!media.paused && !media.ended && media.readyState > 2) {
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

                function onPlaying() {
                    cleanup();
                    resolve(media);
                }

                function onError() {
                    cleanup();
                    reject(media.error || new Error("Playback error"));
                }

                function onAbort() {
                    cleanup();
                    reject(new Error("Playback aborted"));
                }

                function cleanup() {
                    clearTimeout(timer);
                    media.removeEventListener("playing", onPlaying);
                    media.removeEventListener("error", onError);
                    media.removeEventListener("abort", onAbort);
                }

                // Timeout - do not wait forever if playback never starts.
                const timer = setTimeout(() => {
                    cleanup();
                    reject(
                        new Error(
                            `Playback did not start within ${countdown}ms`,
                        ),
                    );
                }, countdown);
            });
        }

        setPlayBackButton() {
            // console.log(`set button, this.mediaStatus.isPlaying ${this.mediaStatus.isPlaying}`);

            if (this.playbackButton.innerHTML.trim() !== "") {
                //this.playbackButton.innerHTML = '';
            }

            let setPressedState = this.mediaStatus.isPlaying ? "false" : "true";

            this.playbackButton = this.querySelector("button");

            this.playbackButton.setAttribute("aria-label", "Pause");
            this.playbackButton.setAttribute("aria-pressed", setPressedState);
            this.playbackButton.setAttribute(
                "aria-controls",
                this.targetMedia.getAttribute("id"),
            );

            this.playbackButton.classList.add("is-set");
        }

        createPlayBackButton() {
            let setPressedState = this.mediaStatus.isPlaying ? "false" : "true";

            this.playbackButton = document.createElement("button");

            this.playbackButton.setAttribute("aria-label", "Pause");
            this.playbackButton.setAttribute("aria-pressed", setPressedState);
            this.playbackButton.setAttribute(
                "aria-controls",
                this.targetMedia.getAttribute("id"),
            );

            this.playbackButton.classList.add("was-created");
        }

        onPointerEvents() {
            this.playbackButton.addEventListener("click", (ev) => {
                ev.preventDefault();

                if (!this.targetMedia.paused) {
                    this.targetMedia.pause();
                } else if (this.targetMedia.paused) {
                    this.targetMedia.play();
                }

                // NOTE: This is now handled by the play and pause event listeners.
                //this.pressedStateHandler();
            });
        }

        onMediaEvents() {
            // Keep button state in sync with video events
            this.targetMedia.addEventListener("play", (ev) => {
                this.replayMediaHandler();
                this.pressedStateHandler();
            });

            this.targetMedia.addEventListener("pause", (ev) => {
                this.pressedStateHandler();
            });

            this.targetMedia.addEventListener("ended", (ev) => {
                // NOTE: now this is handled by the "pause" event listener
                // this.pressedStateHandler();

                this.playbackButton.classList.add("replay");

                console.log("ended");
            });

            this.targetMedia.addEventListener("seeking", () => {
                if (
                    this.playbackButton.classList.contains("replay") &&
                    this.targetMedia.currentTime < this.targetMedia.duration
                ) {
                    this.playbackButton.classList.remove("replay");
                    console.log("Seeked to:", this.targetMedia.currentTime);
                }
            });

            this.targetMedia.addEventListener("seeked", () => {
                const duration = this.targetMedia.duration;
                const current = this.targetMedia.currentTime;

                // Instead of Math.abs(), just check >=
                if (duration && current >= duration) {
                    console.log("Seeked to end!");
                    this.playbackButton.classList.add("replay");
                    // this.targetMedia.currentTime = this.targetMedia.duration;
                    // this.targetMedia.pause();
                }
            });
        }

        pressedStateHandler(
            btn = this.playbackButton,
            media = this.targetMedia,
        ) {
            // btn.classList.remove('replay');

            /*
            NOTE: The playing and pausing of media is now controlled by onPointerEvents.
                  This was needed to solve a bug where the click, play, pause events were
                  creating an infinite loop by triggering pressedStateHandler.
                  For example, if the playback button was clicked then the pressedStateHandler
                  would be triggered by the click event, then the play event ...
        */

            // Play
            if (btn.getAttribute("aria-pressed") == "true") {
                btn.classList.remove("is-paused");
                btn.setAttribute("aria-pressed", "false");
                //media.play();
            }

            // Pause
            else {
                btn.classList.add("is-paused");
                btn.setAttribute("aria-pressed", "true");
                //media.pause();
            }
        }

        replayMediaHandler(
            btn = this.playbackButton,
            media = this.targetMedia,
        ) {
            if (btn.classList.contains("replay")) {
                this.targetMedia.currentTime = 0;
                btn.classList.remove("replay");
            }
        }

        hasReducedMotion() {
            const hasReducedMotion =
                window.matchMedia("(prefers-reduced-motion: reduce)")
                    .matches === true;
            if (hasReducedMotion) {
                this.targetMedia?.pause();
                this.pressedStateHandler();
            }
        }

        /*
            Attribute loading-delay
            NOTE: delays mediaIsReady() which is needed for the revealAttr to display the playback button

            TODO: Pause media playback during loading delay?
        */
        loadingDelay(defaultTime = this.#loadingDelayDefaultTime) {
            let loadingDelayAttr = "";

            let getTimeUnit = (str) => {
                if (/ms$/.test(str)) return "ms"; // ends with "ms"
                if (/s$/.test(str)) return "s"; // ends with "s" (but not "ms")
                return null; // no valid unit
            };

            if (this.hasAttribute("loading-delay")) {
                loadingDelayAttr = this.getAttribute("loading-delay");

                if (loadingDelayAttr) {

                    // Determine the time unit of the loading delay attr
                    const unit = getTimeUnit(loadingDelayAttr);

                    // Convert to unitless value in milliseconds
                    if (unit === "ms") {
                        loadingDelayAttr = loadingDelayAttr.replace(unit, "");
                    }

                    // Convert seconds to milliseconds
                    else if (unit === "s") {
                        loadingDelayAttr =
                            parseFloat(loadingDelayAttr.replace(unit, "")) *
                            1000;
                    }
                }

                // Define delay time
                let loadingDelayTime = loadingDelayAttr !== ""
                                       ? loadingDelayAttr
                                       : defaultTime;

                // Resolve the promise after the delay time controlling the timeout
                return new Promise( resolve =>
                    setTimeout( resolve, loadingDelayTime )
                );
            }

            // TODO: Return an error or warning if loading-delay attribute is not valid?
            return Promise.resolve();
        }

        /*
            Attribute reveal
        */
        reveal() {
            let hasTimeUnit = (str) => /(ms|s)$/.test(str);

            if (this.hasAttribute("reveal")) {
                if (!this.getAttribute("reveal")) return;

                let revealTimes = this.getAttribute("reveal");

                let [displayTiming, displayDelay] = revealTimes
                    ? revealTimes.split(" ")
                    : false;

                if (displayTiming)
                    this.playbackButton?.style?.setProperty(
                        "--js-button-display-timing",
                        `${hasTimeUnit(displayTiming) ? displayTiming : `${displayTiming}ms`}`,
                    );

                if (displayDelay)
                    this.playbackButton?.style?.setProperty(
                        "--js-button-display-delay",
                        `${hasTimeUnit(displayDelay) ? displayDelay : `${displayDelay}ms`}`,
                    );
            }
        }
    },
);
