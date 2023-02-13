// ==UserScript==
// @name         Wack helper script v1.4
// @namespace    GeoGuessr scripts
// @version      1.4
// @description  Only travel one route.
// @match        https://www.geoguessr.com/*
// @author       echandler
// @downloadURL  https://github.com/echandler/wack-script/raw/main/wackHelperScript.user.js
// @run-at       document-start
// @license      MIT
// @grant        GM_addStyle
// ==/UserScript==

GM_addStyle(`
    .d::-webkit-scrollbar {
        width: 18px;
        height: 12px;
        -webkit-appearance: none;
    }

    .btn {
        background: #6cb928;
        color: white;
        border-radius: 100px;
        padding: 20px;
        outline: rbga(200,200,200,0.5);
        font-size: --button-font-size: var(--font-size-12);
        cursor: pointer;
     }

    .btn:hover {
        opacity: 0.7;
    }

    .btn:active {
        opacity: 1.0;
    }

    .btn:disabled {
        background: #4a9706;
    }
`);

const callback = function (mutationsList, observer) {
    for (let mutation of mutationsList) {
        if (mutation.type === "childList") {
            let el = mutation.addedNodes[0];
            if (el && el.tagName === "SCRIPT" && /googleapis/.test(el.src)) {
                observer.disconnect();

                el.addEventListener("load", function () {
                    unsafeWindow.modifyStreeVeiwPanoramaObj();
                    unsafeWindow.modifyGoogleMapsObject();
                    navigation.makeButtons();
                    showHelper();
                });
            }
        }
    }
};

const targetNode = document.head;
const config = { childList: true, subtree: true };
const observer = new MutationObserver(callback);
observer.observe(targetNode, config);

let correctMapName = localStorage["oneRouteHelperMapName"] || "";
let points = [];
let curRoundObj = sessionStorage["curRoute"] ? JSON.parse(sessionStorage["curRoute"]) : {};
let el = null;
let startPos = null;
let badResponseTries = 0;
let curPos = null;
let setPosErrorTimer = null;

unsafeWindow.modifyStreeVeiwPanoramaObj = function () {
    google.maps.StreetViewPanorama = class extends google.maps.StreetViewPanorama {
        constructor(...args) {
            super(...args);

            setTimeout(() => {
                if (!isCorrectMap()) return;

                el = args[0];

                this.clickToGo = false;
                this.linksControl = false;
            }, 1);

            unsafeWindow.__sv = this;

            this.setPosition = _setPos;
        }
    };

    async function _setPos(...args) {
        if (args[1] === true && curRoundObj) {
            // Weird fix for geoguessr passing latlng for latest coverage instead of
            // specified coverage.
            return;
        }

        if (!curRoundObj) {
            // Weird fix for geoguessr passing latlng for latest coverage instead of
            // specified coverage.
            setPosErrorTimer = setTimeout(() => this.setPosition(args[0], true), 2000);
            return;
        }

        this.__proto__.setPosition.apply(this, args);

        if (!isCorrectMap()) return;

        let pos = args[0];

        if (typeof args[0].lat === "function") {
            pos = args[0].toJSON();
        }

        // if (!curRoute) return;

        let _post = { lat: curRoundObj.customCoordinates[0].lat, lng: curRoundObj.customCoordinates[0].lng };

        if (_post && !(_post.lat === pos.lat && _post.lng === pos.lng)) return;

        //
        // The player is at the start position.
        //

        n = 0;

        let key = `lat:${pos.lat.toFixed(11)},lng:${pos.lng.toFixed(11)}`.replace(/\./g, ",");

        // curRoundObj = curRoute;//lc.get(key);

        // curRoundObj = curRoundObj?.customCoordinates? curRoundObj: await testIfRoutExists(pos.lat, pos.lng);

        if (!curRoundObj) {
            //     if (badResponseTries++ < 5){
            //         console.error('Trying again => ', pos);
            //         setPosErrorTimer = setTimeout(() => this.setPosition(pos), 2000);
            //         return;
            //     }

            //    clearTimeout(setPosErrorTimer);

            alert("There was an error, not sure what it was.");

            alert = function () {
                /*Alert gets called a bunch of time before page reloads.*/
            };

            //  location.reload();

            return;
        }

        //
        // Route does exist in database.
        //

        clearTimeout(setPosErrorTimer);

        badResponseTries = 0;

        startPos = { ...pos };

        setTimeout(navigation.showButtons.bind(navigation), 1000);

        if (el) {
            el.style.visibility = "hidden";
        }

        if (!curRoundObj.customCoordinates || curRoundObj.customCoordinates === true) {
            //    curRoundObj = await getRoute(startPos.lat, startPos.lng);
        }

        points = curRoundObj.customCoordinates;

        //lc.set(key, curRoundObj);

        if (points[0].panoId) {
            setTimeout(() => {
                this.setPano(points[0].panoId);
                this.setPov({ heading: points[0].heading, pitch: points[0].pitch });
                el.style.visibility = "visible";
                navigation.checkBtnState(points[0]);
            }, 500);
        } else {
            setTimeout(() => {
                this.setPosition(points[0]);
                this.setPov({ heading: points[0].heading, pitch: points[0].pitch });
                el.style.visibility = "visible";
                navigation.checkBtnState(points[0]);
            }, 500);
        }

        if (points[0]?.extra?.tags?.length > 0) {
            appendMsgBox(points[0].extra.tags[0]);
        } else {
            appendMsgBox(null);
        }

        return;
    }
};

unsafeWindow.modifyGoogleMapsObject = function () {
    google.maps.Map = class extends google.maps.Map {
        constructor(...args) {
            super(...args);
            window.__map = this;
        }
    };
};

let n = 0;

unsafeWindow._next = function () {
    if (points[n].preventForward) return;

    let sv = unsafeWindow.__sv;
    n++;

    if (n >= points.length) n = 0;

    if (points[n].panoId) {
        sv.setPov({ heading: points[n].heading, pitch: points[n].pitch });
        sv.setPano(points[n].panoId);
    } else {
        sv.setPov({ heading: points[n].heading, pitch: points[n].pitch });
        sv.setPosition(points[n]);
    }

    if (points[n]?.extra?.tags?.length > 0) {
        appendMsgBox(points[n].extra.tags[0]);
        //     alert(points[n].extra.tags[0]);
    } else {
        appendMsgBox(null);
    }

    navigation.checkBtnState(points[n]);
};

unsafeWindow._back = function () {
    if (points[n].preventBackward) return;

    let sv = unsafeWindow.__sv;

    n--;
    if (n < 0) n = points.length - 1;

    if (points[n].panoId) {
        sv.setPano(points[n].panoId);
        sv.setPov({ heading: points[n].heading, pitch: points[n].pitch });
    } else {
        sv.setPosition(points[n]);
        sv.setPov({ heading: points[n].heading, pitch: points[n].pitch });
    }
    if (points[n]?.extra?.tags?.length > 0) {
        appendMsgBox(points[n].extra.tags[0]);
    } else {
        appendMsgBox(null);
    }
    navigation.checkBtnState(points[n]);
};

async function testIfRoutExists(lat, lng) {
    let t = `lat:${lat.toFixed(11)},lng:${lng.toFixed(11)}`.replace(/\./g, ",");
    let fireBaseUrl = "https://pathloggerapi-default-rtdb.firebaseio.com/routes/";
    let list = await fetch(fireBaseUrl + t + ".json?shallow=true").then((res) => res.json());
    return list;
}

async function getRoute(lat, lng) {
    let t = `lat:${lat.toFixed(11)},lng:${lng.toFixed(11)}`.replace(/\./g, ",");
    let fireBaseUrl = "https://pathloggerapi-default-rtdb.firebaseio.com/routes/";
    let list = await fetch(fireBaseUrl + t + ".json").then((res) => res.json());
    return list;
}

const navigation = {
    container: null,
    forwardBtn: null,
    backwardBtn: null,
    makeButtons: function () {
        let pos = lc.get("pos") || { x: 100, y: 100 };

        let cont = document.createElement("div");
        cont.classList.add("cont");
        this.container = cont;
        cont.style.cssText = `position: absolute; top: ${pos.y}px; left: ${pos.x}px; cursor: pointer; padding: 20px; display: none;`;

        this.backwardBtn = document.createElement("button");
        this.backwardBtn.classList.add("btn");
        this.backwardBtn.innerText = "Reason Backward!";
        this.backwardBtn.addEventListener("mousedown", (e) => e.stopPropagation());
        cont.appendChild(this.backwardBtn);

        this.backwardBtn.addEventListener("click", function () {
            unsafeWindow._back();
        });

        this.forwardBtn = document.createElement("button");
        this.forwardBtn.classList.add("btn");
        this.forwardBtn.style.marginLeft = "1em";
        this.forwardBtn.innerText = "Look Forward!";
        this.forwardBtn.addEventListener("mousedown", (e) => e.stopPropagation());
        cont.appendChild(this.forwardBtn);

        this.forwardBtn.addEventListener("click", function () {
            unsafeWindow._next();
        });

        document.body.appendChild(cont);

        cont.addEventListener("mousedown", function (e) {
            document.body.addEventListener("mousemove", mmove);
            document.body.addEventListener("mouseup", mup);

            let yy = pos.y - e.y;
            let xx = e.x - pos.x;

            function mmove(evt) {
                if (Math.abs(evt.x - e.x) > 2 || Math.abs(evt.y - e.y) > 2) {
                    document.body.removeEventListener("mousemove", mmove);
                    document.body.addEventListener("mousemove", _mmove);
                }
            }

            function _mmove(evt) {
                cont.style.top = evt.y + yy + "px";
                cont.style.left = evt.x - xx + "px";
            }

            function mup(evt) {
                document.body.removeEventListener("mousemove", mmove);
                document.body.removeEventListener("mousemove", _mmove);
                document.body.removeEventListener("mouseup", mup);

                if (Math.abs(evt.x - e.x) < 2 && Math.abs(evt.y - e.y) < 2) {
                    return;
                }

                pos.x = evt.x - xx;
                pos.y = evt.y + yy;

                lc.set("pos", pos);
            }
        });
    },
    disableForwardBtn: function () {
        this.forwardBtn.disabled = true;
    },
    enableForwardBtn: function () {
        this.forwardBtn.disabled = false;
    },
    disableBackwardBtn: function () {
        this.backwardBtn.disabled = true;
    },
    enableBackwardBtn: function () {
        this.backwardBtn.disabled = false;
    },
    checkBtnState(obj) {
        if (obj.preventForward) this.disableForwardBtn();
        else this.enableForwardBtn();

        if (obj.preventBackward) this.disableBackwardBtn();
        else this.enableBackwardBtn();
    },
    hideButtons: function () {
        this.container.style.display = "none";
    },
    showButtons: function () {
        if (this.container) {
            this.container.style.display = "";
            return;
        }
        this.makeButtons();
        this.container.style.display = "";
    },
};

let messageBox = null;
let OKToShowMessageBox = true;

function appendMsgBox(msg) {
    if (!OKToShowMessageBox) return;

    if (messageBox || msg === null) {
        if (msg === null) {
            if (!messageBox) return;

            messageBox.style.display = "none";

            return;
        }

        messageBox.style.display = "";
        messageBox._update(msg);
        return;
    }

    //
    // Basically, it's a copy of google map's infoWindow.
    //

    let cont = document.createElement("div");
    cont._update = update;
    cont.style.cssText = `padding-right: 0px;
    max-height: 799px;
    min-width: 0px;
        position: absolute;
        -webkit-box-sizing: border-box;
        -moz-box-sizing: border-box;
        box-sizing: border-box;
        overflow: hidden;
        top: 0;
        left: 0;
        background-color: white;
        -webkit-border-radius: 8px;
        -moz-border-radius: 8px;
        border-radius: 8px;
        padding: 12px;
        -webkit-box-shadow: 0 2px 7px 1px rgb(0 0 0 / 30%);
        -moz-box-shadow: 0 2px 7px 1px rgba(0,0,0,.3);
        box-shadow: 0 2px 7px 1px rgb(0 0 0 / 30%);
        padding-right: 0px;
        padding-bottom: 0px;
        max-width: 648px;
        max-height: 799px;
        min-width: 0px;
        z-index:2000;
    `;

    messageBox = cont;

    let body = document.createElement("div");
    body.style.cssText = `padding-right: 0px;
        overflow: scroll;
        max-height: 781px;
        -webkit-box-sizing: border-box;
        -moz-box-sizing: border-box;
        box-sizing: border-box;
       // overflow: auto;
     `;
    body.classList.add("d");
    body.innerHTML = msg;

    let closeBtn = document.createElement("button");
    closeBtn.style.cssText = `
         background: none;
        display: block;
        border: 0px;
        margin: 0px;
        padding: 0px;
        text-transform: none;
        appearance: none;
        position: absolute;
        cursor: pointer;
        user-select: none;
        top: -6px;
        right: -6px;
        width: 30px;
        height: 30px;
     `;

    let span = document.createElement("span");
    span.style.cssText = `
        -webkit-mask-image: url(data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2024%2024%22%3E%3Cpath%20d%3D%22M19%206.41L17.59%205%2012%2010.59%206.41%205%205%206.41%2010.59%2012%205%2017.59%206.41%2019%2012%2013.41%2017.59%2019%2019%2017.59%2013.41%2012z%22/%3E%3Cpath%20d%3D%22M0%200h24v24H0z%22%20fill%3D%22none%22/%3E%3C/svg%3E);
        background-color: #000;
        pointer-events: none;
        display: block;
        width: 14px;
        height: 14px;
        margin: 8px;
    `;
    closeBtn.appendChild(span);
    closeBtn.addEventListener("click", (e) => {
        OKToShowMessageBox = false;
        cont.remove();
        alert("Messages will be shown again when page refreshes.");
    });

    cont.appendChild(body);
    cont.appendChild(closeBtn);
    document.body.appendChild(cont);

    function update(msg) {
        body.innerHTML = msg;
    }
}

let lc = {
    get: (prop) => {
        let s = localStorage["OneRoute"];
        s = typeof s == "string" ? JSON.parse(s) : {};

        if (s[prop]) {
            return s[prop];
        }

        return null;
    },
    set: (prop, val) => {
        let s = localStorage["OneRoute"];
        s = typeof s == "string" ? JSON.parse(s) : {};

        s[prop] = val;

        localStorage["OneRoute"] = JSON.stringify(s);
    },
};

function isCorrectMap() {
    let mapNameEl = document.querySelector(`[data-qa="map-name"]`);
    let regEx = new RegExp(correctMapName);
    if (!mapNameEl || !regEx.test(mapNameEl.innerText)) return;

    return true;
}

function endOfRoundScreenFn() {
    appendMsgBox(null);

    if (curRoundObj?.extra?.tags) {
        appendMsgBox(curRoundObj.extra.tags[0]);
    }

    //   curRoundObj = {};

    n = 0;

    startPos = null;
}

function endEndOfRoundScreenFn() {
    appendMsgBox(null);
}

function endOfGameFn() {
    appendMsgBox(null);
    //endOfRoundScreenFn();
    navigation.hideButtons();
}

let round = null;
var endOfRoundObserver = new MutationObserver((mutationRecords) => {
    mutationRecords.forEach((record) => {
        if (record.type == "characterData") {
            let dataqa = record.target.parentElement.parentElement.getAttribute("data-qa");
            if (dataqa === "round-number" || dataqa === "score") {
                //  endOfRoundScreenFn();
                navigation.hideButtons();
            }
            return;
        }

        if (record.type == "childList") {
            setTimeout(
                function (removed, added) {
                    removed.forEach((node) => {
                        if (!node.querySelector) {
                            return;
                        }
                        if (node.querySelector('[data-qa="round-number"]')) {
                            endOfGameFn();
                            return;
                        }

                        let buttons = node.querySelectorAll("button");
                        buttons.forEach((button) => {
                            if (/play again/i.test(button.innerHTML) || /view summary/i.test(button.innerHTML) || /play next round/i.test(button.innerHTML)) {
                                endEndOfRoundScreenFn();
                            }
                        });

                        let anchors = node.querySelectorAll("a");
                        anchors.forEach((anchor) => {
                            if (/play again/i.test(anchor.innerHTML) || /view summary/i.test(anchor.innerHTML) || /play next round/i.test(anchor.innerHTML)) {
                                endEndOfRoundScreenFn();
                            }
                        });
                    });

                    added.forEach((node) => {
                        if (!node.querySelectorAll) {
                            return;
                        }
                        let buttons = node.querySelectorAll("button");
                        buttons.forEach((button) => {
                            if (/play again/i.test(button.innerHTML)) {
                                endOfGameFn();
                                navigation.hideButtons();
                                return;
                            }
                            if (/view summary/i.test(button.innerHTML) || /play next round/i.test(button.innerHTML)) {
                                endOfRoundScreenFn();
                                navigation.hideButtons();
                                return;
                            }
                        });
                        let anchors = node.querySelectorAll("a");
                        anchors.forEach((anchor) => {
                            if (/play again/i.test(anchor.innerHTML)) {
                                endOfGameFn();
                                navigation.hideButtons();
                                return;
                            }
                            if (/view summary/i.test(anchor.innerHTML) || /play next round/i.test(anchor.innerHTML)) {
                                endOfRoundScreenFn();
                                navigation.hideButtons();
                                return;
                            }
                        });
                    });
                },
                100,
                record.removedNodes,
                record.addedNodes
            );
        }
    });
});

endOfRoundObserver.observe(document.body, {
    childList: true,
    characterData: true,
    subtree: true,
});

/////////////// Delete below this line when uploading.

unsafeWindow.uploadToFirebase = function (data) {
    if (Array.isArray(data)) {
        data = { name: "anonymous", customCoordinates: data };
    }

    let a = data.customCoordinates;

    let lat = a[0].lat.toFixed(11);
    let lng = a[0].lng.toFixed(11);

    let t = `lat:${lat},lng:${lng}`.replace(/\./g, ",");

    let fireBaseUrl = "https://pathloggerapi-default-rtdb.firebaseio.com/routes/";

    let requestOptions = {
        method: "PATCH",
        headers: { "Content-Type": "application/text" },
        body: JSON.stringify(data),
    };

    fetch(fireBaseUrl + t + "/.json", requestOptions)
        .then((response) => response.json())
        .then((json) => console.log(json))
        .catch((error) => alert(error));
};

function showHelper() {
    let cont = document.createElement("div");
    cont.style.cssText = `position: absolute; top: 10px; left: 10px;z-index: 1000;`;

    let closeBtn = document.createElement("div");
    closeBtn.style.cssText = `position:absolute; top: 0px; right: -2rem; font-size: 1.4rem; cursor: pointer;background: white; padding:5px; border-radius: 10px;`;
    closeBtn.innerHTML = "&times;";
    closeBtn.addEventListener("click", function () {
        this.parentElement.remove();
    });
    cont.appendChild(closeBtn);

    let textInput = document.createElement("input");
    textInput.style.cssText = `display: block; width: ${window.innerWidth / 2}px;`;
    textInput.placeholder = "Paste export from map-making.app here.";
    textInput.value = curRoundObj?.name ? JSON.stringify(curRoundObj) : "";
    cont.appendChild(textInput);

    let infoDiv = document.createElement("div");
    infoDiv.innerHTML = "Javascript globals: <code>window.__map</code> -> google map object; <code>window.__sv</code> -> google street view object.";
    infoDiv.style.cssText = `display: block;`;
    cont.appendChild(infoDiv);

    let changeMapName = document.createElement("button");
    changeMapName.innerText = "Click to change map name. Current map name is: '" + correctMapName + "'";
    changeMapName.addEventListener("click", () => {
        const mapName = prompt("Enter name of map:", correctMapName);
        localStorage["oneRouteHelperMapName"] = mapName;
        correctMapName = localStorage["oneRouteHelperMapName"] || "";
        changeMapName.innerText = "Click to change map name. Current map name is: '" + correctMapName + "'";
    });
    changeMapName.style.cssText = `display: block;`;
    cont.appendChild(changeMapName);

    let endOfRoundTextBtn = document.createElement("button");
    endOfRoundTextBtn.addEventListener("click", () => {
        let obj = JSON.parse(textInput.value);
        let currentStuff = obj.extra.tags[0] ? obj.extra.tags[0] : "";

        let extraStuff = prompt("What text would you like to display at the end of the round", currentStuff);

        obj.extra.tags[0] = extraStuff;

        textInput.value = JSON.stringify(obj);

        saveBtn.showThatChangesWereMade();
    });
    endOfRoundTextBtn.innerText = "Add end of round screen text";
    endOfRoundTextBtn.style.cssText = `display: block;`;
    cont.appendChild(endOfRoundTextBtn);

    let sortAscBtn = document.createElement("button");
    sortAscBtn.addEventListener("click", () => {
        let obj = JSON.parse(textInput.value);
        sort(obj);
        textInput.value = JSON.stringify(obj);
        saveBtn.showThatChangesWereMade();
    });
    sortAscBtn.innerText = "Sort ascending";
    sortAscBtn.style.cssText = `display: block;`;
    cont.appendChild(sortAscBtn);

    const sortDescBtn = document.createElement("button");
    sortDescBtn.addEventListener("click", () => {
        const obj = JSON.parse(textInput.value);
        sort(obj, false);
        textInput.value = JSON.stringify(obj);
        saveBtn.showThatChangesWereMade();
    });
    sortDescBtn.innerText = "Sort descending";
    sortDescBtn.style.cssText = `display: block;`;
    cont.appendChild(sortDescBtn);

    const removeFistTagBtn = document.createElement("button");
    removeFistTagBtn.addEventListener("click", () => {
        if (!confirm(`This was added to remove the numbers used for sorting the list so that they don't show on screen.`)) {
            return;
        }
        const obj = JSON.parse(textInput.value);
        removeFirstTag(obj);
        textInput.value = JSON.stringify(obj);
        saveBtn.showThatChangesWereMade();
    });
    removeFistTagBtn.innerText = "Remove first tag";
    cont.appendChild(removeFistTagBtn);

    const togglePreventForwardBackward = document.createElement("button");
    togglePreventForwardBackward.innerText = "Toggle prevent forward/backward";
    togglePreventForwardBackward.style.cssText = `display: block;`;
    togglePreventForwardBackward.addEventListener("click", () => {
        const obj = JSON.parse(textInput.value);
        const len = obj.customCoordinates.length;
        if (
            !confirm(`This will prevent the player from going backward at the first location (spawn point) and prevent the player from going forward once they reach the last location.
        It is a hack in response to a bug in the game that doesn't alow jumping between locations that are far away from each other.`)
        ) {
            return;
        }
        let state = obj.customCoordinates[0].preventBackward;
        obj.customCoordinates[0].preventBackward = !state;
        obj.customCoordinates[len - 1].preventForward = !state;
        textInput.value = JSON.stringify(obj);
        saveBtn.showThatChangesWereMade();
    });

    cont.appendChild(togglePreventForwardBackward);

    const downloadBtn = document.createElement("button");
    downloadBtn.style.cssText = `display: block;`;
    downloadBtn.addEventListener("click", () => {
        const obj = JSON.parse(textInput.value);
        const first = JSON.stringify(obj.customCoordinates[0]);
        const text = `[${first}]`;
        download(obj.name + " for geoguessr map maker.json", text);
        alert("Now make a map with four other locations and play it until you get to this round. Have fun!");
    });
    downloadBtn.innerText = "Download JSON file for map maker";

    cont.appendChild(downloadBtn);

    const saveBtn = document.createElement("button");
    saveBtn.style.cssText = `display: block;`;
    saveBtn.showThatChangesWereMade = () => (saveBtn.style.background = "maroon");
    saveBtn.addEventListener("click", () => {
        try {
            const obj = JSON.parse(textInput.value);
            curRoundObj = obj;
            points = curRoundObj.customCoordinates;
            sessionStorage["curRoute"] = textInput.value;
            saveBtn.style.background = "";
            saveBtn.innerText = "Save changes - You may need to reload the page to see changes";
            setTimeout(function () {
                saveBtn.innerText = "Save changes";
            }, 2000);
        } catch (error) {
            alert("Can't save for some reason : " + error);
        }
    });
    saveBtn.innerText = "Save changes";

    cont.appendChild(saveBtn);

    document.body.appendChild(cont);
}

function sort(obj, asc = true) {
    obj.customCoordinates.sort(function compareFn(_a, _b) {
        let a = +_a.extra.tags[0];
        let b = +_b.extra.tags[0];

        if (a < b) {
            let a = asc ? -1 : 1;
            return a;
        }
        if (a > b) {
            let a = asc ? 1 : -1;
            return a;
        }
        // a must be equal to b
        return 0;
    });

    return obj;
}

function removeFirstTag(obj) {
    for (n = 0; n < obj.customCoordinates.length; n++) {
        let z = obj.customCoordinates[n];
        z.extra.tags.shift();
    }
    console.log(obj);
    return obj;
}

function download(filename, text) {
    //https://stackoverflow.com/questions/3665115/how-to-create-a-file-in-memory-for-user-to-download-but-not-through-server
    var element = document.createElement("a");
    element.setAttribute("href", "data:text/plain;charset=utf-8," + encodeURIComponent(text));
    element.setAttribute("download", filename);

    element.style.display = "none";
    document.body.appendChild(element);

    element.click();

    document.body.removeChild(element);
}
