// ==UserScript==
// @name         Wack script v1.6
// @namespace    GeoGuessr scripts
// @version      1.6
// @description  Wack script for a wack map.
// @match        https://www.geoguessr.com/*
// @author       echandler
// @downloadURL  https://github.com/echandler/wack-script/raw/main/wackScript.user.js
// @run-at       document-start
// @license      MIT
// @grant        GM_addStyle
// ==/UserScript==

///////////////////////////////////////////////////////////

//  Change the value of this variable to the name of your map.
//let correctMapName = "wack map";
let correctMapName = ["wack map", "British wack map"];

///////////////////////////////////////////////////////////

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
                    console.log('wackity');
                    if (!observer) return;
                    observer = undefined;
                    modifyStreeVeiwPanoramaObj();
                    modifyGoogleMapsObject();
                    navigation.makeButtons();
                    makeEventListeners();
                }, {once: true});
            }
        }
    }
};

const targetNode = document.head;
const config = { childList: true, subtree: true };
const observer = new MutationObserver(callback);
observer.observe(targetNode, config);

let points = [];
let curRoundObj = {};
let el = null;
let startPos = null;
let badResponseTries = 0;
let curPos = null;
let setPosErrorTimer = null;
let n = 0;

let oldSV = null;

let modifyStreeVeiwPanoramaObj = function () {
    oldSV = google.maps.StreetViewPanorama.prototype.setPosition;
    console.log('wack', oldSV);
    google.maps.StreetViewPanorama.prototype.setPosition = _setPos;//Object.assign(
      //  function (...args) {
//
      // // google.maps.StreetViewPanorama = class extends google.maps.StreetViewPanorama {
      // //    constructor(...args) {
      // //       super(...args);
//
//
      // //          this.protoType.setPosition = _setPos;
//
      //      setTimeout(() => {
      //          if (!isCorrectMap()) return;
//
      //          el = args[0];
//
      //          this.setOptions({
      //              clickToGo: false,
      //              linksControl: false,
      //          });
      //      }, 100);
//
      //  google.maps.StreetViewPanorama.prototype.setPosition = _setPos;
      //  google.maps.StreetViewPanorama.prototype.setPosition.apply(this, args);
      //  //    unsafeWindow.google.maps.event.trigger(unsafeWindow, "street veiw created", this);
      //  }
   // };
};

let optionsSet = false;
let once = false;
function _setPos(...args) {
    // wack
    let _args = [...args];

    if (once) {
      //  console.log('wack');
        oldSV.apply(this, args);
        return;
    }
    once = true;
    this.addListener("position_changed", () => {

        //  Used for debugging, flashes element when sv position changes.
        //  let p = document.querySelector('[data-qa="pano-zoom-in"]');
        //  if (!p) return;
        //  p.style.background = 'red';
        //  setTimeout(()=> p.style.background = '', 100);

        unsafeWindow.__sv = this;

        if (!optionsSet){
            setTimeout(() => {
                optionsSet = true;
                if (!isCorrectMap()) return;

                el = document.createElement('div');//_args[0];

                this.setOptions({
                    clickToGo: false,
                    linksControl: false,
                });
            }, 100);
        }

        unsafeWindow.google.maps.event.trigger(unsafeWindow, "street view set position changed", { args: args, _this: this });
    });

    oldSV.apply(this, args);
   // if (google.maps.StreetViewPanorama.prototype.setPosition === _setPos)
    google.maps.StreetViewPanorama.prototype.setPosition = oldSV;
}

async function streetViewSetPositionChanged(event) {
    let args = [event._this.position];
    let _this = event._this;

    if (!isCorrectMap()) return;

    let pos = args[0];

    if (typeof args[0].lat === "function") {
        pos = args[0].toJSON();
    }

    if (startPos && !(startPos.lat === pos.lat && startPos.lng === pos.lng)) return;

    //
    // The player is at the start position.
    //

    if (isBetweenRounds(document.body)) {
        return;
    }

    n = 0;

    let key = `lat:${pos.lat.toFixed(11)},lng:${pos.lng.toFixed(11)}`.replace(/\./g, ",");

    curRoundObj = lc.get(key);

    curRoundObj = curRoundObj?.customCoordinates ? curRoundObj : await testIfRouteExists(pos.lat, pos.lng);

    if (!curRoundObj) {
        if (badResponseTries++ < 5) {
            console.error("Trying again => ", pos);
            setPosErrorTimer = setTimeout(() => _this.setPosition(pos), 2000);
            return;
        }

        clearTimeout(setPosErrorTimer);

        alert("There was an error, hopefully restarting the page will fix it");

        alert = function () {
            /*Alert gets called a bunch of time before page reloads.*/
        };

        //       location.reload();

        return;
    }

    //
    // Route does exist in a databasee.
    //

    clearTimeout(setPosErrorTimer);

    badResponseTries = 0;

    startPos = { ...pos };

    navigation.showButtons();

    if (el) {
        el.style.visibility = "hidden";
    }

    if (!curRoundObj.customCoordinates || curRoundObj.customCoordinates === true) {
        curRoundObj = await getRoute(startPos.lat, startPos.lng);
    }

    points = curRoundObj.customCoordinates;

    // Save to local storage to limit hits on database.
    //lc.set(key, curRoundObj);

    if (points[0].panoId) {
        setTimeout(() => {
            _this.setPano(points[0].panoId);
            _this.setPov({ heading: points[0].heading, pitch: points[0].pitch });
            el.style.visibility = "visible";
            navigation.checkBtnState(points[0]);
        }, 500);
    } else {
        setTimeout(() => {
            _this.setPosition(points[0]);
            _this.setPov({ heading: points[0].heading, pitch: points[0].pitch });
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

let modifyGoogleMapsObject = function () {
      let oldMaps = google.maps.Map;
    google.maps.Map = function(...args){
            let res = oldMaps.apply(this, args);

            unsafeWindow.__map = this;
            unsafeWindow.google.maps.event.trigger(unsafeWindow, 'map created', this);
           return res;
    }
    google.maps.Map.prototype = oldMaps.prototype;
};

unsafeWindow.showPano = function(n){
    let sv = unsafeWindow.__sv;

    if (points[n].panoId){
        sv.setPano(points[n].panoId);
        sv.setPov({heading: points[n].heading, pitch: points[n].pitch});
    } else {
        sv.setPosition(points[n]);
        sv.setPov({heading: points[n].heading, pitch: points[n].pitch});
    }

    if (points[n]?.extra?.tags?.length > 0){
        appendMsgBox(points[n].extra.tags[0]);
        //     alert(points[n].extra.tags[0]);
    } else {

        appendMsgBox(null);
    }
    if (points[n].preventBackward){

    }
    navigation.checkBtnState(points[n]);

}

unsafeWindow._next = function (){
    if (points[n].preventForward) return;

    let sv = unsafeWindow.__sv;
    n++;

    if (n >= points.length) n = 0;

    unsafeWindow.showPano(n);

    return;
};

unsafeWindow._back = function () {
    if (points[n].preventBackward) return;

    let sv = unsafeWindow.__sv;

    n--;
    if (n < 0) n = points.length - 1;

    unsafeWindow.showPano(n);
    return;
};

async function testIfRouteExists(lat, lng) {
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

    `;

    messageBox = cont;

    let body = document.createElement("div");
    body.style.cssText = `padding-right: 0px;
        overflow: scroll;
        max-height: 781px;
        -webkit-box-sizing: border-box;
        -moz-box-sizing: border-box;
        box-sizing: border-box;
       /* overflow: auto;*/
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
    if (!mapNameEl) return;

    for(let n = 0; n < correctMapName.length; n++){
        let regEx = new RegExp(correctMapName[n]);
        if (regEx.test(mapNameEl.innerText)) return true;
    }

    return false;
}

function endOfRoundScreen_load_() {
    appendMsgBox(null);

    if (curRoundObj?.extra?.tags) {
        appendMsgBox(curRoundObj.extra.tags[0]);
    }

    curRoundObj = {};

    n = 0;

    startPos = null;

    navigation.hideButtons();
}

function endOfRoundScreen_unload_() {
    appendMsgBox(null);
}

function endOfGameFn() {
    appendMsgBox(null);
    navigation.hideButtons();
}

function isBetweenRounds(node) {
    let ret = false;
    let buttons = node.querySelectorAll("button");
    for (let btn of buttons) {
        let ret = x(btn);
        if (ret) return ret;
    }

    let anchors = node.querySelectorAll("a");
    for (let anchor of anchors) {
        let ret = x(anchor);
        if (ret) return ret;
    }

    function x(element) {
        if (/play again/i.test(element.innerHTML)) {
            ret = "final";
        }
        if (/view results/i.test(element.innerHTML)) {
            ret = "summary";
        }
        if (/Next/.test(element.innerHTML)) {
            ret = "end of round";
        }
        return false;
    }

    return ret;
}

function makeEventListeners() {
    let addListener = unsafeWindow.google.maps.event.addListener;
    addListener(unsafeWindow, "absolute end of game", endOfGameFn);

    addListener(unsafeWindow, "final page load", endOfRoundScreen_load_);
    addListener(unsafeWindow, "final page unload", endOfRoundScreen_unload_);

    addListener(unsafeWindow, "summary page load", endOfRoundScreen_load_);
    addListener(unsafeWindow, "summary page unload", endOfRoundScreen_unload_);

    addListener(unsafeWindow, "end of round screen load", endOfRoundScreen_load_);
    addListener(unsafeWindow, "end of round screen unload", endOfRoundScreen_unload_);

    addListener(unsafeWindow, "street view set position changed", streetViewSetPositionChanged);
}

let round = null;
var endOfRoundObserver = new MutationObserver((mutationRecords) => {
    mutationRecords.forEach((record) => {
        if (record.type == "characterData") {
            let dataqa = record.target?.parentElement?.parentElement?.getAttribute("data-qa");
            if (dataqa === "round-number" || dataqa === "score") {
                //  endOfRoundScreen_load_();
                navigation.hideButtons();
            }
            return;
        }

        if (record.type == "childList") {
            setTimeout(
                function (removed, added) {
                    removed.forEach((node) => {
                        if (!node.querySelector) return;

                        if (node.querySelector('[data-qa="round-number"]')) {
                            unsafeWindow.google.maps.event.trigger(unsafeWindow, "absolute end of game", {});
                            return;
                        }

                        let state = isBetweenRounds(node);
                        if (!state) return;

                        if (state === "final") {
                            unsafeWindow.google.maps.event.trigger(unsafeWindow, "final page unload", {});
                        } else if (state === "summary") {
                            unsafeWindow.google.maps.event.trigger(unsafeWindow, "summary page unload", {});
                        } else {
                            unsafeWindow.google.maps.event.trigger(unsafeWindow, "end of round screen unload", {});
                        }
                    });

                    added.forEach((node) => {
                        if (!node.querySelectorAll) return;

                        let state = isBetweenRounds(node);
                        if (!state) return;

                        if (state === "final") {
                            unsafeWindow.google.maps.event.trigger(unsafeWindow, "end of game", {});
                            return;
                        }

                        if (state === "final") {
                            unsafeWindow.google.maps.event.trigger(unsafeWindow, "final page load", {});
                        } else if (state === "summary") {
                            unsafeWindow.google.maps.event.trigger(unsafeWindow, "summary page load", {});
                        } else {
                            unsafeWindow.google.maps.event.trigger(unsafeWindow, "end of round screen load", {});
                        }
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
